import "./global.css";
import "../llm/polyfills";
import NetInfo from "@react-native-community/netinfo";
import { ThemeProvider } from "@react-navigation/native";
import { PortalHost } from "@rn-primitives/portal";
import { onlineManager, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
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
import { useInAppSocialMessageSignals } from "@/hooks/useInAppSocialMessageSignals";
import { usePushRegistration } from "@/hooks/usePushRegistration";
import { queryCachePersister, queryClient } from "@/lib/queryClient";
import { NAV_THEME } from "@/lib/theme";
import { useNetworkStore } from "@/store/networkStore";
import { useOfflineStore } from "@/store/offlineStore";
import { usePreferencesStore } from "@/store/preferencesStore";

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  }),
);

function RootToast() {
  const insets = useSafeAreaInsets();
  return <Toast config={appToastConfig} position="top" topOffset={insets.top + 8} />;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootLayoutInner />
    </QueryClientProvider>
  );
}

function RootLayoutInner() {
  const { colorScheme } = useColorScheme();
  const startListening = useNetworkStore((s) => s.startListening);
  const hydrateOffline = useOfflineStore((s) => s.hydrate);
  const hydratePreferences = usePreferencesStore((s) => s.hydrateFromStorage);
  usePushRegistration();
  useInAppSocialMessageSignals();

  useEffect(() => {
    const unsubscribe = startListening();
    hydrateOffline();
    void hydratePreferences();
    return unsubscribe;
  }, [startListening, hydrateOffline, hydratePreferences]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryCachePersister, maxAge: 1000 * 60 * 60 * 24 }}
    >
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
    </PersistQueryClientProvider>
  );
}
