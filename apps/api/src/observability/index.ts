import Elysia, { StatusMap } from "elysia";
import {
  context as otelContext,
  metrics,
  SpanKind,
  SpanStatusCode,
  trace,
  type Span,
} from "@opentelemetry/api";
import { SeverityNumber, logs as otelLogs } from "@opentelemetry/api-logs";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { config } from "../utils/config";

type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

type RequestMetadata = {
  requestId: string;
  route: string;
  span?: Span;
  startedAt: number;
};

const SERVICE_NAME = config.otelServiceName || "travel-companion-api";
const SERVICE_VERSION = config.serviceVersion || "dev";
const requestState = new WeakMap<Request, RequestMetadata>();
const meter = metrics.getMeter(SERVICE_NAME, SERVICE_VERSION);
const otelLogger = otelLogs.getLogger(SERVICE_NAME, SERVICE_VERSION);

const requestsCounter = meter.createCounter("api.http.server.requests", {
  description: "Total HTTP requests served by API",
});

const requestDurationHistogram = meter.createHistogram(
  "api.http.server.duration",
  {
    description: "HTTP request duration in milliseconds",
    unit: "ms",
  }
);

const requestErrorsCounter = meter.createCounter("api.http.server.errors", {
  description: "HTTP requests that completed with an error status",
});

const activeRequestsCounter = meter.createUpDownCounter(
  "api.http.server.active_requests",
  {
    description: "In-flight HTTP requests",
  }
);

const processCrashesCounter = meter.createCounter("api.process.crashes", {
  description: "Fatal process events before exit",
});

const processUptimeGauge = meter.createObservableGauge("api.process.uptime", {
  description: "Process uptime in seconds",
  unit: "s",
});

const processMemoryGauge = meter.createObservableGauge(
  "api.process.memory.rss",
  {
    description: "Resident set size memory",
    unit: "By",
  }
);

const processHeapGauge = meter.createObservableGauge(
  "api.process.memory.heap_used",
  {
    description: "Heap memory currently used",
    unit: "By",
  }
);

const baseMetricAttributes = {
  environment: config.nodeEnv,
  service: SERVICE_NAME,
  version: SERVICE_VERSION,
};

processUptimeGauge.addCallback((observer) => {
  observer.observe(process.uptime(), baseMetricAttributes);
});

processMemoryGauge.addCallback((observer) => {
  observer.observe(process.memoryUsage().rss, baseMetricAttributes);
});

processHeapGauge.addCallback((observer) => {
  observer.observe(process.memoryUsage().heapUsed, baseMetricAttributes);
});

const betterStackConfigured = Boolean(
  config.betterStackSourceToken && config.betterStackIngestingHost
);

const betterStackPartialConfig = Boolean(
  config.betterStackSourceToken || config.betterStackIngestingHost
);

const betterStackBaseUrl = config.betterStackIngestingHost
  ? toBaseUrl(config.betterStackIngestingHost)
  : null;

const telemetrySdk = betterStackConfigured
  ? new NodeSDK({
      serviceName: SERVICE_NAME,
      resource: resourceFromAttributes({
        "deployment.environment.name": config.nodeEnv,
        "service.name": SERVICE_NAME,
        "service.version": SERVICE_VERSION,
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          "@opentelemetry/instrumentation-fs": {
            enabled: false,
          },
        }),
      ],
      traceExporter: new OTLPTraceExporter({
        headers: otlpHeaders(),
        url: `${betterStackBaseUrl}/v1/traces`,
      }),
      metricReaders: [
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({
            headers: otlpHeaders(),
            url: `${betterStackBaseUrl}/v1/metrics`,
          }),
          exportIntervalMillis: config.otelMetricExportIntervalMs,
          exportTimeoutMillis: config.otelMetricExportTimeoutMs,
        }),
      ],
      logRecordProcessors: [
        new BatchLogRecordProcessor(
          new OTLPLogExporter({
            headers: otlpHeaders(),
            url: `${betterStackBaseUrl}/v1/logs`,
          })
        ),
      ],
    })
  : null;

if (telemetrySdk) {
  telemetrySdk.start();
}

export const telemetryState = {
  betterStackConfigured,
  betterStackPartialConfig,
  serviceName: SERVICE_NAME,
  serviceVersion: SERVICE_VERSION,
};

