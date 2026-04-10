import "./global.css";
import { ThemeProvider } from "@react-navigation/native";
import { PortalHost } from "@rn-primitives/portal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

const queryClient = new QueryClient();

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
        <KeyboardProvider>
          <ThemeProvider value={NAV_THEME[colorScheme ?? "light"]}>
            <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
            <OfflineBanner />
            <Stack screenOptions={{ headerShown: false }} />
            <PortalHost />
          </ThemeProvider>
        </KeyboardProvider>
      </EdenProvider>
    </QueryClientProvider>
  );
}
