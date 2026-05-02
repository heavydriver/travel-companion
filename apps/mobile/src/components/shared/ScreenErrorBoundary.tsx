import type { ReactNode } from "react";
import * as Sentry from "@sentry/react-native";
import { usePathname, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { captureMonitoringError } from "@/lib/monitoring";

type FallbackProps = {
  resetError: () => void;
};

function ErrorFallback({ resetError }: FallbackProps) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-center text-xl font-bold text-foreground">Something went wrong</Text>
      <Text className="mt-2 text-center text-sm text-muted-foreground">
        We hit an unexpected error while rendering this screen.
      </Text>
      <Pressable
        onPress={() => {
          resetError();
          router.replace(pathname as never);
        }}
        className="mt-5 rounded-xl bg-primary px-5 py-3"
        accessibilityRole="button"
        accessibilityLabel="Reload Screen"
      >
        <Text className="font-semibold text-primary-foreground">Reload Screen</Text>
      </Pressable>
    </View>
  );
}

export function ScreenErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <Sentry.ErrorBoundary
      onError={(error) => {
        captureMonitoringError(error);
      }}
      fallback={({ resetError }) => <ErrorFallback resetError={resetError} />}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