export const observabilityPlugin = new Elysia({
  name: "observability",
})
  .wrap((handler, request) => {
    const pathname = new URL(request.url).pathname;
    const route = normalizeRoute(pathname);

    if (isHealthRoute(route)) {
      return handler;
    }

    return (...args: unknown[]) =>
      trace.getTracer(SERVICE_NAME, SERVICE_VERSION).startActiveSpan(
        `${request.method} ${route}`,
        {
          attributes: {
            "deployment.environment.name": config.nodeEnv,
            "http.method": request.method,
            "http.request.method": request.method,
            "http.route": route,
            "http.target": pathname,
            "service.name": SERVICE_NAME,
            "service.version": SERVICE_VERSION,
            "url.path": pathname,
          },
          kind: SpanKind.SERVER,
        },
        async (span) => {
          const metadata = requestState.get(request);

          requestState.set(request, {
            requestId: metadata?.requestId || crypto.randomUUID(),
            route,
            span,
            startedAt: metadata?.startedAt ?? performance.now(),
          });

          try {
            return await handler(...args);
          } catch (error) {
            span.recordException(error instanceof Error ? error : new Error(String(error)));
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error instanceof Error ? error.message : String(error),
            });

            throw error;
          }
        }
      );
  })
  .onRequest(({ request, set }) => {
    const existingMetadata = requestState.get(request);
    const metadata = {
      requestId: existingMetadata?.requestId || crypto.randomUUID(),
      route:
        existingMetadata?.route || normalizeRoute(new URL(request.url).pathname),
      span: existingMetadata?.span,
      startedAt: existingMetadata?.startedAt ?? performance.now(),
    } satisfies RequestMetadata;

    requestState.set(request, metadata);
    set.headers["x-request-id"] = metadata.requestId;

    activeRequestsCounter.add(1, {
      environment: config.nodeEnv,
      method: request.method,
    });
  })
  .onAfterResponse(({ request, set }) => {
    const metadata = requestState.get(request);
    const route =
      metadata?.route || normalizeRoute(new URL(request.url).pathname);
    const statusCode = resolveStatusCode(set.status);
    const durationMs = roundDuration(
      performance.now() - (metadata?.startedAt ?? performance.now())
    );
    const attributes = {
      environment: config.nodeEnv,
      method: request.method,
      route,
      status_code: String(statusCode),
    };

    activeRequestsCounter.add(-1, {
      environment: config.nodeEnv,
      method: request.method,
    });
    requestsCounter.add(1, attributes);
    requestDurationHistogram.record(durationMs, attributes);

    if (statusCode >= 400) {
      requestErrorsCounter.add(1, attributes);
    }

    if (!isHealthRoute(route)) {
      metadata?.span?.setAttributes({
        "http.method": request.method,
        "http.request.method": request.method,
        "http.route": route,
        "http.status_code": statusCode,
        "http.response.status_code": statusCode,
        "service.name": SERVICE_NAME,
        "service.version": SERVICE_VERSION,
        "server.address": SERVICE_NAME,
      });
      metadata?.span?.setStatus({
        code: statusCode >= 500 ? SpanStatusCode.ERROR : SpanStatusCode.OK,
      });
      metadata?.span?.end();

      logWithLevel(statusCodeToLogLevel(statusCode), "HTTP request completed", {
        durationMs,
        method: request.method,
        requestId: metadata?.requestId,
        route,
        statusCode,
      });
    }

    requestState.delete(request);
  });

let shutdownPromise: Promise<void> | null = null;

export function getRequestMetadata(request: Request) {
  return requestState.get(request);
}

export function getHealthSnapshot() {
  return {
    environment: config.nodeEnv,
    service: SERVICE_NAME,
    telemetry: {
      betterStackConfigured,
      exportEnabled: Boolean(telemetrySdk),
      ingestingHost: config.betterStackIngestingHost || null,
    },
    timestamp: new Date().toISOString(),
    uptimeSeconds: Number(process.uptime().toFixed(1)),
    version: SERVICE_VERSION,
  };
}

export function logDebug(message: string, meta?: unknown) {
  if (config.nodeEnv === "production") {
    return;
  }

  logWithLevel("debug", message, meta);
}

export function logInfo(message: string, meta?: unknown) {
  logWithLevel("info", message, meta);
}

export function logWarn(message: string, meta?: unknown) {
  logWithLevel("warn", message, meta);
}

export function logError(message: string, meta?: unknown) {
  logWithLevel("error", message, meta);
}

export function logFatal(message: string, meta?: unknown) {
  logWithLevel("fatal", message, meta);
}

export async function shutdownTelemetry() {
  if (!telemetrySdk) {
    return;
  }

  if (!shutdownPromise) {
    shutdownPromise = telemetrySdk.shutdown().catch((error) => {
      console.error(
        JSON.stringify({
          error: serializeUnknown(error),
          level: "ERROR",
          message: "Telemetry shutdown failed",
          service: SERVICE_NAME,
          timestamp: new Date().toISOString(),
        })
      );
    });
  }

  await shutdownPromise;
}

export function registerProcessHandlers(stopServer: () => Promise<unknown>) {
  let shuttingDown = false;

  const handleSignal = async (signal: "SIGINT" | "SIGTERM") => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logWarn("Shutdown signal received", { signal });

    try {
      await stopServer();
    } catch (error) {
      logError("Server stop failed during shutdown", {
        error: serializeUnknown(error),
        signal,
      });
    }

    await shutdownTelemetry();
    process.exit(0);
  };

  const handleFatal = async (
    type: "uncaughtException" | "unhandledRejection",
    reason: unknown
  ) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    processCrashesCounter.add(1, {
      environment: config.nodeEnv,
      type,
    });

    logFatal("Fatal process event", {
      error: serializeUnknown(reason),
      type,
    });

    try {
      await stopServer();
    } catch (error) {
      logError("Server stop failed after fatal event", {
        error: serializeUnknown(error),
        type,
      });
    }

    await shutdownTelemetry();
    process.exit(1);
  };

  process.on("SIGINT", () => {
    void handleSignal("SIGINT");
  });

  process.on("SIGTERM", () => {
    void handleSignal("SIGTERM");
  });

  process.on("uncaughtException", (error) => {
    void handleFatal("uncaughtException", error);
  });

  process.on("unhandledRejection", (reason) => {
    void handleFatal("unhandledRejection", reason);
  });
}

