import { create } from "zustand";
import { storage } from "@/lib/storage";
import type { OfflineTripItineraryItem } from "@/features/offline/types";

const OFFLINE_ITINERARY_KEY = "travel_companion_offline_itineraries";

type OfflineItineraryState = {
  hydrated: boolean;
  tripItems: Record<string, OfflineTripItineraryItem[]>;
  hydrate: () => Promise<void>;
  getTripItems: (tripId: string) => OfflineTripItineraryItem[] | undefined;
  seedTripItems: (tripId: string, items: OfflineTripItineraryItem[]) => Promise<void>;
  replaceTripItems: (tripId: string, items: OfflineTripItineraryItem[]) => Promise<void>;
  upsertTripItem: (tripId: string, item: OfflineTripItineraryItem) => Promise<void>;
  removeTripItem: (tripId: string, itemId: string) => Promise<void>;
};

async function persistTripItems(tripItems: Record<string, OfflineTripItineraryItem[]>) {
  await storage.setItem(OFFLINE_ITINERARY_KEY, JSON.stringify(tripItems));
}

function normalizeTripItems(items: OfflineTripItineraryItem[]) {
  return [...items].sort((a, b) => {
    const dateDiff = new Date(String(a.date)).getTime() - new Date(String(b.date)).getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.order - b.order;
  });
}

export const useOfflineItineraryStore = create<OfflineItineraryState>((set, get) => ({
  hydrated: false,
  tripItems: {},

  hydrate: async () => {
    try {
      const raw = await storage.getItem(OFFLINE_ITINERARY_KEY);
      set({
        hydrated: true,
        tripItems: raw ? (JSON.parse(raw) as Record<string, OfflineTripItineraryItem[]>) : {},
      });
    } catch {
      set({ hydrated: true, tripItems: {} });
    }
  },

  getTripItems: (tripId) => get().tripItems[tripId],

  seedTripItems: async (tripId, items) => {
    const current = get().tripItems[tripId];
    if (current && current.length > 0) {
      return;
    }
    const next = {
      ...get().tripItems,
      [tripId]: normalizeTripItems(items),
    };
    set({ tripItems: next });
    void persistTripItems(next);
  },

  replaceTripItems: async (tripId, items) => {
    const next = {
      ...get().tripItems,
      [tripId]: normalizeTripItems(items),
    };
    set({ tripItems: next });
    void persistTripItems(next);
  },

  upsertTripItem: async (tripId, item) => {
    const current = get().tripItems[tripId] ?? [];
    const filtered = current.filter((entry) => entry.id !== item.id);
    const next = {
      ...get().tripItems,
      [tripId]: normalizeTripItems([...filtered, item]),
    };
    set({ tripItems: next });
    void persistTripItems(next);
  },

  removeTripItem: async (tripId, itemId) => {
    const current = get().tripItems[tripId] ?? [];
    const next = {
      ...get().tripItems,
      [tripId]: current.filter((item) => item.id !== itemId),
    };
    set({ tripItems: next });
    void persistTripItems(next);
  },
}));
