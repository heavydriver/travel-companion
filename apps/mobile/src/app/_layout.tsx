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
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { PostHogProvider, usePostHog } from "posthog-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { client, EdenProvider } from "@/api/client";
// import { queryClient } from "@/lib/queryClient";
import { appToastConfig } from "@/components/shared/AppToast";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { DestinationFavoritesProvider } from "@/features/destination/favorites";
import { NAV_THEME } from "@/lib/theme";
import { useInAppSocialMessageSignals } from "@/hooks/useInAppSocialMessageSignals";
import { usePushRegistration } from "@/hooks/usePushRegistration";
import { useNetworkStore } from "@/store/networkStore";
import { useOfflineStore } from "@/store/offlineStore";
import { usePreferencesStore } from "@/store/preferencesStore";
import { useAuthStore } from "@/store/authStore";
import { analytics, setAnalyticsClient } from "@/utils/analytics";

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

function RootToast() {
  const insets = useSafeAreaInsets();
  return (
    <Toast config={appToastConfig} position="top" topOffset={insets.top + 8} />
  );
}

function AnalyticsBinder() {
  const posthog = usePostHog();
  const pathname = usePathname();
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    setAnalyticsClient(posthog);
    return () => {
      setAnalyticsClient(null);
    };
  }, [posthog]);

  useEffect(() => {
    if (pathname) {
      analytics.screenView(pathname);
    }
  }, [pathname]);

  useEffect(() => {
    if (userId) {
      analytics.identifyUser(userId);
      return;
    }
    analytics.resetUser();
  }, [userId]);

  return null;
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

  const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? "";

  return (
    <PostHogProvider
      apiKey={posthogApiKey}
      options={{ host: process.env.EXPO_PUBLIC_POSTHOG_HOST }}
      autocapture
    >
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: asyncPersister, maxAge: 1000 * 60 * 60 * 24 }}
      >
        <EdenProvider client={client} queryClient={queryClient}>
          <DestinationFavoritesProvider>
            <KeyboardProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <ThemeProvider value={NAV_THEME[colorScheme ?? "light"]}>
                  <AnalyticsBinder />
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
    </PostHogProvider>
  );
}
