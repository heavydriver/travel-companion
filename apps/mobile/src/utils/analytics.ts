import type PostHog from "posthog-react-native";

type RegistrationMethod = "email" | "google" | "apple";

let posthogClient: PostHog | null = null;

export function setAnalyticsClient(client: PostHog | null) {
  posthogClient = client;
}

export const analytics = {
  identifyUser(userId: string) {
    posthogClient?.identify(userId);
  },
  resetUser() {
    posthogClient?.reset();
  },
  register(method: RegistrationMethod) {
    posthogClient?.capture("user_registered", { method });
  },
  tripCreated(destinationId: string) {
    posthogClient?.capture("trip_created", { destinationId });
  },
  tripDeleted() {
    posthogClient?.capture("trip_deleted");
  },
  itemAdded(hasPlace: boolean) {
    posthogClient?.capture("itinerary_item_added", { hasPlace });
  },
  packDownloaded(destinationId: string) {
    posthogClient?.capture("offline_pack_downloaded", { destinationId });
  },
  modelDownloaded() {
    posthogClient?.capture("llm_model_downloaded");
  },
  chatMessageSent(hasTripContext: boolean) {
    posthogClient?.capture("chat_message_sent", { hasTripContext });
  },
  connectionSent() {
    posthogClient?.capture("connection_request_sent");
  },
  connectionAccepted() {
    posthogClient?.capture("connection_accepted");
  },
  screenView(screenName: string) {
    posthogClient?.screen(screenName);
  },
  isFeatureEnabled(flagKey: string) {
    return posthogClient?.isFeatureEnabled(flagKey) ?? false;
  },
};
