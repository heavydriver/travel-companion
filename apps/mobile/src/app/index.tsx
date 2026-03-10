import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";

export default function Index() {
  const hydrateAuth = useAuthStore((state) => state.hydrateFromStorage);
  const hydrateUi = useUiStore((state) => state.hydrateFromStorage);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasSeenOnboarding = useUiStore((state) => state.hasSeenOnboarding);
  const [isBootstrapped, setIsBootstrapped] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      await Promise.all([hydrateAuth(), hydrateUi()]);
      setIsBootstrapped(true);
    }

    bootstrap();
  }, [hydrateAuth, hydrateUi]);

  if (!isBootstrapped) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href={"/(tabs)" as never} />;
  }

  if (hasSeenOnboarding) {
    return <Redirect href={"/(auth)/login" as never} />;
  }

  return <Redirect href={"/onboarding" as never} />;
}
