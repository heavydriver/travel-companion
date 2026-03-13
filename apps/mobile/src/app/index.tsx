import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";

export default function Index() {
  const hydrateAuth = useAuthStore((state) => state.hydrateFromStorage);
  const hydrateUi = useUiStore((state) => state.hydrateFromStorage);
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

  // TEMPORARY: Demo-only shortcut.
  // Always go straight to the main tabs so we can
  // access Home (trip list) and Itinerary without auth.
  return <Redirect href={"/(tabs)" as never} />;
}
