import { registerProcessHandlers, telemetryState } from "./observability";
import { app } from "./app";
import { config } from "./utils/config";
import { logger } from "./utils/logger";

app.listen(config.port);
registerProcessHandlers(() => app.stop());

logger.info(`Server running on port ${config.port}`, {
  env: config.nodeEnv,
  observability: {
    betterStackConfigured: telemetryState.betterStackConfigured,
    betterStackPartiallyConfigured: telemetryState.betterStackPartialConfig,
    serviceName: telemetryState.serviceName,
    serviceVersion: telemetryState.serviceVersion,
  },
});

if (telemetryState.betterStackPartialConfig && !telemetryState.betterStackConfigured) {
  logger.warn("Better Stack telemetry export disabled due to partial configuration", {
    hasHost: Boolean(config.betterStackIngestingHost),
    hasSourceToken: Boolean(config.betterStackSourceToken),
  });
}

if (!telemetryState.betterStackConfigured) {
  logger.warn("Telemetry exporter not configured. Logs remain local stdout only.", {
    requiredEnv: ["BETTERSTACK_INGESTING_HOST", "BETTERSTACK_SOURCE_TOKEN"],
  });
} else {
  logger.info("Better Stack telemetry export enabled", {
    ingestingHost: config.betterStackIngestingHost,
    serviceName: telemetryState.serviceName,
  });
}
