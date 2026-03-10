import { Text, View } from "react-native";
import { Screen } from "@/components/shared/Screen";

export default function ItineraryScreen() {
  return (
    <Screen>
      <View className="rounded-2xl border border-border bg-card p-5">
        <Text className="text-2xl font-bold text-card-foreground">Itinerary</Text>
        <Text className="mt-2 text-base leading-6 text-muted-foreground">
          Day-by-day itinerary planning and offline edits will live on this screen.
        </Text>
      </View>
    </Screen>
  );
}
