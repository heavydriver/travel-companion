import { prisma } from "@repo/db";
import { apiCache } from "../../utils/cache";
import { AppError } from "../../middleware/errorHandler";
import { config } from "../../utils/config";

type DestinationListFilters = {
  q?: string;
  isFeatured?: boolean;
  countryCode?: string;
  adminCode?: string;
  limit?: number;
  offset?: number;
};

const destinationListSelect = {
  id: true,
  googlePlaceId: true,
  name: true,
  country: true,
  countryCode: true,
  source: true,
  slug: true,
  region: true,
  imageUrl: true,
  isFeatured: true,
  kind: true,
  adminCode: true,
  m49Code: true,
  searchAliases: true,
} as const;

const popularDestinationSelect = {
  id: true,
  name: true,
  country: true,
  slug: true,
  imageUrl: true,
  description: true,
  isFeatured: true,
} as const;

const destinationDetailSelect = {
  id: true,
  googlePlaceId: true,
  name: true,
  slug: true,
  country: true,
  countryCode: true,
  source: true,
  region: true,
  description: true,
  latitude: true,
  longitude: true,
  timezone: true,
  currencyCode: true,
  imageUrl: true,
  bestTimeToVisit: true,
  emergencyNumber: true,
  packVersion: true,
  isFeatured: true,
  kind: true,
  adminCode: true,
  m49Code: true,
  searchAliases: true,
} as const;

const placePreviewSelect = {
  id: true,
  destinationId: true,
  name: true,
  slug: true,
  category: true,
  description: true,
  latitude: true,
  longitude: true,
  imageUrl: true,
  rating: true,
  reviewCount: true,
  isCurated: true,
  isFeatured: true,
  priceLevel: true,
  address: true,
  city: true,
  openingHours: true,
} as const;

const cdnBaseUrl = config.cdnBaseUrl.endsWith("/")
  ? config.cdnBaseUrl.slice(0, -1)
  : config.cdnBaseUrl;

function cdnDestinationId(record: { id?: string; destinationId?: string }): string | null {
  if (typeof record.destinationId === "string" && record.destinationId.length > 0) {
    return record.destinationId;
  }
  if (typeof record.id === "string" && record.id.length > 0) {
    return record.id;
  }
  return null;
}

/** Place assets live under `cdnBase/<destinationId>/<path>`. */
function withPlaceCdnImageUrl<T extends { imageUrl: string | null }>(record: T): T {
  if (!record.imageUrl || !cdnBaseUrl) {
    return record;
  }
  if (/^https?:\/\//i.test(record.imageUrl)) {
    return record;
  }

  const destinationId = cdnDestinationId(record as { id?: string; destinationId?: string });
  if (!destinationId) {
    return record;
  }

  const normalizedPath = record.imageUrl.startsWith("/") ? record.imageUrl : `/${record.imageUrl}`;

  return {
    ...record,
    imageUrl: `${cdnBaseUrl}/${destinationId}${normalizedPath}`,
  };
}

/** Destination hero uses `cdnBase` + stored `imageUrl` path only (no destination id segment). */
function withDestinationCdnImageUrl<T extends { imageUrl: string | null }>(record: T): T {
  if (!record.imageUrl || !cdnBaseUrl) {
    return record;
  }
  if (/^https?:\/\//i.test(record.imageUrl)) {
    return record;
  }

  const normalizedPath = record.imageUrl.startsWith("/") ? record.imageUrl : `/${record.imageUrl}`;

  return {
    ...record,
    imageUrl: `${cdnBaseUrl}${normalizedPath}`,
  };
}

