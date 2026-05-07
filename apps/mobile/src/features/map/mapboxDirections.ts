const MAPBOX_DIRECTIONS_BASE_URL = "https://api.mapbox.com/directions/v5";

export type MapboxDirectionsProfile =
  | "mapbox/driving-traffic"
  | "mapbox/walking"
  | "mapbox/cycling";

type RawDirectionsResponse = {
  routes?: unknown;
  message?: unknown;
};

type RawDirectionsRoute = {
  geometry?: unknown;
  distance?: unknown;
  duration?: unknown;
  legs?: unknown;
};

export type MapboxRoutePreview = {
  distanceMeters: number;
  durationSeconds: number;
  geometry: GeoJSON.LineString;
  legCount: number;
};

function getMapboxDirectionsAccessToken(): string {
  const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("Missing Mapbox access token");
  return token;
}

function isCoordinate(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  );
}

function normalizeRouteGeometry(value: unknown): GeoJSON.LineString | null {
  if (!value || typeof value !== "object") return null;
  const geometry = value as { type?: unknown; coordinates?: unknown };
  if (geometry.type !== "LineString" || !Array.isArray(geometry.coordinates)) return null;

  const coordinates = geometry.coordinates.filter(isCoordinate);
  if (coordinates.length < 2) return null;

  return {
    type: "LineString",
    coordinates,
  };
}

function normalizeRoute(route: RawDirectionsRoute): MapboxRoutePreview | null {
  const geometry = normalizeRouteGeometry(route.geometry);
  if (!geometry) return null;

  const distanceMeters = typeof route.distance === "number" ? route.distance : null;
  const durationSeconds = typeof route.duration === "number" ? route.duration : null;
  if (distanceMeters == null || durationSeconds == null) return null;

  return {
    distanceMeters,
    durationSeconds,
    geometry,
    legCount: Array.isArray(route.legs) ? route.legs.length : 0,
  };
}

export async function fetchMapboxRoutePreview(args: {
  coordinates: Array<[number, number]>;
  profile: MapboxDirectionsProfile;
  language?: string | null;
  signal?: AbortSignal;
}): Promise<MapboxRoutePreview> {
  if (args.coordinates.length < 2) {
    throw new Error("At least an origin and destination are required");
  }

  const coordinatePath = args.coordinates.map((item) => `${item[0]},${item[1]}`).join(";");
  const params = new URLSearchParams({
    access_token: getMapboxDirectionsAccessToken(),
    alternatives: "false",
    geometries: "geojson",
    overview: "full",
    steps: "true",
    voice_instructions: "true",
    banner_instructions: "true",
  });

  if (args.language?.trim()) {
    params.set("language", args.language.trim());
  }

  const response = await fetch(
    `${MAPBOX_DIRECTIONS_BASE_URL}/${args.profile}/${coordinatePath}?${params.toString()}`,
    { signal: args.signal },
  );

  if (!response.ok) {
    let apiMessage = "";
    try {
      const data = (await response.json()) as RawDirectionsResponse;
      apiMessage = typeof data.message === "string" ? data.message : "";
    } catch {
      apiMessage = "";
    }
    throw new Error(apiMessage || `Mapbox directions failed (${response.status})`);
  }

  const data = (await response.json()) as RawDirectionsResponse;
  const routes = Array.isArray(data.routes) ? data.routes : [];
  for (const route of routes) {
    const normalized = normalizeRoute(route as RawDirectionsRoute);
    if (normalized) return normalized;
  }

  throw new Error("No route returned by Mapbox");
}
