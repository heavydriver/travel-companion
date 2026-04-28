import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { invalidateMessageQueries, invalidateSocialGraphQueries } from "@/lib/socialQueries";
import { useAuthStore } from "@/store/authStore";

type NotificationsNs = typeof import("expo-notifications");

type SocialNotificationData = {
  type?: string;
  connectionId?: string;
};

async function loadNotifications(): Promise<NotificationsNs | null> {
  try {
    return await import("expo-notifications");
  } catch {
    return null;
  }
}

async function syncFromNotification(
  queryClient: QueryClient,
  payload: SocialNotificationData | null | undefined,
) {
  switch (payload?.type) {
    case "connection_request":
    case "connection_accepted":
      await invalidateSocialGraphQueries(queryClient);
      break;
    case "message":
      await invalidateMessageQueries(queryClient, payload.connectionId);
      break;
    default:
      break;
  }
}

export function useInAppSocialMessageSignals() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!isAuthenticated) return;

    const sub = AppState.addEventListener("change", (next) => {
      const wasBackground = appState.current.match(/inactive|background/);
      appState.current = next;
      if (wasBackground && next === "active") {
        void invalidateSocialGraphQueries(queryClient);
      }
    });

    return () => sub.remove();
  }, [isAuthenticated, queryClient]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    let receivedSub: { remove: () => void } | null = null;
    let responseSub: { remove: () => void } | null = null;

    void (async () => {
      const Notifications = await loadNotifications();
      if (!Notifications || cancelled) return;

      receivedSub = Notifications.addNotificationReceivedListener((event) => {
        void syncFromNotification(
          queryClient,
          event.request.content.data as SocialNotificationData | undefined,
        );
      });

      responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
        void syncFromNotification(
          queryClient,
          response.notification.request.content.data as SocialNotificationData | undefined,
        );
      });
    })();

    return () => {
      cancelled = true;
      receivedSub?.remove();
      responseSub?.remove();
    };
  }, [isAuthenticated, queryClient]);
}
