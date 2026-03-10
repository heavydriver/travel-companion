import { treaty } from "@elysiajs/eden";
import type { App } from "@repo/api/src/app";
import { createEdenTanStackQuery } from "eden-tanstack-react-query";
import type { AuthUser } from "@/types/auth";

export const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://10.0.2.2:3000";

export const { EdenProvider, useEden, useEdenClient } = createEdenTanStackQuery<App>();
export const client = treaty<App>(apiBaseUrl);

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
};
