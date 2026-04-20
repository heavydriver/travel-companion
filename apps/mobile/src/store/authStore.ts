import { create } from "zustand";
import type { AuthUser } from "@/types/auth";
import { storage } from "@/lib/storage";

const AUTH_STORAGE_KEY = "travel_companion_auth";

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  /** Long-lived token for refresh; persisted for React Native (no cookie jar). */
  refreshToken: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  login: (payload: {
    user: AuthUser;
    accessToken: string;
    refreshToken?: string | null;
  }) => Promise<void>;
  logout: () => Promise<void>;
  hydrateFromStorage: () => Promise<void>;
};

type PersistedAuthState = Pick<
  AuthState,
  "user" | "accessToken" | "refreshToken" | "isAuthenticated"
>;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isHydrated: false,
  login: async ({ user, accessToken, refreshToken: nextRefresh }) => {
    const refreshToken =
      nextRefresh !== undefined && nextRefresh !== null
        ? nextRefresh
        : get().refreshToken;
    const value: PersistedAuthState = {
      user,
      accessToken,
      refreshToken,
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
      refreshToken: null,
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
          refreshToken: parsed.refreshToken ?? null,
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
      refreshToken: null,
      isAuthenticated: false,
      isHydrated: true,
    });
  },
}));
