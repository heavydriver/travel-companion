import { create } from "zustand";
import { storage } from "@/lib/storage";
import type { UnitSystem } from "@/lib/units";

const PREFERENCES_STORAGE_KEY = "travel_companion_preferences";

type PreferencesState = {
  unitSystem: UnitSystem;
  isHydrated: boolean;
  setUnitSystem: (value: UnitSystem) => Promise<void>;
  hydrateFromStorage: () => Promise<void>;
};

type PersistedPreferences = Pick<PreferencesState, "unitSystem">;

export const usePreferencesStore = create<PreferencesState>((set) => ({
  unitSystem: "metric",
  isHydrated: false,
  setUnitSystem: async (value) => {
    const next: PersistedPreferences = { unitSystem: value };
    await storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
    set(next);
  },
  hydrateFromStorage: async () => {
    try {
      const raw = await storage.getItem(PREFERENCES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedPreferences>;
        const unitSystem = parsed.unitSystem === "imperial" ? "imperial" : "metric";
        set({ unitSystem, isHydrated: true });
        return;
      }
    } catch {
      // ignore
    }
    set({ unitSystem: "metric", isHydrated: true });
  },
}));
