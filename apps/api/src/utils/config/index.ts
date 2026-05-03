import { t } from "elysia";
import { Value } from "@sinclair/typebox/value";

const EnvSchema = t.Object({
  DATABASE_URL: t.String({ minLength: 1 }),
  JWT_ACCESS_SECRET: t.String({ minLength: 16 }),
  JWT_REFRESH_SECRET: t.String({ minLength: 16 }),
  PORT: t.Optional(t.String()),
  NODE_ENV: t.Optional(
    t.Union([
      t.Literal("development"),
      t.Literal("staging"),
      t.Literal("production"),
    ])
  ),
  FRONTEND_URL: t.Optional(t.String()),
  CDN_BASE_URL: t.Optional(t.String()),
  GOOGLE_CLIENT_ID: t.Optional(t.String()),
  GOOGLE_MAPS_API_KEY: t.Optional(t.String()),
  APPLE_CLIENT_ID: t.Optional(t.String()),
  APPLE_TEAM_ID: t.Optional(t.String()),
  APPLE_KEY_ID: t.Optional(t.String()),
  POSTHOG_API_KEY: t.Optional(t.String()),
  POSTHOG_HOST: t.Optional(t.String()),
  BETTERSTACK_INGESTING_HOST: t.Optional(t.String()),
  BETTERSTACK_SOURCE_TOKEN: t.Optional(t.String()),
  OTEL_METRIC_EXPORT_INTERVAL_MS: t.Optional(t.String()),
  OTEL_METRIC_EXPORT_TIMEOUT_MS: t.Optional(t.String()),
  OTEL_SERVICE_NAME: t.Optional(t.String()),
  SERVICE_VERSION: t.Optional(t.String()),
});

function loadConfig() {
  const raw = {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    FRONTEND_URL: process.env.FRONTEND_URL,
    CDN_BASE_URL: process.env.CDN_BASE_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
    APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID,
    APPLE_TEAM_ID: process.env.APPLE_TEAM_ID,
    APPLE_KEY_ID: process.env.APPLE_KEY_ID,
    POSTHOG_API_KEY: process.env.POSTHOG_API_KEY,
    POSTHOG_HOST: process.env.POSTHOG_HOST,
    BETTERSTACK_INGESTING_HOST: process.env.BETTERSTACK_INGESTING_HOST,
    BETTERSTACK_SOURCE_TOKEN: process.env.BETTERSTACK_SOURCE_TOKEN,
    OTEL_METRIC_EXPORT_INTERVAL_MS: process.env.OTEL_METRIC_EXPORT_INTERVAL_MS,
    OTEL_METRIC_EXPORT_TIMEOUT_MS: process.env.OTEL_METRIC_EXPORT_TIMEOUT_MS,
    OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME,
    SERVICE_VERSION: process.env.SERVICE_VERSION,
  };

  if (!Value.Check(EnvSchema, raw)) {
    const errors = [...Value.Errors(EnvSchema, raw)];
    const missing = errors.map((e) => `  ${e.path}: ${e.message}`).join("\n");
    throw new Error(`Missing or invalid environment variables:\n${missing}`);
  }

  return {
    databaseUrl: raw.DATABASE_URL,
    jwtAccessSecret: raw.JWT_ACCESS_SECRET,
    jwtRefreshSecret: raw.JWT_REFRESH_SECRET,
    port: Number(raw.PORT || "3000"),
    nodeEnv: (raw.NODE_ENV || "development") as
      | "development"
      | "staging"
      | "production",
    frontendUrl: raw.FRONTEND_URL || "http://localhost:8081",
    cdnBaseUrl: raw.CDN_BASE_URL || "",
    googleClientId: raw.GOOGLE_CLIENT_ID,
    googleMapsApiKey: raw.GOOGLE_MAPS_API_KEY,
    appleClientId: raw.APPLE_CLIENT_ID,
    appleTeamId: raw.APPLE_TEAM_ID,
    appleKeyId: raw.APPLE_KEY_ID,
    posthogApiKey: raw.POSTHOG_API_KEY,
    posthogHost: raw.POSTHOG_HOST || "https://us.i.posthog.com",
    betterStackIngestingHost: raw.BETTERSTACK_INGESTING_HOST,
    betterStackSourceToken: raw.BETTERSTACK_SOURCE_TOKEN,
    otelMetricExportIntervalMs: Number(
      raw.OTEL_METRIC_EXPORT_INTERVAL_MS || "15000"
    ),
    otelMetricExportTimeoutMs: Number(
      raw.OTEL_METRIC_EXPORT_TIMEOUT_MS || "10000"
    ),
    otelServiceName: raw.OTEL_SERVICE_NAME || "travel-companion-api",
    serviceVersion:
      raw.SERVICE_VERSION || process.env.IMAGE_TAG || process.env.npm_package_version || "dev",
  } as const;
}

export const config = loadConfig();
