import { create } from "zustand";
import { storage } from "@/lib/storage";
import type { UnitSystem } from "@/lib/units";

const PREFERENCES_STORAGE_KEY = "travel_companion_preferences";

export type ThemePreference = "system" | "light" | "dark";

type PreferencesState = {
  unitSystem: UnitSystem;
  themePreference: ThemePreference;
  isHydrated: boolean;
  setUnitSystem: (value: UnitSystem) => Promise<void>;
  setThemePreference: (value: ThemePreference) => Promise<void>;
  hydrateFromStorage: () => Promise<void>;
};

type PersistedPreferences = Pick<PreferencesState, "unitSystem" | "themePreference">;

function getValidThemePreference(value: unknown): ThemePreference {
  if (value === "light" || value === "dark" || value === "system") return value;
  return "system";
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  unitSystem: "metric",
  themePreference: "system",
  isHydrated: false,
  setUnitSystem: async (value) => {
    const next: PersistedPreferences = {
      unitSystem: value,
      themePreference: get().themePreference,
    };
    await storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
    set({ unitSystem: next.unitSystem });
  },
  setThemePreference: async (value) => {
    const next: PersistedPreferences = {
      unitSystem: get().unitSystem,
      themePreference: value,
    };
    await storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
    set({ themePreference: next.themePreference });
  },
  hydrateFromStorage: async () => {
    try {
      const raw = await storage.getItem(PREFERENCES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedPreferences>;
        const unitSystem = parsed.unitSystem === "imperial" ? "imperial" : "metric";
        const themePreference = getValidThemePreference(parsed.themePreference);
        set({ unitSystem, themePreference, isHydrated: true });
        return;
      }
    } catch {
      // ignore
    }
    set({ unitSystem: "metric", themePreference: "system", isHydrated: true });
  },
}));
