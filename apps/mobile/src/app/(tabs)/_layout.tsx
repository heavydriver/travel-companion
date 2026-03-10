import { Tabs } from "expo-router";
import { BottomTabBar } from "@/components/shared/BottomTabBar";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function TabsLayout() {
  const isAuthenticated = useAuthGuard();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => <BottomTabBar {...props} />}
    />
  );
}
