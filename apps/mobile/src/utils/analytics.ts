import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PostHog } from "posthog-react-native";

type RegistrationMethod = "email" | "google" | "apple";
type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;
type AnalyticsAction =
  | { type: "identify"; userId: string }
  | { type: "reset" }
  | { type: "capture"; event: string; properties?: AnalyticsProperties }
  | { type: "screen"; screenName: string };

let posthogClient: PostHog | null = null;
let analyticsOnline = false;
let queuedActions: AnalyticsAction[] = [];
let loadQueuePromise: Promise<void> | null = null;
let flushQueuePromise: Promise<void> | null = null;

const ANALYTICS_QUEUE_STORAGE_KEY = "travel-companion.analytics.queue";
const MAX_QUEUED_ACTIONS = 200;

async function ensureQueueLoaded() {
  if (loadQueuePromise) {
    return loadQueuePromise;
  }

  loadQueuePromise = (async () => {
    try {
      const rawValue = await AsyncStorage.getItem(ANALYTICS_QUEUE_STORAGE_KEY);
      if (!rawValue) return;

      const parsed = JSON.parse(rawValue);
      if (Array.isArray(parsed)) {
        queuedActions = parsed.slice(-MAX_QUEUED_ACTIONS) as AnalyticsAction[];
      }
    } catch {
      queuedActions = [];
    }
  })();

  return loadQueuePromise;
}

async function persistQueue() {
  if (queuedActions.length === 0) {
    await AsyncStorage.removeItem(ANALYTICS_QUEUE_STORAGE_KEY);
    return;
  }

  await AsyncStorage.setItem(
    ANALYTICS_QUEUE_STORAGE_KEY,
    JSON.stringify(queuedActions.slice(-MAX_QUEUED_ACTIONS)),
  );
}

async function enqueueAction(action: AnalyticsAction) {
  await ensureQueueLoaded();
  queuedActions.push(action);
  if (queuedActions.length > MAX_QUEUED_ACTIONS) {
    queuedActions = queuedActions.slice(-MAX_QUEUED_ACTIONS);
  }
  await persistQueue();
}

function replayAction(client: PostHog, action: AnalyticsAction) {
  switch (action.type) {
    case "identify":
      client.identify(action.userId);
      return;
    case "reset":
      client.reset();
      return;
    case "capture":
      client.capture(action.event, action.properties);
      return;
    case "screen":
      client.screen(action.screenName);
      return;
  }
}

function canFlushAnalytics() {
  return Boolean(posthogClient && analyticsOnline);
}

async function flushQueuedActions() {
  if (flushQueuePromise) {
    return flushQueuePromise;
  }

  flushQueuePromise = (async () => {
    const client = posthogClient;
    if (!client || !analyticsOnline) return;

    await ensureQueueLoaded();
    await client.ready();

    if (posthogClient !== client || !analyticsOnline) {
      return;
    }

    while (analyticsOnline && queuedActions.length > 0) {
      if (posthogClient !== client) {
        return;
      }

      const batch = [...queuedActions];
      queuedActions = [];
      await persistQueue();

      try {
        for (const action of batch) {
          replayAction(client, action);
        }
        await client.flush();
      } catch {
        queuedActions = [...batch, ...queuedActions].slice(-MAX_QUEUED_ACTIONS);
        await persistQueue();
        return;
      }
    }
  })().finally(() => {
    flushQueuePromise = null;

    if (canFlushAnalytics() && queuedActions.length > 0) {
      void flushQueuedActions();
    }
  });

  return flushQueuePromise;
}

function queueAction(action: AnalyticsAction) {
  void enqueueAction(action).then(() => {
    if (canFlushAnalytics()) {
      void flushQueuedActions();
    }
  });
}

export function setAnalyticsClient(client: PostHog | null) {
  posthogClient = client;

  if (canFlushAnalytics()) {
    void flushQueuedActions();
  }
}

export function setAnalyticsOnlineState(isOnline: boolean) {
  analyticsOnline = isOnline;

  if (canFlushAnalytics()) {
    void flushQueuedActions();
  }
}

export const analytics = {
  identifyUser(userId: string) {
    queueAction({ type: "identify", userId });
  },
  resetUser() {
    queueAction({ type: "reset" });
  },
  register(method: RegistrationMethod) {
    queueAction({ type: "capture", event: "user_registered", properties: { method } });
  },
  tripCreated(destinationId: string) {
    queueAction({ type: "capture", event: "trip_created", properties: { destinationId } });
  },
  tripDeleted() {
    queueAction({ type: "capture", event: "trip_deleted" });
  },
  itemAdded(hasPlace: boolean) {
    queueAction({ type: "capture", event: "itinerary_item_added", properties: { hasPlace } });
  },
  packDownloaded(destinationId: string) {
    queueAction({
      type: "capture",
      event: "offline_pack_downloaded",
      properties: { destinationId },
    });
  },
  modelDownloaded() {
    queueAction({ type: "capture", event: "llm_model_downloaded" });
  },
  chatMessageSent(hasTripContext: boolean) {
    queueAction({
      type: "capture",
      event: "chat_message_sent",
      properties: { hasTripContext },
    });
  },
  connectionSent() {
    queueAction({ type: "capture", event: "connection_request_sent" });
  },
  connectionAccepted() {
    queueAction({ type: "capture", event: "connection_accepted" });
  },
  screenView(screenName: string) {
    queueAction({ type: "screen", screenName });
  },
  isFeatureEnabled(flagKey: string) {
    return posthogClient?.isFeatureEnabled(flagKey) ?? false;
  },
};
