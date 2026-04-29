import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PlaceCard } from "@/components/shared/PlaceCard";
import { useDestinationFavorites } from "@/features/destination/favorites";

export default function FavoriteDestinationsScreen() {
  const router = useRouter();
  const { favoriteDestinations } = useDestinationFavorites();

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <ScrollView contentContainerClassName="px-5 pt-6 pb-8" showsVerticalScrollIndicator={false}>
        <View className="gap-5">
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={() => router.back()}
              className="flex-row items-center gap-1 active:opacity-80"
            >
              <ChevronLeft size={20} color="#3B82F6" />
              <Text className="text-base font-semibold text-primary">Back</Text>
            </Pressable>
            <Text className="text-lg font-bold text-foreground">Favorite Destinations</Text>
            <View className="w-12" />
          </View>

          {favoriteDestinations.length === 0 ? (
            <View className="rounded-2xl border border-border bg-card px-4 py-5">
              <Text className="text-sm text-muted-foreground">
                You have no saved destinations yet. Tap the heart on a destination to save it.
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {favoriteDestinations.map((destination) => {
                const title =
                  destination.country &&
                  destination.name.trim().toLowerCase() !==
                    destination.country.trim().toLowerCase()
                    ? `${destination.name}, ${destination.country}`
                    : destination.name;
                const subtitle =
                  title === destination.name && destination.country.trim().length > 0
                    ? destination.country
                    : null;
                return (
                  <PlaceCard
                    key={destination.id}
                    title={title}
                    subtitle={subtitle}
                    imageUrl={destination.imageUrl}
                    onPress={() => router.push(`/destination/${destination.id}` as never)}
                  />
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
