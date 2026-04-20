import { Redirect, Tabs } from "expo-router";
import { BottomTabBar } from "@/components/shared/BottomTabBar";
import { usePackVersionCheck } from "@/hooks/usePackVersionCheck";
import { useAuthStore } from "@/store/authStore";

export default function TabsLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  usePackVersionCheck();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
      tabBar={(props) => <BottomTabBar {...props} />}
    />
  );
}
