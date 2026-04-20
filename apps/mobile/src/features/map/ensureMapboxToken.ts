import Mapbox from "@rnmapbox/maps";

let configured: string | null | undefined;

export function ensureMapboxToken(): boolean {
  const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
  if (!token) return false;
  if (configured === token) return true;
  void Mapbox.setAccessToken(token);
  configured = token;
  return true;
}
