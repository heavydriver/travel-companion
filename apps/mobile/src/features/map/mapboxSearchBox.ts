const MAPBOX_SEARCH_BOX_BASE_URL = "https://api.mapbox.com/search/searchbox/v1";

type RawMapboxSearchSuggestion = {
  mapbox_id?: unknown;
  name?: unknown;
  feature_type?: unknown;
  full_address?: unknown;
  place_formatted?: unknown;
  address?: unknown;
  maki?: unknown;
  distance?: unknown;
};

type RawMapboxSearchSuggestionResponse = {
  suggestions?: unknown;
};

type RawMapboxSearchRetrieveFeature = {
  geometry?: {
    coordinates?: unknown;
  };
  properties?: {
    mapbox_id?: unknown;
    name?: unknown;
    feature_type?: unknown;
    full_address?: unknown;
    place_formatted?: unknown;
    address?: unknown;
    poi_category?: unknown;
  };
};

type RawMapboxSearchRetrieveResponse = {
  features?: unknown;
};

export type MapboxSearchBoxSuggestion = {
  mapboxId: string;
  name: string;
  featureType: string;
  fullAddress: string | null;
  placeFormatted: string | null;
  address: string | null;
  maki: string | null;
  distanceMeters: number | null;
};

export type MapboxSearchBoxFeature = {
  mapboxId: string;
  name: string;
  featureType: string;
  fullAddress: string | null;
  placeFormatted: string | null;
  address: string | null;
  poiCategory: string | null;
  coordinate: [number, number];
};

function getMapboxSearchAccessToken(): string {
  const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("Missing Mapbox access token");
  return token;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readOptionalStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => readOptionalString(item))
    .filter((item): item is string => item != null);
}

export function formatMapboxPoiCategory(value: string | null): string | null {
  if (!value) return null;
  return value
    .split(/[,_/]+|\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeMapboxSuggestion(
  raw: RawMapboxSearchSuggestion,
): MapboxSearchBoxSuggestion | null {
  const mapboxId = readOptionalString(raw.mapbox_id);
  const name = readOptionalString(raw.name);
  const featureType = readOptionalString(raw.feature_type);
  if (!mapboxId || !name || !featureType) return null;

  return {
    mapboxId,
    name,
    featureType,
    fullAddress: readOptionalString(raw.full_address),
    placeFormatted: readOptionalString(raw.place_formatted),
    address: readOptionalString(raw.address),
    maki: readOptionalString(raw.maki),
    distanceMeters: typeof raw.distance === "number" ? raw.distance : null,
  };
}

function normalizeMapboxFeature(raw: RawMapboxSearchRetrieveFeature): MapboxSearchBoxFeature | null {
  const props = raw.properties;
  const coords = raw.geometry?.coordinates;
  const mapboxId = readOptionalString(props?.mapbox_id);
  const name = readOptionalString(props?.name);
  const featureType = readOptionalString(props?.feature_type);
  if (!mapboxId || !name || !featureType) return null;
  if (!Array.isArray(coords) || coords.length < 2) return null;

  const lng = coords[0];
  const lat = coords[1];
  if (typeof lng !== "number" || typeof lat !== "number") return null;

  return {
    mapboxId,
    name,
    featureType,
    fullAddress: readOptionalString(props?.full_address),
    placeFormatted: readOptionalString(props?.place_formatted),
    address: readOptionalString(props?.address),
    poiCategory: formatMapboxPoiCategory(
      readOptionalString(props?.poi_category) ?? readOptionalStringArray(props?.poi_category)[0] ?? null,
    ),
    coordinate: [lng, lat],
  };
}

export function createMapboxSearchSessionToken(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `mapbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatMapboxSearchSubtitle(
  value: Pick<MapboxSearchBoxSuggestion, "address" | "fullAddress" | "placeFormatted">,
): string {
  return value.fullAddress ?? [value.address, value.placeFormatted].filter(Boolean).join(", ");
}

export function mapboxFeatureZoom(featureType: string): number {
  switch (featureType) {
    case "country":
      return 4.6;
    case "region":
      return 6.4;
    case "district":
      return 8.6;
    case "place":
    case "city":
    case "locality":
      return 11.2;
    case "neighborhood":
    case "street":
      return 13.2;
    case "poi":
    case "address":
      return 15.2;
    default:
      return 12;
  }
}

export async function fetchMapboxSearchSuggestions(args: {
  query: string;
  sessionToken: string;
  proximity?: [number, number] | null;
  language?: string | null;
  limit?: number;
}): Promise<MapboxSearchBoxSuggestion[]> {
  const query = args.query.trim();
  if (!query) return [];

  const params = new URLSearchParams({
    q: query,
    session_token: args.sessionToken,
    access_token: getMapboxSearchAccessToken(),
    limit: String(args.limit ?? 6),
    types: "country,region,district,place,city,locality,neighborhood,street,address,poi",
  });

  if (args.language?.trim()) params.set("language", args.language.trim());
  if (args.proximity) {
    params.set("proximity", `${args.proximity[0]},${args.proximity[1]}`);
  }

  const response = await fetch(`${MAPBOX_SEARCH_BOX_BASE_URL}/suggest?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Mapbox suggest failed (${response.status})`);
  }

  const data = (await response.json()) as RawMapboxSearchSuggestionResponse;
  const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
  return suggestions
    .map((item) => normalizeMapboxSuggestion(item as RawMapboxSearchSuggestion))
    .filter((item): item is MapboxSearchBoxSuggestion => item != null);
}

export async function retrieveMapboxSearchFeature(args: {
  mapboxId: string;
  sessionToken: string;
  language?: string | null;
}): Promise<MapboxSearchBoxFeature | null> {
  const params = new URLSearchParams({
    session_token: args.sessionToken,
    access_token: getMapboxSearchAccessToken(),
  });
  if (args.language?.trim()) params.set("language", args.language.trim());

  const response = await fetch(
    `${MAPBOX_SEARCH_BOX_BASE_URL}/retrieve/${encodeURIComponent(args.mapboxId)}?${params.toString()}`,
  );
  if (!response.ok) {
    throw new Error(`Mapbox retrieve failed (${response.status})`);
  }

  const data = (await response.json()) as RawMapboxSearchRetrieveResponse;
  const features = Array.isArray(data.features) ? data.features : [];
  for (const feature of features) {
    const normalized = normalizeMapboxFeature(feature as RawMapboxSearchRetrieveFeature);
    if (normalized) return normalized;
  }
  return null;
}

export async function reverseMapboxSearchByCoordinate(args: {
  coordinate: [number, number];
  language?: string | null;
  limit?: number;
}): Promise<MapboxSearchBoxFeature[]> {
  const params = new URLSearchParams({
    longitude: String(args.coordinate[0]),
    latitude: String(args.coordinate[1]),
    access_token: getMapboxSearchAccessToken(),
    limit: String(args.limit ?? 5),
  });
  if (args.language?.trim()) params.set("language", args.language.trim());

  const response = await fetch(`${MAPBOX_SEARCH_BOX_BASE_URL}/reverse?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Mapbox reverse failed (${response.status})`);
  }

  const data = (await response.json()) as RawMapboxSearchRetrieveResponse;
  const features = Array.isArray(data.features) ? data.features : [];
  return features
    .map((feature) => normalizeMapboxFeature(feature as RawMapboxSearchRetrieveFeature))
    .filter((feature): feature is MapboxSearchBoxFeature => feature != null);
}
