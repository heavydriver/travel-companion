import "./global.css";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { ThemeProvider } from "@react-navigation/native";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient, onlineManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { PortalHost } from "@rn-primitives/portal";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { useEffect } from "react";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { client, EdenProvider } from "@/api/client";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { NAV_THEME } from "@/lib/theme";
import { useNetworkStore } from "@/store/networkStore";
import { useOfflineStore } from "@/store/offlineStore";

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
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncPersister, maxAge: 1000 * 60 * 60 * 24 }}
    >
      <EdenProvider client={client} queryClient={queryClient}>
        <KeyboardProvider>
          <ThemeProvider value={NAV_THEME[colorScheme ?? "light"]}>
            <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
            <OfflineBanner />
            <Stack screenOptions={{ headerShown: false }} />
            <PortalHost />
          </ThemeProvider>
        </KeyboardProvider>
      </EdenProvider>
    </PersistQueryClientProvider>
  );
}
