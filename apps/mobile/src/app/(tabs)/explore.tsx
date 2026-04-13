import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { Heart, LocateFixed, Search, Star } from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useDestinationFavorites } from "@/features/destination/favorites";
import {
  getDestinationTitle,
  POPULAR_DESTINATIONS_QUERY_KEY,
  type PopularDestination,
} from "@/features/destination/popular";

type NearbyPlace = {
  id: string;
  name: string;
  rating: number | null;
  distanceKm?: number;
  imageUrl: string | null;
};

const POPULAR_DESTINATIONS_STALE_TIME_MS = 24 * 60 * 60 * 1000;

function shuffleDestinations(destinations: PopularDestination[]) {
  const shuffled = [...destinations];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

function PopularDestinationCard({
  destination,
  cardWidthClassName = "w-[284px]",
}: {
  destination: PopularDestination;
  cardWidthClassName?: string;
}) {
  const router = useRouter();
  const title = getDestinationTitle(destination);
  const description = destination.description?.trim() || "Explore this destination";

  return (
    <Pressable
      onPress={() => router.push(`/destination/${destination.id}` as never)}
      className={`mr-3 h-48 overflow-hidden rounded-2xl border border-border bg-card ${cardWidthClassName} active:opacity-90`}
    >
      {destination.imageUrl ? (
        <Image
          source={{ uri: destination.imageUrl }}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View className="absolute inset-0 bg-card" />
      )}
      <View className="absolute inset-0 bg-black/25" />
      <View className="absolute bottom-0 left-0 right-0 p-4">
        <Text className="text-xl font-bold text-white" numberOfLines={1}>
          {title}
        </Text>
        <Text className="mt-1 text-sm text-slate-200" numberOfLines={1}>
          {description}
        </Text>
      </View>
    </Pressable>
  );
}

function NearbyFavoriteCard({ place }: { place: NearbyPlace }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/place/${place.id}` as never)}
      className="mr-3 w-52 overflow-hidden rounded-2xl border border-border bg-card active:opacity-90"
    >
      <View className="h-28 bg-muted">
        {place.imageUrl ? (
          <Image
            source={{ uri: place.imageUrl }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View className="h-full w-full bg-muted" />
        )}
      </View>
      <View className="gap-1 p-3">
        <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
          {place.name}
        </Text>
        <View className="flex-row items-center gap-1.5">
          {place.rating !== null ? (
            <>
              <Star size={12} color="#F59E0B" fill="#F59E0B" />
              <Text className="text-xs text-foreground">{place.rating.toFixed(1)}</Text>
            </>
          ) : (
            <Text className="text-xs text-muted-foreground">No rating yet</Text>
          )}
          {typeof place.distanceKm === "number" ? (
            <Text className="text-xs text-muted-foreground">
              · {place.distanceKm.toFixed(1)} km
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function ExploreScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { favoriteDestinations } = useDestinationFavorites();
  const hasFavoriteDestinations = favoriteDestinations.length > 0;
  const mutedFg = useUnstableNativeVariable("--muted-foreground");
  const mutedColor = mutedFg ? `hsl(${mutedFg})` : "#9CA3AF";
  const [searchQuery, setSearchQuery] = useState("");
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [shuffledPopularDestinations, setShuffledPopularDestinations] = useState<
    PopularDestination[]
  >([]);

  const fetchNearbyFavorites = useCallback(async (coords: { lat: number; lng: number }) => {
    const res = await client.api.v1.places.nearby.get({
      query: {
        lat: coords.lat,
        lng: coords.lng,
        radiusKm: 20,
        limit: 12,
      },
    });
    if (res.error) throw new Error("Failed to load nearby favorites");
    return res.data;
  }, []);

  const requestCurrentLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      return { coords: null, error: "Location permission denied" as string | null };
    }
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
      return { coords, error: null as string | null };
    } catch {
      return { coords: null, error: "Unable to fetch current location" as string | null };
    }
  }, []);

  const loadCurrentLocation = useCallback(async () => {
    const result = await requestCurrentLocation();
    setLocationCoords(result.coords);
    setLocationError(result.error);
    return result.coords;
  }, [requestCurrentLocation]);

  useEffect(() => {
    let mounted = true;
    async function loadLocation() {
      const result = await requestCurrentLocation();
      if (!mounted) return;
      setLocationCoords(result.coords);
      setLocationError(result.error);
    }
    void loadLocation();
    return () => {
      mounted = false;
    };
  }, [requestCurrentLocation]);

  const popularQuery = useQuery({
    queryKey: POPULAR_DESTINATIONS_QUERY_KEY,
    queryFn: async () => {
      const res = await client.api.v1.destinations.popular.get();
      if (res.error) throw new Error("Failed to load popular destinations");
      return res.data;
    },
    staleTime: POPULAR_DESTINATIONS_STALE_TIME_MS,
  });

  const nearbyQuery = useQuery({
    queryKey: ["nearby-favorites", locationCoords?.lat, locationCoords?.lng],
    queryFn: async () => {
      if (!locationCoords) throw new Error("Location unavailable");
      return fetchNearbyFavorites(locationCoords);
    },
    enabled: !!locationCoords,
  });

  const popularDestinations = (popularQuery.data?.destinations ?? []) as PopularDestination[];
  useEffect(() => {
    setShuffledPopularDestinations(popularDestinations);
  }, [popularDestinations]);

  const visiblePopularDestinations = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return shuffledPopularDestinations;
    return shuffledPopularDestinations.filter((destination) => {
      const haystack =
        `${destination.name} ${destination.country} ${destination.description ?? ""}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [searchQuery, shuffledPopularDestinations]);

  const nearbyFavorites = (nearbyQuery.data?.places ?? []) as NearbyPlace[];

  const onRefresh = async () => {
    setIsRefreshing(true);
    setShuffledPopularDestinations((current) =>
      shuffleDestinations(current.length > 0 ? current : popularDestinations),
    );
    try {
      const coords = await loadCurrentLocation();
      if (coords) {
        await queryClient.fetchQuery({
          queryKey: ["nearby-favorites", coords.lat, coords.lng],
          queryFn: () => fetchNearbyFavorites(coords),
        });
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="flex-grow px-5 pt-6 pb-6"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || popularQuery.isRefetching || nearbyQuery.isRefetching}
            onRefresh={onRefresh}
          />
        }
      >
        <View className="gap-6">
          <View className="flex-row items-start justify-between">
            <View>
              <Text className="text-2xl font-bold text-foreground">Explore</Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                Discover popular destinations and nearby favorites
              </Text>
            </View>
            <Pressable
              onPress={() => router.push("/destination/favorites" as never)}
              className="h-10 w-10 items-center justify-center rounded-full border border-border bg-card active:opacity-85"
              accessibilityRole="button"
              accessibilityLabel="View favorite destinations"
            >
              <Heart
                size={18}
                color={hasFavoriteDestinations ? "#EC4899" : mutedColor}
                fill={hasFavoriteDestinations ? "#EC4899" : "none"}
              />
            </Pressable>
          </View>

          <View className="flex-row items-center rounded-xl border border-border bg-card px-3">
            <Search size={18} color={mutedColor} />
            <TextInput
              className="ml-2 flex-1 py-3 text-base text-foreground"
              placeholder="Search destinations, food, or sights..."
              placeholderTextColor={mutedColor}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-foreground">Popular Destinations</Text>
              <Pressable onPress={() => router.push("/popular-destinations" as never)}>
                <Text className="text-base font-semibold text-primary">See All</Text>
              </Pressable>
            </View>

            {popularQuery.isLoading ? (
              <View className="items-center py-8">
                <ActivityIndicator />
              </View>
            ) : visiblePopularDestinations.length === 0 ? (
              <Text className="text-sm text-muted-foreground">
                {searchQuery.trim()
                  ? "No destinations matched your search."
                  : "No popular destinations available yet."}
              </Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="pl-0.5"
              >
                {visiblePopularDestinations.map((destination) => (
                  <PopularDestinationCard key={destination.id} destination={destination} />
                ))}
              </ScrollView>
            )}
          </View>

          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-foreground">Nearby Favorites</Text>
              <View className="flex-row items-center gap-1">
                <LocateFixed size={14} color={mutedColor} />
                <Text className="text-xs text-muted-foreground">Near you</Text>
              </View>
            </View>

            {nearbyQuery.isLoading ? (
              <View className="items-center py-4">
                <ActivityIndicator />
              </View>
            ) : locationError ? (
              <Text className="text-sm text-muted-foreground">
                {locationError}. Enable location to view nearby favorites.
              </Text>
            ) : nearbyFavorites.length === 0 ? (
              <Text className="text-sm text-muted-foreground">
                No nearby favorites found in your area right now.
              </Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="pl-0.5"
              >
                {nearbyFavorites.map((place) => (
                  <NearbyFavoriteCard key={place.id} place={place} />
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
