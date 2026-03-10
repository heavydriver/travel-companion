import { create } from "zustand";
import type { AuthUser } from "@/types/auth";
import { storage } from "@/lib/storage";

const AUTH_STORAGE_KEY = "travel_companion_auth";

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  login: (payload: { user: AuthUser; accessToken: string }) => Promise<void>;
  logout: () => Promise<void>;
  hydrateFromStorage: () => Promise<void>;
};

type PersistedAuthState = Pick<AuthState, "user" | "accessToken" | "isAuthenticated">;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isHydrated: false,
  login: async ({ user, accessToken }) => {
    const value: PersistedAuthState = {
      user,
      accessToken,
      isAuthenticated: true,
    };
    await storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value));
    set(value);
  },
  logout: async () => {
    await storage.removeItem(AUTH_STORAGE_KEY);
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    });
  },
  hydrateFromStorage: async () => {
    try {
      const raw = await storage.getItem(AUTH_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedAuthState;
        set({
          user: parsed.user ?? null,
          accessToken: parsed.accessToken ?? null,
          isAuthenticated: Boolean(parsed.accessToken),
          isHydrated: true,
        });
        return;
      }
    } catch {
      // Ignore malformed storage and fall back to signed-out state.
    }

    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isHydrated: true,
    });
  },
}));
