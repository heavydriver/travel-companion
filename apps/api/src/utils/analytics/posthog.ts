import { PostHog } from "posthog-node";
import { config } from "../config";

const posthog = config.posthogApiKey
  ? new PostHog(config.posthogApiKey, {
      host: config.posthogHost,
      flushAt: 1,
      flushInterval: 0,
    })
  : null;

function capture(
  distinctId: string,
  event: string,
  properties: Record<string, string | number | boolean | null | undefined>,
) {
  if (!posthog) return;
  posthog.capture({ distinctId, event, properties });
}

export const serverAnalytics = {
  packGenerationCompleted(
    destinationId: string,
    packVersion: number,
    placesCount: number,
    phrasesCount: number,
  ) {
    capture(`destination:${destinationId}`, "pack_generation_completed", {
      destinationId,
      packVersion,
      placesCount,
      phrasesCount,
    });
  },
  syncConflictDetected(userId: string, conflictType: string) {
    capture(userId, "sync_conflict_detected", { conflictType });
  },
};
