import "./global.css";
import { ThemeProvider } from "@react-navigation/native";
import { PortalHost } from "@rn-primitives/portal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { client, EdenProvider } from "@/api/client";
import { appToastConfig } from "@/components/shared/AppToast";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { DestinationFavoritesProvider } from "@/features/destination/favorites";
import { NAV_THEME } from "@/lib/theme";
import { useNetworkStore } from "@/store/networkStore";
import { useOfflineStore } from "@/store/offlineStore";

const queryClient = new QueryClient();

function RootToast() {
  const insets = useSafeAreaInsets();
  return (
    <Toast config={appToastConfig} position="top" topOffset={insets.top + 8} />
  );
}

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const startListening = useNetworkStore((s) => s.startListening);
  const hydrateOffline = useOfflineStore((s) => s.hydrate);

  useEffect(() => {
    const unsubscribe = startListening();
    hydrateOffline();
    return unsubscribe;
  }, [startListening, hydrateOffline]);

  return (
    <QueryClientProvider client={queryClient}>
      <EdenProvider client={client} queryClient={queryClient}>
        <DestinationFavoritesProvider>
          <KeyboardProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <ThemeProvider value={NAV_THEME[colorScheme ?? "light"]}>
                <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
                <OfflineBanner />
                <Stack screenOptions={{ headerShown: false }} />
                <PortalHost />
                <RootToast />
              </ThemeProvider>
            </GestureHandlerRootView>
          </KeyboardProvider>
        </DestinationFavoritesProvider>
      </EdenProvider>
    </QueryClientProvider>
  );
}
