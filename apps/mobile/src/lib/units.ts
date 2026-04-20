export type UnitSystem = "metric" | "imperial";

export function formatTempFromC(c: number | null | undefined, system: UnitSystem): string {
  if (c == null || !Number.isFinite(c)) return "—";
  if (system === "metric") return `${c.toFixed(0)}°C`;
  const f = (c * 9) / 5 + 32;
  return `${f.toFixed(0)}°F`;
}

export function formatDistanceFromKm(km: number, system: UnitSystem): string {
  if (!Number.isFinite(km)) return "—";
  if (system === "metric") return `${km.toFixed(1)} km`;
  const mi = km * 0.621371;
  return `${mi.toFixed(1)} mi`;
}
