import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Screen } from "@/components/shared/Screen";

export default function ItineraryScreen() {
  const router = useRouter();

  return (
    <Screen>
      <View className="rounded-2xl border border-border bg-card p-5">
        <Text className="text-2xl font-bold text-card-foreground">Itinerary</Text>
        <Text className="mt-2 text-base leading-6 text-muted-foreground">
          Day-by-day itinerary planning and offline edits will live on this screen.
        </Text>
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/language-guide",
              params: { countryCode: "JP" },
            })
          }
          className="mt-4 self-start rounded-xl bg-primary px-4 py-2.5 active:opacity-80"
        >
          <Text className="font-semibold text-primary-foreground">Open language guide</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
