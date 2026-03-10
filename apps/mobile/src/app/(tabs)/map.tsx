import { Text, View } from "react-native";
import { Screen } from "@/components/shared/Screen";

export default function MapScreen() {
  return (
    <Screen>
      <View className="rounded-2xl border border-border bg-card p-5">
        <Text className="text-2xl font-bold text-card-foreground">Map</Text>
        <Text className="mt-2 text-base leading-6 text-muted-foreground">
          Interactive offline maps will be added in Phase 2.
        </Text>
      </View>
    </Screen>
  );
}
