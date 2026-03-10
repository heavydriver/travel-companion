import { create } from "zustand";
import { storage } from "@/lib/storage";

const UI_STORAGE_KEY = "travel_companion_ui";

type UiState = {
  hasSeenOnboarding: boolean;
  isHydrated: boolean;
  setHasSeenOnboarding: (value: boolean) => Promise<void>;
  hydrateFromStorage: () => Promise<void>;
};

type PersistedUiState = Pick<UiState, "hasSeenOnboarding">;

export const useUiStore = create<UiState>((set) => ({
  hasSeenOnboarding: false,
  isHydrated: false,
  setHasSeenOnboarding: async (value) => {
    const nextState: PersistedUiState = {
      hasSeenOnboarding: value,
    };
    await storage.setItem(UI_STORAGE_KEY, JSON.stringify(nextState));
    set(nextState);
  },
  hydrateFromStorage: async () => {
    try {
      const raw = await storage.getItem(UI_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedUiState;
        set({
          hasSeenOnboarding: Boolean(parsed.hasSeenOnboarding),
          isHydrated: true,
        });
        return;
      }
    } catch {
      // Ignore malformed storage and default to first-run behavior.
    }

    set({
      hasSeenOnboarding: false,
      isHydrated: true,
    });
  },
}));
