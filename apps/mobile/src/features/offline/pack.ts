import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { client } from "@/api/client";
import type { PhraseItem, LanguageListItem } from "@/features/language-guide/types";
import { useOfflineStore } from "@/store/offlineStore";
import type { MapSession, MapSessionPlace } from "@/store/mapSessionStore";
import type {
  OfflinePackCurrency,
  OfflinePackData,
  OfflinePackDestination,
  OfflinePackPlaceDetail,
  OfflinePackPlaceSummary,
  OfflineTripItineraryItem,
} from "./types";

type DestinationDetailResponse = {
  destination: OfflinePackDestination;
  curatedPlaces: OfflinePackPlaceSummary[];
  otherPlaces: OfflinePackPlaceSummary[];
};

type SupportedCurrency = { code: string; name: string; country: string };

function dedupeById<T extends { id: string }>(items: T[]) {
  return items.filter(
    (item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index,
  );
}

function ensureUppercaseRates(referenceBase: string, body: Record<string, unknown>) {
  const inner = body[referenceBase.toLowerCase()];
  if (!inner || typeof inner !== "object") {
    return {} as Record<string, number>;
  }

  const rates: Record<string, number> = {
    [referenceBase.toUpperCase()]: 1,
  };
  for (const [code, value] of Object.entries(inner as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      rates[code.toUpperCase()] = value;
    }
  }
  return rates;
}

function normalizePlaceSummary(place: OfflinePackPlaceSummary): OfflinePackPlaceSummary {
  return {
    ...place,
    description: place.description ?? null,
    rating: place.rating ?? null,
    reviewCount: place.reviewCount ?? null,
    imageUrl: place.imageUrl ?? null,
    priceLevel: place.priceLevel ?? null,
    address: place.address ?? null,
    city: place.city ?? null,
    openingHours: place.openingHours ?? null,
  };
}

function placeDetailToMapPlace(place: OfflinePackPlaceDetail): MapSessionPlace {
  return {
    id: place.id,
    destinationId: place.destinationId,
    name: place.name,
    category: place.category,
    description: place.description,
    latitude: place.latitude,
    longitude: place.longitude,
    imageUrl: place.imageUrl,
    rating: place.rating,
    reviewCount: place.reviewCount,
    isCurated: place.isCurated,
    isFeatured: place.isFeatured,
    openingHours: place.openingHours ?? null,
  };
}

async function fetchAllPhrasesForLanguage(language: LanguageListItem, destinationId: string) {
  const phrases: PhraseItem[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const res = await client.api.v1.languages({ languageId: language.id }).phrases.get({
      query: {
        page,
        destinationId,
      },
    });
    if (res.error || !res.data) {
      break;
    }
    const data = res.data as {
      phrases: PhraseItem[];
      hasMore: boolean;
      page: number;
    };
    phrases.push(...data.phrases);
    hasMore = data.hasMore;
    page = data.page + 1;
  }

  return phrases;
}

async function fetchDestinationDetail(destinationId: string) {
  const res = await client.api.v1.destinations({ destId: destinationId }).get();
  if (res.error || !res.data?.destination) {
    throw new Error("Failed to load destination");
  }
  return res.data as DestinationDetailResponse;
}

async function fetchPlaceDetails(placeIds: string[]) {
  const entries = await Promise.all(
    placeIds.map(async (placeId) => {
      const res = await client.api.v1.places({ id: placeId }).get();
      if (res.error || !res.data?.place) {
        return null;
      }
      return [placeId, res.data.place as OfflinePackPlaceDetail] as const;
    }),
  );

  return Object.fromEntries(
    entries.filter(Boolean) as Array<readonly [string, OfflinePackPlaceDetail]>,
  );
}

async function fetchWeatherSnapshot(destination: OfflinePackDestination) {
  const res = await client.api.v1.weather.forecast.get({
    query: {
      latitude: destination.latitude,
      longitude: destination.longitude,
      timezone: destination.timezone,
      forecastDays: 16,
    },
  });

  if (res.error || !res.data) {
    return null;
  }

  return {
    forecastDays: 16,
    fetchedAt: new Date().toISOString(),
    data: res.data as Record<string, unknown>,
  };
}

async function fetchCurrencySnapshot(
  destinationCurrency: string,
): Promise<OfflinePackCurrency | null> {
  const [supportedRes, ratesRes] = await Promise.all([
    client.api.v1.currency.supported.get(),
    client.api.v1.currency.rates({ base: destinationCurrency }).get(),
  ]);

  if (supportedRes.error || ratesRes.error || !ratesRes.data) {
    return null;
  }

  return {
    referenceBase: destinationCurrency.toUpperCase(),
    fetchedAt: new Date().toISOString(),
    supported: (supportedRes.data?.currencies ?? []) as SupportedCurrency[],
    rates: ensureUppercaseRates(destinationCurrency, ratesRes.data as Record<string, unknown>),
  };
}

async function prefetchImageUrls(urls: string[]) {
  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
  if (uniqueUrls.length === 0) {
    return {
      urls: [],
      prefetchedAt: new Date().toISOString(),
      failedUrls: [],
    };
  }

  const failedUrls: string[] = [];
  await Promise.all(
    uniqueUrls.map(async (url) => {
      const ok = await Image.prefetch(url, "memory-disk");
      if (!ok) {
        failedUrls.push(url);
      }
    }),
  );

  return {
    urls: uniqueUrls,
    prefetchedAt: new Date().toISOString(),
    failedUrls,
  };
}

export function getOfflinePackCounts(pack: OfflinePackData) {
  return {
    placesCount: pack.places.length,
    phrasesCount: Object.values(pack.phrasesByLanguage).reduce(
      (total, phrases) => total + phrases.length,
      0,
    ),
  };
}

export async function downloadOfflinePack(destinationId: string) {
  const [basePackRes, destinationDetail, languagesRes] = await Promise.all([
    client.api.v1["offline-pack"]({ destinationId }).get(),
    fetchDestinationDetail(destinationId),
    client.api.v1.languages.get(),
  ]);
  const basePackVersion =
    !basePackRes.error && typeof basePackRes.data?.packVersion === "number"
      ? basePackRes.data.packVersion
      : 1;

  const languages = (languagesRes.data?.languages ?? []) as LanguageListItem[];
  const destinationLanguages = dedupeById(
    (destinationDetail.destination.languages ?? [])
      .map((entry) => entry.language)
      .filter((language): language is LanguageListItem => Boolean(language)),
  );

  const places = dedupeById(
    [...destinationDetail.curatedPlaces, ...destinationDetail.otherPlaces].map(
      normalizePlaceSummary,
    ),
  );
  const placeDetails = await fetchPlaceDetails(places.map((place) => place.id));
  const placesWithDetails = places.map((place) =>
    normalizePlaceSummary(placeDetails[place.id] ?? place),
  );

  const [phrasesByLanguageEntries, weather, currency, images] = await Promise.all([
    Promise.all(
      destinationLanguages.map(async (language) => {
        const phrases = await fetchAllPhrasesForLanguage(language, destinationId);
        return [language.id, phrases] as const;
      }),
    ),
    fetchWeatherSnapshot(destinationDetail.destination),
    fetchCurrencySnapshot(destinationDetail.destination.currencyCode),
    prefetchImageUrls([
      destinationDetail.destination.imageUrl ?? "",
      ...placesWithDetails.map((place) => place.imageUrl ?? ""),
    ]),
  ]);

  const phraseLanguages = destinationLanguages.filter(
    (language) =>
      (phrasesByLanguageEntries.find(([languageId]) => languageId === language.id)?.[1].length ??
        0) > 0,
  );
  const phrasesByLanguage = Object.fromEntries(phrasesByLanguageEntries);
  const mapPlaces = placesWithDetails.map((place) =>
    placeDetailToMapPlace(
      placeDetails[place.id] ?? {
        ...place,
        websiteUrl: null,
        phoneNumber: null,
      },
    ),
  );

  const downloadedAt = new Date().toISOString();
  const pack: OfflinePackData = {
    packVersion: basePackVersion,
    downloadedAt,
    destination: destinationDetail.destination,
    curatedPlaces: destinationDetail.curatedPlaces.map(normalizePlaceSummary),
    otherPlaces: destinationDetail.otherPlaces.map(normalizePlaceSummary),
    places: placesWithDetails,
    placeDetails,
    languages: phraseLanguages.length > 0 ? phraseLanguages : languages,
    phrasesByLanguage,
    weather,
    currency,
    maps: {
      places: mapPlaces,
      offlineBaseMapAvailable: false,
      offlineNavigationAvailable: false,
    },
    images,
  };

  return pack;
}

export function useOfflinePackQuery(destinationId?: string | null) {
  return useQuery({
    queryKey: ["offline-pack-local", destinationId],
    queryFn: async () => {
      if (!destinationId) return null;
      return (await useOfflineStore
        .getState()
        .getPackData(destinationId)) as OfflinePackData | null;
    },
    enabled: Boolean(destinationId),
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export async function findOfflinePackByPlaceId(placeId: string) {
  const { packs, getPackData } = useOfflineStore.getState();
  for (const meta of packs) {
    const pack = (await getPackData(meta.destinationId)) as OfflinePackData | null;
    if (!pack) continue;
    if (pack.placeDetails[placeId] || pack.places.some((place) => place.id === placeId)) {
      return pack;
    }
  }
  return null;
}

export function getOfflinePlaceFromPack(pack: OfflinePackData | null | undefined, placeId: string) {
  if (!pack) return null;
  return pack.placeDetails[placeId] ?? pack.places.find((place) => place.id === placeId) ?? null;
}

export function getOfflinePhrasesForLanguage(
  pack: OfflinePackData | null | undefined,
  languageId: string | null | undefined,
) {
  if (!pack || !languageId) return [];
  return pack.phrasesByLanguage[languageId] ?? [];
}

export function buildOfflineCurrencyTable(
  pack: OfflinePackData | null | undefined,
  baseCode: string,
) {
  if (!pack?.currency) return {};
  const normalizedBase = baseCode.toUpperCase();
  const referenceRates = pack.currency.rates;
  const baseRate = referenceRates[normalizedBase];
  if (!baseRate) return {};

  const converted: Record<string, number> = {};
  for (const [quoteCode, quoteRate] of Object.entries(referenceRates)) {
    converted[quoteCode] = quoteRate / baseRate;
  }
  converted[normalizedBase] = 1;
  return converted;
}

export function sliceOfflineWeatherData(
  pack: OfflinePackData | null | undefined,
  forecastDays: number,
) {
  if (!pack?.weather?.data) return null;
  const payload = pack.weather.data as Record<string, unknown>;
  const dailyRaw = payload.daily;
  if (!dailyRaw || typeof dailyRaw !== "object") {
    return payload;
  }

  const daily = dailyRaw as Record<string, unknown>;
  const slicedDaily = Object.fromEntries(
    Object.entries(daily).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.slice(0, forecastDays) : value,
    ]),
  );

  return {
    ...payload,
    daily: slicedDaily,
  };
}

export function buildOfflineMapSession(
  pack: OfflinePackData,
  options?: Partial<
    Pick<
      MapSession,
      | "focusLatitude"
      | "focusLongitude"
      | "focusZoomLevel"
      | "focusPlaceId"
      | "returnHref"
      | "startWithCuratedPlacesOnly"
    >
  >,
): MapSession {
  return {
    destinationId: pack.destination.id,
    destinationName: pack.destination.name,
    latitude: pack.destination.latitude,
    longitude: pack.destination.longitude,
    timezone: pack.destination.timezone,
    places: pack.maps.places,
    focusLatitude: options?.focusLatitude ?? null,
    focusLongitude: options?.focusLongitude ?? null,
    focusZoomLevel: options?.focusZoomLevel ?? null,
    focusPlaceId: options?.focusPlaceId ?? null,
    returnHref: options?.returnHref ?? null,
    startWithCuratedPlacesOnly: options?.startWithCuratedPlacesOnly,
  };
}

export function normalizeOfflineTripItems(
  items: Array<OfflineTripItineraryItem | Record<string, unknown>>,
) {
  return items.map((item, index) => ({
    id:
      typeof item.id === "string" && item.id.length > 0
        ? item.id
        : `offline-item:${Date.now()}:${index}`,
    tripId: String(item.tripId ?? ""),
    title: String(item.title ?? "Untitled item"),
    notes: typeof item.notes === "string" ? item.notes : null,
    date: (item.date as string | Date) ?? new Date().toISOString(),
    startTime: typeof item.startTime === "string" ? item.startTime : null,
    endTime: typeof item.endTime === "string" ? item.endTime : null,
    order: typeof item.order === "number" ? item.order : index,
    isDone: Boolean(item.isDone),
    placeId: typeof item.placeId === "string" ? item.placeId : null,
  }));
}
