import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getDestinationTitle,
  POPULAR_DESTINATIONS_QUERY_KEY,
  type PopularDestination,
} from "@/features/destination/popular";

function PopularDestinationRow({ destination }: { destination: PopularDestination }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/destination/${destination.id}` as never)}
      className="overflow-hidden rounded-2xl border border-border bg-card active:opacity-90"
    >
      <View className="h-44 w-full bg-muted">
        {destination.imageUrl ? (
          <Image
            source={{ uri: destination.imageUrl }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View className="h-full w-full bg-muted" />
        )}
      </View>
      <View className="gap-1 p-4">
        <Text className="text-xl font-bold text-foreground">{getDestinationTitle(destination)}</Text>
        <Text className="text-sm text-muted-foreground" numberOfLines={2}>
          {destination.description?.trim() || "Explore this destination"}
        </Text>
      </View>
    </Pressable>
  );
}

export default function PopularDestinationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const cached = queryClient.getQueryData<{ destinations: PopularDestination[] }>(
    POPULAR_DESTINATIONS_QUERY_KEY,
  );
  const destinations = cached?.destinations ?? [];

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <View className="flex-1 px-5 pt-6 pb-6">
        <View className="mb-5 flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center gap-1 active:opacity-80"
          >
            <ChevronLeft size={20} color="#3B82F6" />
            <Text className="text-base font-semibold text-primary">Back</Text>
          </Pressable>
          <Text className="text-lg font-bold text-foreground">Popular Destinations</Text>
          <View className="w-12" />
        </View>

        {destinations.length === 0 ? (
          <View className="rounded-2xl border border-border bg-card px-4 py-5">
            <Text className="text-sm text-muted-foreground">
              No cached popular destinations yet. Open Explore first, then tap See All.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerClassName="gap-3 pb-3" showsVerticalScrollIndicator={false}>
            {destinations.map((destination) => (
              <PopularDestinationRow key={destination.id} destination={destination} />
            ))}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
