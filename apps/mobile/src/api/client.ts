import { treaty } from "@elysiajs/eden";
import type { App } from "@repo/api/src/app";
import { createEdenTanStackQuery } from "eden-tanstack-react-query";
import { useAuthStore } from "@/store/authStore";
import type { AuthUser } from "@/types/auth";

export const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://10.0.2.2:3000";

const ACCESS_TOKEN_REFRESH_LEEWAY_MS = 60_000;
const AUTH_RETRY_HEADER = "x-eden-auth-retry";

type RefreshResult =
  | { kind: "success"; accessToken: string }
  | { kind: "missing" }
  | { kind: "invalid" }
  | { kind: "transient" };

let isRefreshing = false;
let refreshPromise: Promise<RefreshResult> | null = null;

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function mergeHeaders(
  input: RequestInfo | URL,
  init?: RequestInit
): Headers {
  const headers =
    input instanceof Request ? new Headers(input.headers) : new Headers();
  const initHeaders = new Headers(init?.headers as HeadersInit | undefined);
  initHeaders.forEach((value, key) => headers.set(key, value));
  return headers;
}

function decodeBase64Url(value: string): string | null {
  const base64Alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");

  let buffer = 0;
  let bits = 0;
  let output = "";

  for (const char of base64) {
    if (char === "=") break;
    const index = base64Alphabet.indexOf(char);
    if (index === -1) {
      return null;
    }

    buffer = (buffer << 6) | index;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  return output;
}

function decodeJwtPayload(token: string): { exp?: unknown } | null {
  const payload = token.split(".")[1];
  if (!payload) {
    return null;
  }

  try {
    const decoded = decodeBase64Url(payload);
    if (!decoded) {
      return null;
    }

    return JSON.parse(decoded) as { exp?: unknown };
  } catch {
    return null;
  }
}

function isTokenExpiringSoon(token: string | null): boolean {
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  if (typeof payload?.exp !== "number") {
    return false;
  }

  return payload.exp * 1000 - Date.now() <= ACCESS_TOKEN_REFRESH_LEEWAY_MS;
}

async function tryRefreshToken(): Promise<RefreshResult> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const { refreshToken, user } = useAuthStore.getState();
      if (!refreshToken || !user) {
        return { kind: "missing" };
      }

      const res = await fetch(`${apiBaseUrl}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ refreshToken }),
      });

      if (res.status === 401 || res.status === 403) {
        return { kind: "invalid" };
      }
      if (!res.ok) {
        return { kind: "transient" };
      }

      const data = (await res.json()) as { accessToken?: unknown };
      const newToken = data?.accessToken;
      if (typeof newToken === "string") {
        await useAuthStore.getState().login({
          user,
          accessToken: newToken,
          refreshToken,
        });
        return { kind: "success", accessToken: newToken };
      }
      return { kind: "transient" };
    } catch {
      return { kind: "transient" };
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

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

async function getUsableAccessToken(forceRefresh: boolean): Promise<RefreshResult> {
  const { accessToken, refreshToken } = useAuthStore.getState();

  if (!refreshToken) {
    return { kind: "missing" };
  }

  if (!forceRefresh && accessToken && !isTokenExpiringSoon(accessToken)) {
    return { kind: "success", accessToken };
  }

  return tryRefreshToken();
}

export function createAuthAwareFetch(): typeof globalThis.fetch {
  const impl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = getRequestUrl(input);
    const headers = mergeHeaders(input, init);
    const isPublicPath = isAuthPublicPath(url);

    if (!isPublicPath) {
      const authResult = await getUsableAccessToken(false);
      if (authResult.kind === "success") {
        headers.set("authorization", `Bearer ${authResult.accessToken}`);
      } else if (authResult.kind === "invalid") {
        headers.delete("authorization");
        await useAuthStore.getState().logout();
      }
    }

    const response = await fetch(input, {
      ...init,
      headers,
    });
    if (response.status !== 401 || isPublicPath) {
      return response;
    }

    if (!useAuthStore.getState().refreshToken) {
      return response;
    }

    if (headers.get(AUTH_RETRY_HEADER) === "1") {
      return response;
    }

    const refreshResult = await getUsableAccessToken(true);
    if (refreshResult.kind === "invalid") {
      await useAuthStore.getState().logout();
      return response;
    }
    if (refreshResult.kind !== "success") {
      return response;
    }

    const nextHeaders = mergeHeaders(input, init);
    nextHeaders.set("authorization", `Bearer ${refreshResult.accessToken}`);
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
