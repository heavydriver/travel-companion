import { Tabs } from "expo-router";
import { BottomTabBar } from "@/components/shared/BottomTabBar";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { usePackVersionCheck } from "@/hooks/usePackVersionCheck";

export default function TabsLayout() {
  const isAuthenticated = useAuthGuard();
  usePackVersionCheck();

  if (!isAuthenticated) {
    return null;
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
