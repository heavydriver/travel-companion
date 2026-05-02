import { Stack } from "expo-router";
import { ScreenErrorBoundary } from "@/components/shared/ScreenErrorBoundary";

export default function AuthLayout() {
  return (
    <ScreenErrorBoundary>
      <Stack screenOptions={{ headerShown: false }} />
    </ScreenErrorBoundary>
  );
}
