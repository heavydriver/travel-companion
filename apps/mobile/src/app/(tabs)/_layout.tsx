import { Redirect, Tabs } from "expo-router";
import { BottomTabBar } from "@/components/shared/BottomTabBar";
import { ScreenErrorBoundary } from "@/components/shared/ScreenErrorBoundary";
import { usePackVersionCheck } from "@/hooks/usePackVersionCheck";
import { useAuthStore } from "@/store/authStore";

export default function TabsLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  usePackVersionCheck();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <ScreenErrorBoundary>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
          lazy: true,
        }}
        tabBar={(props) => <BottomTabBar {...props} />}
      />
    </ScreenErrorBoundary>
  );
}
