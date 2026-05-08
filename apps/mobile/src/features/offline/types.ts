import type { PhraseItem, LanguageListItem } from "@/features/language-guide/types";
import type { MapSessionPlace } from "@/store/mapSessionStore";

export type OfflinePackDestinationLanguage = {
  id: string;
  isPrimary: boolean;
  language: LanguageListItem;
};

export type OfflinePackDestination = {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  region: string | null;
  description: string | null;
  timezone: string;
  currencyCode: string;
  bestTimeToVisit: string | null;
  emergencyNumber: string | null;
  imageUrl: string | null;
  kind: string | null;
  latitude: number;
  longitude: number;
  languages: OfflinePackDestinationLanguage[];
};

export type OfflinePackPlaceSummary = {
  id: string;
  destinationId: string;
  name: string;
  category: string;
  description: string | null;
  rating: number | null;
  reviewCount: number | null;
  imageUrl: string | null;
  isCurated: boolean;
  isFeatured: boolean;
  priceLevel: number | null;
  address: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  openingHours?: unknown | null;
};

export type OfflinePackPlaceDetail = OfflinePackPlaceSummary & {
  websiteUrl: string | null;
  phoneNumber: string | null;
};

export type OfflinePackPhrasesByLanguage = Record<string, PhraseItem[]>;

export type OfflinePackWeather = {
  forecastDays: number;
  fetchedAt: string;
  data: Record<string, unknown>;
};

export type OfflinePackCurrency = {
  referenceBase: string;
  fetchedAt: string;
  supported: Array<{ code: string; name: string; country: string }>;
  rates: Record<string, number>;
};

export type OfflinePackBaseMapRegion = {
  packName: string;
  styleUrl: string;
  bounds: [[number, number], [number, number]];
  minZoom: number;
  maxZoom: number;
  downloadedAt: string;
  completedTileCount: number;
  completedResourceCount: number;
  completedResourceSize: number;
};

export type OfflinePackMaps = {
  places: MapSessionPlace[];
  offlineBaseMapAvailable: boolean;
  offlineNavigationAvailable: boolean;
  baseMapRegion: OfflinePackBaseMapRegion | null;
};

export type OfflinePackImages = {
  urls: string[];
  prefetchedAt: string;
  failedUrls: string[];
};

export type OfflinePackData = {
  packVersion: number;
  downloadedAt: string;
  destination: OfflinePackDestination;
  curatedPlaces: OfflinePackPlaceSummary[];
  otherPlaces: OfflinePackPlaceSummary[];
  places: OfflinePackPlaceSummary[];
  placeDetails: Record<string, OfflinePackPlaceDetail>;
  languages: LanguageListItem[];
  phrasesByLanguage: OfflinePackPhrasesByLanguage;
  weather: OfflinePackWeather | null;
  currency: OfflinePackCurrency | null;
  maps: OfflinePackMaps;
  images: OfflinePackImages;
};

export type OfflineTripItineraryItem = {
  id: string;
  tripId: string;
  title: string;
  notes: string | null;
  date: string | Date;
  startTime: string | null;
  endTime: string | null;
  order: number;
  isDone: boolean;
  placeId: string | null;
};
