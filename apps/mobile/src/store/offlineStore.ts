import { create } from "zustand";
import { storage } from "@/lib/storage";

const OFFLINE_PACKS_KEY = "travel_companion_offline_packs";

export type OfflinePack = {
  destinationId: string;
  destinationName: string;
  country: string;
  countryCode: string;
  packVersion: number;
  downloadedAt: string;
  placesCount: number;
  phrasesCount: number;
};

type OfflineState = {
  packs: OfflinePack[];
  downloading: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  savePack: (pack: OfflinePack, data: unknown) => Promise<void>;
  removePack: (destinationId: string) => Promise<void>;
  getPackData: (destinationId: string) => Promise<unknown | null>;
  isDownloaded: (destinationId: string) => boolean;
  getPackMeta: (destinationId: string) => OfflinePack | undefined;
  setDownloading: (destinationId: string | null) => void;
};

export const useOfflineStore = create<OfflineState>((set, get) => ({
  packs: [],
  downloading: null,
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await storage.getItem(OFFLINE_PACKS_KEY);
      if (raw) {
        set({ packs: JSON.parse(raw), hydrated: true });
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },

  savePack: async (pack, data) => {
    const current = get().packs.filter((p) => p.destinationId !== pack.destinationId);
    const updated = [...current, pack];
    await storage.setItem(OFFLINE_PACKS_KEY, JSON.stringify(updated));
    await storage.setItem(`offline_pack_${pack.destinationId}`, JSON.stringify(data));
    set({ packs: updated, downloading: null });
  },

  removePack: async (destinationId) => {
    const updated = get().packs.filter((p) => p.destinationId !== destinationId);
    await storage.setItem(OFFLINE_PACKS_KEY, JSON.stringify(updated));
    await storage.removeItem(`offline_pack_${destinationId}`);
    set({ packs: updated });
  },

  getPackData: async (destinationId) => {
    try {
      const raw = await storage.getItem(`offline_pack_${destinationId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  isDownloaded: (destinationId) => {
    return get().packs.some((p) => p.destinationId === destinationId);
  },

  getPackMeta: (destinationId) => {
    return get().packs.find((p) => p.destinationId === destinationId);
  },

  setDownloading: (destinationId) => set({ downloading: destinationId }),
}));
