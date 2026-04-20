import Constants from "expo-constants";
import * as Device from "expo-device";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { client } from "@/api/client";
import { useAuthStore } from "@/store/authStore";

type NotificationsNs = typeof import("expo-notifications");

let notificationHandlerRegistered = false;

async function loadNotifications(): Promise<NotificationsNs | null> {
  try {
    return await import("expo-notifications");
  } catch {
    return null;
  }
}

async function ensureAndroidChannel(Notifications: NotificationsNs) {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export function usePushRegistration() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const registeredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      registeredRef.current = null;
      return;
    }

    let cancelled = false;

    void (async () => {
      const Notifications = await loadNotifications();
      if (cancelled || !Notifications) return;

      if (!notificationHandlerRegistered) {
        try {
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: true,
              shouldPlaySound: false,
              shouldSetBadge: true,
              shouldShowBanner: true,
              shouldShowList: true,
            }),
          });
          notificationHandlerRegistered = true;
        } catch {
          return;
        }
      }

      if (!Device.isDevice) return;

      try {
        await ensureAndroidChannel(Notifications);

        const perm = await Notifications.getPermissionsAsync();
        const status =
          perm.status === "granted"
            ? perm.status
            : (await Notifications.requestPermissionsAsync()).status;
        if (status !== "granted" || cancelled) return;

        const projectId =
          (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
            ?.projectId;
        if (!projectId) return;

        const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
        const expoToken = tokenRes.data;
        if (!expoToken || cancelled) return;
        if (registeredRef.current === expoToken) return;

        const res = await client.api.v1.users["me"]["push-token"].post({ expoToken });
        if (!res.error) {
          registeredRef.current = expoToken;
        }
      } catch {
        // Missing native module, no Play services on emulator, or network — ignore.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, accessToken]);
}
