import { treaty } from "@elysiajs/eden";
import type { App } from "@repo/api/src/app";
import { createEdenTanStackQuery } from "eden-tanstack-react-query";
import { useAuthStore } from "@/store/authStore";
import type { AuthUser } from "@/types/auth";

export const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://10.0.2.2:3000";

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function tryRefreshToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const { refreshToken, user } = useAuthStore.getState();
      if (!refreshToken || !user) return null;

      const res = await fetch(`${apiBaseUrl}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { accessToken?: unknown };
      const newToken = data?.accessToken;
      if (typeof newToken === "string") {
        await useAuthStore.getState().login({
          user,
          accessToken: newToken,
          refreshToken,
        });
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

/** One retry round-trip after refresh; prevents infinite loops if the retry still returns 401. */
const AUTH_RETRY_HEADER = "x-eden-auth-retry";

function isAuthPublicPath(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return (
      pathname.endsWith("/auth/login") ||
      pathname.endsWith("/auth/register") ||
      pathname.endsWith("/auth/google") ||
      pathname.endsWith("/auth/apple") ||
      pathname.endsWith("/auth/refresh")
    );
  } catch {
    return false;
  }
}

export function createAuthAwareFetch(): typeof globalThis.fetch {
  const impl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await fetch(input, init);
    if (response.status !== 401) {
      return response;
    }

    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    if (isAuthPublicPath(url)) {
      return response;
    }

    const { refreshToken } = useAuthStore.getState();
    if (!refreshToken) {
      return response;
    }

    const prior = new Headers(init?.headers as HeadersInit | undefined);
    if (prior.get(AUTH_RETRY_HEADER) === "1") {
      return response;
    }

    const newToken = await tryRefreshToken();
    if (!newToken) {
      await useAuthStore.getState().logout();
      return response;
    }

    const nextHeaders = new Headers(init?.headers as HeadersInit | undefined);
    nextHeaders.set("authorization", `Bearer ${newToken}`);
    nextHeaders.set(AUTH_RETRY_HEADER, "1");

    return fetch(input, {
      ...init,
      headers: nextHeaders,
    });
  };
  return impl as typeof globalThis.fetch;
}

/** Use for non-Eden requests (e.g. multipart uploads) so refresh + auth headers match the API client. */
export const authAwareFetch = createAuthAwareFetch();

/**
 * Bearer (and ngrok interstitial bypass) for raw `fetch` calls.
 * Do not set `Content-Type` when sending `FormData` — the runtime must add the multipart boundary.
 */
export function authHeadersForMultipart(): Record<string, string> {
  const token = useAuthStore.getState().accessToken;
  const headers: Record<string, string> = {};
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  if (apiBaseUrl.includes("ngrok")) {
    headers["ngrok-skip-browser-warning"] = "69420";
  }
  return headers;
}

export const client = treaty<App>(apiBaseUrl, {
  fetcher: authAwareFetch,
  headers() {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      return { authorization: `Bearer ${token}` };
    }
    return {};
  },
});

export const { EdenProvider, useEden, useEdenClient } =
  createEdenTanStackQuery<App>();

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};
