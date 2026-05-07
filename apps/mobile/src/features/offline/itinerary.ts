import { queryClient } from "@/lib/queryClient";
import { useOfflineItineraryStore } from "@/store/offlineItineraryStore";
import type { OfflineTripItineraryItem } from "./types";

function sortItems(items: OfflineTripItineraryItem[]) {
  return [...items].sort((a, b) => {
    const aDate = new Date(String(a.date)).getTime();
    const bDate = new Date(String(b.date)).getTime();
    if (aDate !== bDate) return aDate - bDate;
    return a.order - b.order;
  });
}

function syncQueryCache(tripId: string, items: OfflineTripItineraryItem[]) {
  queryClient.setQueryData(["itinerary", tripId], { items: sortItems(items) });
}

export async function seedOfflineTripItinerary(
  tripId: string,
  items: OfflineTripItineraryItem[],
) {
  await useOfflineItineraryStore.getState().seedTripItems(tripId, items);
  const seeded = useOfflineItineraryStore.getState().getTripItems(tripId) ?? items;
  syncQueryCache(tripId, seeded);
  return seeded;
}

export async function replaceOfflineTripItinerary(
  tripId: string,
  items: OfflineTripItineraryItem[],
) {
  const sorted = sortItems(items);
  await useOfflineItineraryStore.getState().replaceTripItems(tripId, sorted);
  syncQueryCache(tripId, sorted);
  return sorted;
}

export async function addOfflineTripItem(
  tripId: string,
  input: Omit<OfflineTripItineraryItem, "id" | "order"> & { id?: string; order?: number },
) {
  const current = useOfflineItineraryStore.getState().getTripItems(tripId) ?? [];
  const nextItem: OfflineTripItineraryItem = {
    ...input,
    id: input.id ?? `offline-item:${tripId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    order: input.order ?? current.length,
  };
  const next = sortItems([...current, nextItem]).map((item, index) => ({ ...item, order: index }));
  await useOfflineItineraryStore.getState().replaceTripItems(tripId, next);
  syncQueryCache(tripId, next);
  return nextItem;
}

export async function updateOfflineTripItem(
  tripId: string,
  itemId: string,
  patch: Partial<OfflineTripItineraryItem>,
) {
  const current = useOfflineItineraryStore.getState().getTripItems(tripId) ?? [];
  const next = sortItems(
    current.map((item, index) =>
      item.id === itemId ? { ...item, ...patch, order: patch.order ?? item.order ?? index } : item,
    ),
  ).map((item, index) => ({ ...item, order: index }));
  await useOfflineItineraryStore.getState().replaceTripItems(tripId, next);
  syncQueryCache(tripId, next);
  return next.find((item) => item.id === itemId) ?? null;
}

export async function deleteOfflineTripItem(tripId: string, itemId: string) {
  const current = useOfflineItineraryStore.getState().getTripItems(tripId) ?? [];
  const next = current
    .filter((item) => item.id !== itemId)
    .map((item, index) => ({ ...item, order: index }));
  await useOfflineItineraryStore.getState().replaceTripItems(tripId, next);
  syncQueryCache(tripId, next);
  return next;
}

export function hasOfflineTripPlace(tripId: string, placeId: string) {
  const current = useOfflineItineraryStore.getState().getTripItems(tripId) ?? [];
  return current.some((item) => item.placeId === placeId);
}
