import { prisma } from "@repo/db";
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
  name: true,
  country: true,
  countryCode: true,
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
  name: true,
  slug: true,
  country: true,
  countryCode: true,
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
} as const;

const cdnBaseUrl = config.cdnBaseUrl.endsWith("/")
  ? config.cdnBaseUrl.slice(0, -1)
  : config.cdnBaseUrl;

function withCdnImageUrl<T extends { imageUrl: string | null }>(record: T): T {
  if (!record.imageUrl || !cdnBaseUrl) {
    return record;
  }
  if (/^https?:\/\//i.test(record.imageUrl)) {
    return record;
  }

  const normalizedPath = record.imageUrl.startsWith("/")
    ? record.imageUrl
    : `/${record.imageUrl}`;

  return {
    ...record,
    imageUrl: `${cdnBaseUrl}${normalizedPath}`,
  };
}

export const destinationService = {
  async getPopular() {
    const destinations = await prisma.destination.findMany({
      where: { isFeatured: true },
      select: popularDestinationSelect,
      orderBy: [{ name: "asc" }],
    });

    return destinations.map(withCdnImageUrl);
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

    return destinations.map(withCdnImageUrl);
  },

  async getById(destinationId: string) {
    const destination = await prisma.destination.findUnique({
      where: { id: destinationId },
      select: destinationDetailSelect,
    });

    if (!destination) {
      throw new AppError(404, "NOT_FOUND", "Destination not found");
    }

    const places = await prisma.place.findMany({
      where: { destinationId },
      select: placePreviewSelect,
      orderBy: [{ isCurated: "desc" }, { isFeatured: "desc" }, { rating: "desc" }],
    });

    const curatedPlaces = places.filter((place) => place.isCurated).map(withCdnImageUrl);
    const otherPlaces = places.filter((place) => !place.isCurated).map(withCdnImageUrl);

    return {
      destination: withCdnImageUrl(destination),
      curatedPlaces,
      otherPlaces,
    };
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
};
