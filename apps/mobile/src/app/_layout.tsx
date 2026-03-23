import "./global.css";
import { ThemeProvider } from "@react-navigation/native";
import { PortalHost } from "@rn-primitives/portal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { client, EdenProvider } from "@/api/client";
import { NAV_THEME } from "@/lib/theme";

const queryClient = new QueryClient();

export default function RootLayout() {
  const { colorScheme } = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <EdenProvider client={client} queryClient={queryClient}>
        <KeyboardProvider>
          <ThemeProvider value={NAV_THEME[colorScheme ?? "light"]}>
            <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
            <Stack screenOptions={{ headerShown: false }} />
            <PortalHost />
          </ThemeProvider>
        </KeyboardProvider>
      </EdenProvider>
    </QueryClientProvider>
  );
}
