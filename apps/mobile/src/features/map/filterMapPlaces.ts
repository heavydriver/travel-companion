import type { MapSessionPlace } from "@/store/mapSessionStore";
import { computeIsOpenNow } from "./openNow";

export function deriveCategories(places: MapSessionPlace[]): string[] {
  const set = new Set<string>();
  for (const p of places) {
    const c = p.category.trim();
    if (c) set.add(c);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export type MapFilterControls = {
  search: string;
  selectedCategories: Set<string>;
  minRating: number | null;
  curatedOnly: boolean;
  openNowOnly: boolean;
  itineraryOnly: boolean;
  itineraryPlaceIds: Set<string>;
  destinationTimezone: string | null;
  now: Date;
};

export function applyMapFilters(places: MapSessionPlace[], f: MapFilterControls): MapSessionPlace[] {
  let out = places;
  const q = f.search.trim().toLowerCase();
  if (q) {
    out = out.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false) ||
        p.category.toLowerCase().includes(q),
    );
  }
  // Empty set = show all categories; non-empty = only those categories
  if (f.selectedCategories.size > 0) {
    out = out.filter((p) => f.selectedCategories.has(p.category.trim()));
  }
  if (f.minRating != null) {
    const min = f.minRating;
    out = out.filter((p) => p.rating != null && p.rating >= min);
  }
  if (f.curatedOnly) {
    out = out.filter((p) => p.isCurated);
  }
  if (f.openNowOnly) {
    out = out.filter(
      (p) => computeIsOpenNow(p.openingHours ?? null, f.destinationTimezone, f.now) === true,
    );
  }
  if (f.itineraryOnly) {
    out = out.filter((p) => f.itineraryPlaceIds.has(p.id));
  }
  return out;
}
