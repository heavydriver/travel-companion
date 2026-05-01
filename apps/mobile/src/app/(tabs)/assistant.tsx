import { useMemo } from "react";
import { Text, View } from "react-native";
import { Screen } from "@/components/shared/Screen";
import { analytics } from "@/utils/analytics";

export default function AssistantScreen() {
  const isExperimentalEnabled = useMemo(
    () => analytics.isFeatureEnabled("assistant_experimental_ui"),
    [],
  );

  return (
    <Screen>
      <View className="rounded-2xl border border-border bg-card p-5">
        <Text className="text-2xl font-bold text-card-foreground">Assistant</Text>
        <Text className="mt-2 text-base leading-6 text-muted-foreground">
          Your on-device AI travel assistant will be enabled in Phase 3.
        </Text>
        {isExperimentalEnabled ? (
          <Text className="mt-3 text-sm font-medium text-primary">
            Experimental assistant UI is enabled.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
