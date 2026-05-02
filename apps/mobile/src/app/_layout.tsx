import "./global.css";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { ThemeProvider } from "@react-navigation/native";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient, onlineManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { PortalHost } from "@rn-primitives/portal";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { useEffect } from "react";
import { InteractionManager } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { client, EdenProvider } from "@/api/client";
// import { queryClient } from "@/lib/queryClient";
import { appToastConfig } from "@/components/shared/AppToast";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { ScreenErrorBoundary } from "@/components/shared/ScreenErrorBoundary";
import { DestinationFavoritesProvider } from "@/features/destination/favorites";
import { initMonitoring, setMonitoringScreen, setMonitoringUser } from "@/lib/monitoring";
import { NAV_THEME } from "@/lib/theme";
import { useInAppSocialMessageSignals } from "@/hooks/useInAppSocialMessageSignals";
import { usePushRegistration } from "@/hooks/usePushRegistration";
import { useAuthStore } from "@/store/authStore";
import { useNetworkStore } from "@/store/networkStore";
import { useOfflineStore } from "@/store/offlineStore";
import { usePreferencesStore } from "@/store/preferencesStore";

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  })
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24,
      staleTime: 1000 * 60 * 5,
      networkMode: "offlineFirst",
      retry: 2,
    },
    mutations: {
      networkMode: "online",
    },
  },
});

const asyncPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "travel_companion_query_cache",
});

// R-1501: Initialize crash reporting first so future analytics init remains secondary.
initMonitoring();

function RootToast() {
  const insets = useSafeAreaInsets();
  return (
    <Toast config={appToastConfig} position="top" topOffset={insets.top + 8} />
  );
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
  const pathname = usePathname();
  const userId = useAuthStore((s) => s.user?.id);
  const startListening = useNetworkStore((s) => s.startListening);
  const hydrateOffline = useOfflineStore((s) => s.hydrate);
  const hydratePreferences = usePreferencesStore((s) => s.hydrateFromStorage);
  usePushRegistration();
  useInAppSocialMessageSignals();

  useEffect(() => {
    const unsubscribe = startListening();

    // R-1401: Keep app shell responsive, then hydrate heavier persisted state.
    const deferredHydration = InteractionManager.runAfterInteractions(() => {
      void hydrateOffline();
      void hydratePreferences();
    });

    return () => {
      deferredHydration.cancel();
      unsubscribe();
    };
  }, [startListening, hydrateOffline, hydratePreferences]);

  useEffect(() => {
    setMonitoringScreen(pathname);
  }, [pathname]);

  useEffect(() => {
    setMonitoringUser(userId);
  }, [userId]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncPersister, maxAge: 1000 * 60 * 60 * 24 }}
    >
      <EdenProvider client={client} queryClient={queryClient}>
        <DestinationFavoritesProvider>
          <KeyboardProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <ThemeProvider value={NAV_THEME[colorScheme ?? "light"]}>
                <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
                <OfflineBanner />
                <ScreenErrorBoundary>
                  <Stack screenOptions={{ headerShown: false }} />
                </ScreenErrorBoundary>
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
