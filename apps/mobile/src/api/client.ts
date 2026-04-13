import { treaty } from "@elysiajs/eden";
import type { App } from "@repo/api/src/app";
import { createEdenTanStackQuery } from "eden-tanstack-react-query";
import type { AuthUser } from "@/types/auth";
import { useAuthStore } from "@/store/authStore";

export const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://10.0.2.2:3000";

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function tryRefreshToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return null;
      const data = await res.json();
      const newToken = data?.accessToken;
      if (typeof newToken === "string") {
        const store = useAuthStore.getState();
        if (store.user) {
          await store.login({ user: store.user, accessToken: newToken });
        }
        return newToken;
      }
      return null;
    } catch {
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export const client = treaty<App>(apiBaseUrl, {
  headers() {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      return { authorization: `Bearer ${token}` };
    }
    return {};
  },
  async onResponse(response) {
    if (response.status === 401) {
      const newToken = await tryRefreshToken();
      if (!newToken) {
        await useAuthStore.getState().logout();
      }
    }
  },
});

export const { EdenProvider, useEden, useEdenClient } =
  createEdenTanStackQuery<App>();

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
};
