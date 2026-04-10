import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  ChevronRight,
  Compass,
  MapPin,
  Search,
  Star,
} from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { client } from "@/api/client";
import { useDebounce } from "@/hooks/useDebounce";

type Destination = {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  slug: string;
};

type Place = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  rating: number | null;
  isCurated: boolean;
};

const CATEGORY_LABELS: Record<string, string> = {
  ATTRACTION: "Attraction",
  RESTAURANT: "Restaurant",
  HOTEL: "Hotel",
  SHOPPING: "Shopping",
  NIGHTLIFE: "Nightlife",
  TRANSPORT: "Transport",
  OTHER: "Other",
};

function CategoryBadge({ category }: { category: string }) {
  return (
    <View className="rounded-full bg-primary/10 px-2 py-0.5">
      <Text className="text-xs font-medium text-primary">
        {CATEGORY_LABELS[category] ?? category}
      </Text>
    </View>
  );
}

function PlaceCard({ place }: { place: Place }) {
  const mutedFg = useUnstableNativeVariable("--muted-foreground");
  const mutedColor = mutedFg ? `hsl(${mutedFg})` : "#9CA3AF";
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/place/${place.id}` as never)}
      className="mr-3 w-56 rounded-xl border border-border bg-card p-3 active:opacity-90"
    >
      <View className="flex-row items-center justify-between">
        <CategoryBadge category={place.category} />
        {place.rating && (
          <View className="flex-row items-center gap-1">
            <Star size={12} color="#F59E0B" fill="#F59E0B" />
            <Text className="text-xs font-medium text-foreground">
              {place.rating.toFixed(1)}
            </Text>
          </View>
        )}
      </View>
      <Text className="mt-2 text-base font-semibold text-foreground" numberOfLines={1}>
        {place.name}
      </Text>
      {place.description && (
        <Text className="mt-1 text-sm text-muted-foreground" numberOfLines={2}>
          {place.description}
        </Text>
      )}
      {place.isCurated && (
        <Text className="mt-1.5 text-xs font-medium text-chart-2">
          Curated pick
        </Text>
      )}
    </Pressable>
  );
}

function DestinationSection({ destination }: { destination: Destination }) {
  const mutedFg = useUnstableNativeVariable("--muted-foreground");
  const mutedColor = mutedFg ? `hsl(${mutedFg})` : "#9CA3AF";
  const router = useRouter();

  const placesQuery = useQuery({
    queryKey: ["places", destination.id],
    queryFn: async () => {
      const res = await client.api.v1
        .destinations({ destId: destination.id })
        .places.get({ query: {} });
      if (res.error) throw new Error("Failed to load places");
      return res.data;
    },
  });

  const places = (placesQuery.data?.places ?? []) as Place[];
  const topPlaces = places.slice(0, 6);

  return (
    <View className="gap-3">
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/trip/new",
            params: { destId: destination.id, destName: destination.name, destCountry: destination.country },
          } as never)
        }
        className="flex-row items-center justify-between active:opacity-80"
      >
        <View className="flex-row items-center gap-2">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <MapPin size={18} color={mutedColor} />
          </View>
          <View>
            <Text className="text-lg font-bold text-foreground">
              {destination.name}
            </Text>
            <Text className="text-sm text-muted-foreground">
              {destination.country}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center gap-1">
          <Text className="text-sm text-primary">Plan trip</Text>
          <ChevronRight size={16} color={mutedColor} />
        </View>
      </Pressable>

      {placesQuery.isLoading && (
        <View className="items-center py-4">
          <ActivityIndicator />
        </View>
      )}

      {topPlaces.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="pl-0.5"
        >
          {topPlaces.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </ScrollView>
      )}

      {!placesQuery.isLoading && topPlaces.length === 0 && (
        <Text className="text-sm text-muted-foreground">
          No places available yet
        </Text>
      )}
    </View>
  );
}

export default function ExploreScreen() {
  const mutedFg = useUnstableNativeVariable("--muted-foreground");
  const mutedColor = mutedFg ? `hsl(${mutedFg})` : "#9CA3AF";
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  const destQuery = useQuery({
    queryKey: ["explore-destinations", debouncedSearch],
    queryFn: async () => {
      const res = await client.api.v1.destinations.get({
        query: { q: debouncedSearch },
      });
      if (res.error) throw new Error("Failed to load destinations");
      return res.data;
    },
  });

  const destinations = (destQuery.data?.destinations ?? []) as Destination[];

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="flex-grow px-5 pt-6 pb-6"
        refreshControl={
          <RefreshControl
            refreshing={destQuery.isRefetching}
            onRefresh={() => destQuery.refetch()}
          />
        }
      >
        <View className="gap-6">
          {/* Header */}
          <View>
            <Text className="text-2xl font-bold text-foreground">Explore</Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              Discover destinations and plan your next adventure
            </Text>
          </View>

          {/* Search */}
          <View className="flex-row items-center rounded-xl border border-border bg-card px-3">
            <Search size={18} color={mutedColor} />
            <TextInput
              className="ml-2 flex-1 py-3 text-base text-foreground"
              placeholder="Search destinations..."
              placeholderTextColor={mutedColor}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Loading */}
          {destQuery.isLoading && (
            <View className="items-center py-8">
              <ActivityIndicator />
            </View>
          )}

          {/* Empty */}
          {!destQuery.isLoading && destinations.length === 0 && searchQuery.length > 0 && (
            <View className="items-center rounded-2xl border border-border bg-card py-8">
              <Compass size={32} color={mutedColor} />
              <Text className="mt-2 text-base font-medium text-foreground">
                No destinations found
              </Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                Try a different search term
              </Text>
            </View>
          )}

          {/* Destination list */}
          {destinations.map((dest) => (
            <DestinationSection key={dest.id} destination={dest} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
