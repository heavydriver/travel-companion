import { Text, View } from "react-native";
import { Screen } from "@/components/shared/Screen";

export default function ExploreScreen() {
  return (
    <Screen>
      <View className="rounded-2xl border border-border bg-card p-5">
        <Text className="text-2xl font-bold text-card-foreground">Explore</Text>
        <Text className="mt-2 text-base leading-6 text-muted-foreground">
          Curated recommendations and local favorites will appear here.
        </Text>
      </View>
    </Screen>
  );
}