function slugifyDestinationName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function ensureUniqueDestinationSlug(base: string) {
  const normalized = slugifyDestinationName(base) || "destination";
  let slug = normalized;
  let suffix = 2;

  while (await prisma.destination.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${normalized}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

function normalizeCountryCode(value?: string | null) {
  const next = value?.trim().toUpperCase();
  return next && next.length === 2 ? next : "XX";
}

function normalizeCurrencyCode(value?: string | null) {
  const next = value?.trim().toUpperCase();
  return next && next.length === 3 ? next : "USD";
}

function guessDestinationKind(name: string) {
  const normalized = name.trim().toLowerCase();
  if (
    normalized.includes("country") ||
    normalized === normalized.toUpperCase() ||
    normalized.split(" ").length === 1
  ) {
    return "COUNTRY" as const;
  }
  return "CITY" as const;
}

async function findDestinationCurrencyForCountry(countryCode: string) {
  if (!countryCode || countryCode === "XX") return null;
  const existing = await prisma.destination.findFirst({
    where: { countryCode },
    select: { currencyCode: true },
    orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
  });
  return existing?.currencyCode ?? null;
}

async function fetchGoogleTimeZoneId(latitude: number, longitude: number) {
  if (!config.googleMapsApiKey) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  const url = new URL("https://maps.googleapis.com/maps/api/timezone/json");
  url.searchParams.set("location", `${latitude},${longitude}`);
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("key", config.googleMapsApiKey);

  const response = await fetch(url.toString());
  if (!response.ok) return null;

  const json = (await response.json()) as { status?: string; timeZoneId?: string };
  if (json.status !== "OK" || !json.timeZoneId) return null;
  return json.timeZoneId;
}

type GooglePlaceResolve = {
  googlePlaceId: string;
  name: string;
  country: string;
  countryCode: string;
  region: string | null;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  description: string | null;
};

async function fetchGooglePlaceCandidate(query: string): Promise<GooglePlaceResolve | null> {
  if (!config.googleMapsApiKey) return null;

  const searchResponse = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": config.googleMapsApiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.photos",
    },
    body: JSON.stringify({
      textQuery: query,
      pageSize: 1,
    }),
  });

  if (!searchResponse.ok) {
    return null;
  }

  const searchJson = (await searchResponse.json()) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      photos?: Array<{ name?: string }>;
    }>;
  };

  const candidate = searchJson.places?.[0];
  if (!candidate?.id || candidate.location?.latitude == null || candidate.location?.longitude == null) {
    return null;
  }

  const detailsResponse = await fetch(`https://places.googleapis.com/v1/places/${candidate.id}`, {
    headers: {
      "X-Goog-Api-Key": config.googleMapsApiKey,
      "X-Goog-FieldMask":
        "id,displayName,formattedAddress,addressComponents,location,photos,editorialSummary",
    },
  });

  if (!detailsResponse.ok) {
    return null;
  }

  const detailsJson = (await detailsResponse.json()) as {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    editorialSummary?: { text?: string };
    location?: { latitude?: number; longitude?: number };
    addressComponents?: Array<{
      longText?: string;
      shortText?: string;
      types?: string[];
    }>;
    photos?: Array<{ name?: string }>;
  };

  const countryComponent = detailsJson.addressComponents?.find((item) =>
    item.types?.includes("country"),
  );
  const regionComponent = detailsJson.addressComponents?.find((item) =>
    item.types?.includes("administrative_area_level_1"),
  );
  const firstPhoto = detailsJson.photos?.[0]?.name;
  const imageUrl = firstPhoto
    ? `https://places.googleapis.com/v1/${firstPhoto}/media?maxHeightPx=768&maxWidthPx=768&key=${config.googleMapsApiKey}`
    : null;

  return {
    googlePlaceId: detailsJson.id ?? candidate.id,
    name: detailsJson.displayName?.text ?? candidate.displayName?.text ?? query,
    country: countryComponent?.longText?.trim() || "Unknown",
    countryCode: normalizeCountryCode(countryComponent?.shortText),
    region: regionComponent?.longText?.trim() || null,
    latitude: detailsJson.location?.latitude ?? candidate.location.latitude,
    longitude: detailsJson.location?.longitude ?? candidate.location.longitude,
    imageUrl,
    description: detailsJson.editorialSummary?.text?.trim() || null,
  };
}