function buildLogAttributes(
  level: LogLevel,
  message: string,
  meta: Record<string, unknown> | undefined
) {
  const attributes: Record<string, boolean | number | string> = {
    "deployment.environment.name": config.nodeEnv,
    "log.level": level,
    "service.name": SERVICE_NAME,
    "service.version": SERVICE_VERSION,
  };

  if (message) {
    attributes["log.message"] = message;
  }

  if (!meta) {
    return attributes;
  }

  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined) {
      continue;
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      attributes[key] = value;
      continue;
    }

    attributes[key] = JSON.stringify(value);
  }

  return attributes;
}

function isHealthRoute(route: string) {
  return route === "/api/v1/health" || route.startsWith("/api/v1/health/");
}

function logWithLevel(level: LogLevel, message: string, meta?: unknown) {
  const normalizedMeta = normalizeMeta(meta);
  const payload = {
    ...traceContextFields(),
    ...normalizedMeta,
    environment: config.nodeEnv,
    level: level.toUpperCase(),
    message,
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
    version: SERVICE_VERSION,
  };

  const line = JSON.stringify(payload);

  if (level === "debug") {
    console.debug(line);
  } else if (level === "info") {
    console.info(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.error(line);
  }

  otelLogger.emit({
    attributes: buildLogAttributes(level, message, normalizedMeta),
    body: message,
    context: otelContext.active(),
    exception: normalizedMeta?.error,
    observedTimestamp: Date.now(),
    severityNumber: severityNumberFor(level),
    severityText: level.toUpperCase(),
    timestamp: Date.now(),
  });
}

function normalizeMeta(meta: unknown) {
  if (meta === undefined) {
    return undefined;
  }

  if (meta instanceof Error) {
    return {
      error: serializeUnknown(meta),
    };
  }

  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(meta)) {
      normalized[key] = serializeUnknown(value);
    }

    return normalized;
  }

  return {
    value: serializeUnknown(meta),
  };
}

function normalizeRoute(path: string) {
  return path
    .split("/")
    .map((segment) => {
      if (!segment) {
        return segment;
      }

      if (/^\d+$/.test(segment)) {
        return ":id";
      }

      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          segment
        )
      ) {
        return ":id";
      }

      if (/^[0-9a-f]{24,}$/i.test(segment)) {
        return ":id";
      }

      if (segment.length > 24 && /^[A-Za-z0-9_-]+$/.test(segment)) {
        return ":id";
      }

      return segment;
    })
    .join("/");
}

function otlpHeaders() {
  return {
    Authorization: `Bearer ${config.betterStackSourceToken}`,
  };
}

function resolveStatusCode(
  status: number | keyof typeof StatusMap | undefined
): number {
  if (typeof status === "number") {
    return status;
  }

  if (!status) {
    return 200;
  }

  return StatusMap[status] || 200;
}

function roundDuration(durationMs: number) {
  return Math.round(durationMs * 100) / 100;
}

function serializeUnknown(value: unknown, depth = 0): unknown {
  if (depth > 4) {
    return "[MaxDepth]";
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Error) {
    return {
      message: value.message,
      name: value.name,
      stack: value.stack,
    };
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeUnknown(item, depth + 1));
  }

  if (typeof value === "object") {
    const normalized: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      normalized[key] = serializeUnknown(nestedValue, depth + 1);
    }

    return normalized;
  }

  return String(value);
}

function severityNumberFor(level: LogLevel) {
  if (level === "debug") {
    return SeverityNumber.DEBUG;
  }

  if (level === "info") {
    return SeverityNumber.INFO;
  }

  if (level === "warn") {
    return SeverityNumber.WARN;
  }

  if (level === "error") {
    return SeverityNumber.ERROR;
  }

  return SeverityNumber.FATAL;
}

function statusCodeToLogLevel(statusCode: number): Exclude<LogLevel, "fatal"> {
  if (statusCode >= 500) {
    return "error";
  }

  if (statusCode >= 400) {
    return "warn";
  }

  return "info";
}

function toBaseUrl(hostOrUrl: string) {
  return hostOrUrl.startsWith("http")
    ? hostOrUrl.replace(/\/+$/, "")
    : `https://${hostOrUrl.replace(/\/+$/, "")}`;
}

function traceContextFields() {
  const spanContext = trace.getActiveSpan()?.spanContext();

  if (!spanContext) {
    return {};
  }

  return {
    spanId: spanContext.spanId,
    traceId: spanContext.traceId,
  };
}
