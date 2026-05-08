import "./global.css";
import "../llm/polyfills";
import NetInfo from "@react-native-community/netinfo";
import { ThemeProvider } from "@react-navigation/native";
import { PortalHost } from "@rn-primitives/portal";
import { onlineManager, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { useEffect, useMemo } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { PostHog, PostHogProvider } from "posthog-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { client, EdenProvider } from "@/api/client";
import { appToastConfig } from "@/components/shared/AppToast";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { DestinationFavoritesProvider } from "@/features/destination/favorites";
import { useInAppSocialMessageSignals } from "@/hooks/useInAppSocialMessageSignals";
import { usePushRegistration } from "@/hooks/usePushRegistration";
import { queryCachePersister, queryClient } from "@/lib/queryClient";
import { NAV_THEME } from "@/lib/theme";
import { useNetworkStore } from "@/store/networkStore";
import { useOfflineItineraryStore } from "@/store/offlineItineraryStore";
import { useOfflineStore } from "@/store/offlineStore";
import { usePreferencesStore } from "@/store/preferencesStore";
import { useAuthStore } from "@/store/authStore";
import { analytics, setAnalyticsClient, setAnalyticsOnlineState } from "@/utils/analytics";

const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

let currentOfflineLogSuppression = false;
let offlineLogFilterInstalled = false;

function shouldSuppressOfflineLibraryLog(args: unknown[]) {
  const firstArg = typeof args[0] === "string" ? args[0] : "";
  return (
    firstArg.includes("[expo-notifications] Error thrown while updating the device push token") ||
    firstArg.includes("Error while flushing PostHog")
  );
}

function setOfflineLogSuppression(enabled: boolean) {
  currentOfflineLogSuppression = enabled;

  if (offlineLogFilterInstalled) {
    return;
  }

  console.warn = (...args: unknown[]) => {
    if (currentOfflineLogSuppression && shouldSuppressOfflineLibraryLog(args)) {
      return;
    }
    originalConsoleWarn(...args);
  };

  console.error = (...args: unknown[]) => {
    if (currentOfflineLogSuppression && shouldSuppressOfflineLibraryLog(args)) {
      return;
    }
    originalConsoleError(...args);
  };

  offlineLogFilterInstalled = true;
}

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  }),
);

function RootToast() {
  const insets = useSafeAreaInsets();
  return <Toast config={appToastConfig} position="top" topOffset={insets.top + 8} />;
}

function AnalyticsBinder({
  posthog,
  isAnalyticsOnline,
}: {
  posthog: PostHog | null;
  isAnalyticsOnline: boolean;
}) {
  const pathname = usePathname();
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    setAnalyticsClient(posthog);
    return () => {
      setAnalyticsClient(null);
    };
  }, [posthog]);

  useEffect(() => {
    setAnalyticsOnlineState(isAnalyticsOnline);
  }, [isAnalyticsOnline]);

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
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RootLayoutInner />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

function RootLayoutInner() {
  const { colorScheme } = useColorScheme();
  const startListening = useNetworkStore((s) => s.startListening);
  const isConnected = useNetworkStore((s) => s.isConnected);
  const isInternetReachable = useNetworkStore((s) => s.isInternetReachable);
  const hydrateOfflineItinerary = useOfflineItineraryStore((s) => s.hydrate);
  const hydrateOffline = useOfflineStore((s) => s.hydrate);
  const hydratePreferences = usePreferencesStore((s) => s.hydrateFromStorage);
  usePushRegistration();
  useInAppSocialMessageSignals();

  useEffect(() => {
    const unsubscribe = startListening();
    hydrateOffline();
    void hydrateOfflineItinerary();
    void hydratePreferences();
    return unsubscribe;
  }, [startListening, hydrateOffline, hydrateOfflineItinerary, hydratePreferences]);

  const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? "";
  const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST;
  const isAnalyticsOnline = isConnected && isInternetReachable !== false;

  useEffect(() => {
    setOfflineLogSuppression(!isAnalyticsOnline);
  }, [isAnalyticsOnline]);

  const posthogClient = useMemo(() => {
    if (!posthogApiKey || !isAnalyticsOnline) {
      return null;
    }

    return new PostHog(posthogApiKey, {
      host: posthogHost,
      captureAppLifecycleEvents: false,
      disableRemoteConfig: true,
      disableSurveys: true,
      flushInterval: 0,
      preloadFeatureFlags: false,
    });
  }, [posthogApiKey, posthogHost, isAnalyticsOnline]);

  const appContent = (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryCachePersister, maxAge: 1000 * 60 * 60 * 24 }}
    >
      <EdenProvider client={client} queryClient={queryClient}>
        <DestinationFavoritesProvider>
          <KeyboardProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <ThemeProvider value={NAV_THEME[colorScheme ?? "light"]}>
                <AnalyticsBinder posthog={posthogClient} isAnalyticsOnline={isAnalyticsOnline} />
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

  if (!posthogClient) {
    return appContent;
  }

  return (
    <PostHogProvider client={posthogClient} autocapture={false}>
      {appContent}
    </PostHogProvider>
  );
}
