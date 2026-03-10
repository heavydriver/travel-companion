import { Text, View } from "react-native";
import { Screen } from "@/components/shared/Screen";

export default function AssistantScreen() {
  return (
    <Screen>
      <View className="rounded-2xl border border-border bg-card p-5">
        <Text className="text-2xl font-bold text-card-foreground">Assistant</Text>
        <Text className="mt-2 text-base leading-6 text-muted-foreground">
          Your on-device AI travel assistant will be enabled in Phase 3.
        </Text>
      </View>
    </Screen>
  );
}
