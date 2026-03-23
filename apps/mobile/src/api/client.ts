import { treaty } from "@elysiajs/eden";
import type { App } from "@repo/api/src/app";
import { createEdenTanStackQuery } from "eden-tanstack-react-query";
import type { AuthUser } from "@/types/auth";
import { useAuthStore } from "@/store/authStore";

export const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://10.0.2.2:3000";

export const client = treaty<App>(apiBaseUrl, {
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
};
