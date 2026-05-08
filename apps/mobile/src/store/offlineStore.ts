import { create } from "zustand";
import { queryClient } from "@/lib/queryClient";
import { fileStorage, storage } from "@/lib/storage";

const OFFLINE_PACKS_KEY = "travel_companion_offline_packs";

function getOfflinePackStorageKey(destinationId: string) {
  return `offline_pack_${destinationId}`;
}

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
    set({ packs: updated, downloading: null });
    queryClient.setQueryData(["offline-pack-local", pack.destinationId], data);
    void storage.setItem(OFFLINE_PACKS_KEY, JSON.stringify(updated));
    void fileStorage.setItem(getOfflinePackStorageKey(pack.destinationId), JSON.stringify(data));
  },

  removePack: async (destinationId) => {
    const updated = get().packs.filter((p) => p.destinationId !== destinationId);
    set({ packs: updated });
    queryClient.setQueryData(["offline-pack-local", destinationId], null);
    void storage.setItem(OFFLINE_PACKS_KEY, JSON.stringify(updated));
    void fileStorage.removeItem(getOfflinePackStorageKey(destinationId));
    void storage.removeItem(getOfflinePackStorageKey(destinationId));
  },

  getPackData: async (destinationId) => {
    try {
      const storageKey = getOfflinePackStorageKey(destinationId);
      const raw = await fileStorage.getItem(storageKey);
      if (raw) {
        return JSON.parse(raw);
      }

      const legacyRaw = await storage.getItem(storageKey);
      if (!legacyRaw) {
        return null;
      }

      void fileStorage.setItem(storageKey, legacyRaw);
      void storage.removeItem(storageKey);
      return JSON.parse(legacyRaw);
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
