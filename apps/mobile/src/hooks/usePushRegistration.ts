import Constants from "expo-constants";
import * as Device from "expo-device";
import { useEffect, useRef } from "react";
import NetInfo from "@react-native-community/netinfo";
import { Platform } from "react-native";
import { client } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useNetworkStore } from "@/store/networkStore";

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
  const isConnected = useNetworkStore((s) => s.isConnected);
  const isInternetReachable = useNetworkStore((s) => s.isInternetReachable);
  const registeredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      registeredRef.current = null;
      return;
    }

    if (!isConnected || isInternetReachable === false) {
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
        const networkState = await NetInfo.fetch();
        if (!networkState.isConnected || networkState.isInternetReachable === false) return;

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

        const refreshedNetworkState = await NetInfo.fetch();
        if (!refreshedNetworkState.isConnected || refreshedNetworkState.isInternetReachable === false) {
          return;
        }

        const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
        const expoToken = tokenRes.data;
        if (!expoToken || cancelled) return;
        if (registeredRef.current === expoToken) return;

        const finalNetworkState = await NetInfo.fetch();
        if (!finalNetworkState.isConnected || finalNetworkState.isInternetReachable === false) {
          return;
        }

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
  }, [isAuthenticated, accessToken, isConnected, isInternetReachable]);
}
