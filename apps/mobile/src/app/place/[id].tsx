import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  ExternalLink,
  Globe,
  MapPin,
  Phone,
  Star,
} from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Text,
  View,
} from "react-native";
import { client } from "@/api/client";
import { Screen } from "@/components/shared/Screen";

type PlaceDetail = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  imageUrl: string | null;
  rating: number | null;
  isCurated: boolean;
  isFeatured: boolean;
  websiteUrl: string | null;
  phoneNumber: string | null;
  priceLevel: number | null;
  reviewCount: number | null;
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

const PRICE_LABELS = ["", "$", "$$", "$$$", "$$$$"];

export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const mutedFg = useUnstableNativeVariable("--muted-foreground");
  const mutedColor = mutedFg ? `hsl(${mutedFg})` : "#9CA3AF";
  const foreground = useUnstableNativeVariable("--foreground");
  const iconColor = foreground ? `hsl(${foreground})` : undefined;

  const placeQuery = useQuery({
    queryKey: ["place", id],
    queryFn: async () => {
      const res = await client.api.v1.places({ id: id! }).get();
      if (res.error) throw new Error("Failed to load place");
      return res.data;
    },
    enabled: !!id,
  });

  const place = placeQuery.data?.place as PlaceDetail | undefined;

  if (placeQuery.isLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (!place) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center gap-2">
          <Text className="text-lg font-semibold text-foreground">Place not found</Text>
          <Pressable onPress={() => router.back()}>
            <Text className="text-primary">Go back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scrollable contentClassName="pb-10">
      <View className="gap-5">
        {/* Header */}
        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center gap-1 active:opacity-80"
        >
          <ChevronLeft size={20} color={iconColor} />
          <Text className="text-base font-medium text-primary">Back</Text>
        </Pressable>

        {/* Title + category */}
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <View className="rounded-full bg-primary/10 px-2.5 py-1">
              <Text className="text-xs font-semibold text-primary">
                {CATEGORY_LABELS[place.category] ?? place.category}
              </Text>
            </View>
            {place.isCurated && (
              <View className="rounded-full bg-chart-2/10 px-2.5 py-1">
                <Text className="text-xs font-semibold text-chart-2">Curated</Text>
              </View>
            )}
            {place.isFeatured && (
              <View className="rounded-full bg-amber-500/10 px-2.5 py-1">
                <Text className="text-xs font-semibold text-amber-600">Featured</Text>
              </View>
            )}
          </View>

          <Text className="text-2xl font-bold text-foreground">{place.name}</Text>

          {/* Rating + reviews */}
          <View className="flex-row items-center gap-3">
            {place.rating && (
              <View className="flex-row items-center gap-1">
                <Star size={16} color="#F59E0B" fill="#F59E0B" />
                <Text className="text-base font-semibold text-foreground">
                  {place.rating.toFixed(1)}
                </Text>
                {place.reviewCount && (
                  <Text className="text-sm text-muted-foreground">
                    ({place.reviewCount.toLocaleString()} reviews)
                  </Text>
                )}
              </View>
            )}
            {place.priceLevel && place.priceLevel > 0 && (
              <Text className="text-sm font-medium text-muted-foreground">
                {PRICE_LABELS[place.priceLevel]}
              </Text>
            )}
          </View>
        </View>

        {/* Description */}
        {place.description && (
          <View className="gap-1">
            <Text className="text-sm font-semibold text-foreground">About</Text>
            <Text className="text-base leading-6 text-muted-foreground">
              {place.description}
            </Text>
          </View>
        )}

        {/* Details */}
        <View className="gap-3 rounded-2xl border border-border bg-card p-4">
          {place.address && (
            <View className="flex-row items-start gap-3">
              <MapPin size={18} color={mutedColor} className="mt-0.5" />
              <Text className="flex-1 text-base text-foreground">{place.address}</Text>
            </View>
          )}

          {place.phoneNumber && (
            <Pressable
              onPress={() => Linking.openURL(`tel:${place.phoneNumber}`)}
              className="flex-row items-center gap-3 active:opacity-80"
            >
              <Phone size={18} color={mutedColor} />
              <Text className="text-base text-primary">{place.phoneNumber}</Text>
            </Pressable>
          )}

          {place.websiteUrl && (
            <Pressable
              onPress={() => Linking.openURL(place.websiteUrl!)}
              className="flex-row items-center gap-3 active:opacity-80"
            >
              <Globe size={18} color={mutedColor} />
              <Text className="flex-1 text-base text-primary" numberOfLines={1}>
                {place.websiteUrl.replace(/^https?:\/\//, "")}
              </Text>
              <ExternalLink size={14} color={mutedColor} />
            </Pressable>
          )}

          {!place.address && !place.phoneNumber && !place.websiteUrl && (
            <Text className="text-sm text-muted-foreground">No additional details available</Text>
          )}
        </View>

        {/* Coordinates */}
        <View className="rounded-xl border border-border bg-muted/30 px-4 py-3">
          <Text className="text-xs text-muted-foreground">
            Coordinates: {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}
          </Text>
        </View>
      </View>
    </Screen>
  );
}