export const destinationService = {
  async getPopular() {
    return apiCache.getOrSet("destinations:popular", async () => {
      const destinations = await prisma.destination.findMany({
        where: { isFeatured: true },
        select: popularDestinationSelect,
        orderBy: [{ name: "asc" }],
      });
      return destinations.map(withDestinationCdnImageUrl);
    }, 10 * 60 * 1000);
  },

  async search(filters: DestinationListFilters) {
    const q = filters.q?.trim();
    const take = Math.min(Math.max(Number(filters.limit ?? 20), 1), 50);
    const skip = Math.max(Number(filters.offset ?? 0), 0);
    const where: Record<string, unknown> = {};

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { country: { contains: q, mode: "insensitive" } },
        { region: { contains: q, mode: "insensitive" } },
        { countryCode: { equals: q.toUpperCase() } },
        { adminCode: { equals: q.toUpperCase() } },
        { m49Code: { equals: q } },
        { searchAliases: { array_contains: [q] } },
      ];
    }

    if (filters.countryCode) {
      where.countryCode = filters.countryCode.toUpperCase();
    }
    if (filters.adminCode) {
      where.adminCode = filters.adminCode.toUpperCase();
    }
    if (filters.isFeatured === true) {
      where.isFeatured = true;
    }

    const destinations = await prisma.destination.findMany({
      where,
      select: destinationListSelect,
      take,
      skip,
      orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
    });

    return destinations.map(withDestinationCdnImageUrl);
  },

  async getById(destinationId: string) {
    return apiCache.getOrSet(`destinations:${destinationId}`, async () => {
      const destination = await prisma.destination.findUnique({
        where: { id: destinationId },
        select: {
          ...destinationDetailSelect,
          languages: {
            select: {
              id: true,
              isPrimary: true,
              language: {
                select: { id: true, name: true, isoCode: true, nativeName: true },
              },
            },
          },
        },
      });

      if (!destination) {
        throw new AppError(404, "NOT_FOUND", "Destination not found");
      }

      const { languages, ...destinationRest } = destination;

      const places = await prisma.place.findMany({
        where: { destinationId },
        select: placePreviewSelect,
        orderBy: [{ isCurated: "desc" }, { isFeatured: "desc" }, { rating: "desc" }],
      });

      const curatedPlaces = places.filter((place) => place.isCurated).map(withPlaceCdnImageUrl);
      const otherPlaces = places.filter((place) => !place.isCurated).map(withPlaceCdnImageUrl);

      return {
        destination: withDestinationCdnImageUrl({
          ...destinationRest,
          languages,
        }),
        curatedPlaces,
        otherPlaces,
      };
    }, 5 * 60 * 1000);
  },

  async getPackVersion(destinationId: string) {
    const destination = await prisma.destination.findUnique({
      where: { id: destinationId },
      select: { packVersion: true, updatedAt: true },
    });

    if (!destination) {
      throw new AppError(404, "NOT_FOUND", "Destination not found");
    }

    return {
      packVersion: destination.packVersion,
      updatedAt: destination.updatedAt.toISOString(),
    };
  },

  async resolve(input: {
    query: string;
    country?: string;
    countryCode?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    currencyCode?: string;
  }) {
    const query = input.query.trim();
    if (!query) {
      throw new AppError(422, "VALIDATION_ERROR", "Destination query is required");
    }

    const normalizedCountryCode = normalizeCountryCode(input.countryCode);
    const existing = await prisma.destination.findFirst({
      where: {
        OR: [
          { name: { equals: query, mode: "insensitive" } },
          { slug: slugifyDestinationName(query) },
          { searchAliases: { array_contains: [query] } },
        ],
      },
      select: destinationListSelect,
      orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
    });

    if (existing) {
      return {
        destination: withDestinationCdnImageUrl(existing),
        resolvedBy: "existing" as const,
      };
    }

    const googleMatch = await fetchGooglePlaceCandidate(query);
    if (googleMatch) {
      const alreadyImported = await prisma.destination.findFirst({
        where: {
          OR: [
            { googlePlaceId: googleMatch.googlePlaceId },
            {
              name: { equals: googleMatch.name, mode: "insensitive" },
              countryCode: googleMatch.countryCode,
            },
          ],
        },
        select: destinationListSelect,
        orderBy: [{ updatedAt: "desc" }],
      });

      if (alreadyImported) {
        return {
          destination: withDestinationCdnImageUrl(alreadyImported),
          resolvedBy: "existing" as const,
        };
      }

      const timezone =
        (await fetchGoogleTimeZoneId(googleMatch.latitude, googleMatch.longitude)) ??
        input.timezone?.trim() ??
        "UTC";
      const currencyCode =
        normalizeCurrencyCode(
          input.currencyCode ?? (await findDestinationCurrencyForCountry(googleMatch.countryCode)),
        );

      const created = await prisma.destination.create({
        data: {
          googlePlaceId: googleMatch.googlePlaceId,
          name: googleMatch.name,
          slug: await ensureUniqueDestinationSlug(
            `${googleMatch.name}-${googleMatch.countryCode.toLowerCase()}`,
          ),
          country: googleMatch.country,
          countryCode: googleMatch.countryCode,
          source: "GOOGLE_PLACES",
          kind: guessDestinationKind(googleMatch.name),
          region: googleMatch.region,
          description: googleMatch.description,
          latitude: googleMatch.latitude,
          longitude: googleMatch.longitude,
          timezone,
          currencyCode,
          imageUrl: googleMatch.imageUrl,
          searchAliases: [query],
          isFeatured: false,
        },
        select: destinationListSelect,
      });

      return {
        destination: withDestinationCdnImageUrl(created),
        resolvedBy: "google" as const,
      };
    }

    const fallbackCountry = input.country?.trim() || query;
    const fallbackCurrency =
      normalizeCurrencyCode(
        input.currencyCode ?? (await findDestinationCurrencyForCountry(normalizedCountryCode)),
      );

    const created = await prisma.destination.create({
      data: {
        name: query,
        slug: await ensureUniqueDestinationSlug(
          `${query}-${normalizedCountryCode.toLowerCase() || "manual"}`,
        ),
        country: fallbackCountry,
        countryCode: normalizedCountryCode,
        source: "MANUAL",
        kind: guessDestinationKind(query),
        latitude: input.latitude ?? 0,
        longitude: input.longitude ?? 0,
        timezone: input.timezone?.trim() || "UTC",
        currencyCode: fallbackCurrency,
        description: null,
        searchAliases: [query],
        isFeatured: false,
      },
      select: destinationListSelect,
    });

    return {
      destination: withDestinationCdnImageUrl(created),
      resolvedBy: "manual" as const,
    };
  },
};
