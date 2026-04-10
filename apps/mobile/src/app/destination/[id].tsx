import { useQuery } from "@tanstack/react-query";
import { approximateNumber as approx } from "approximate-number";
import getSymbolFromCurrency from "currency-symbol-map";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Banknote,
  ChevronLeft,
  CirclePlus,
  Clock,
  Heart,
  Share2,
  Star,
  Thermometer,
} from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { memo, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { client } from "@/api/client";
import { useDestinationFavorites } from "@/features/destination/favorites";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_HEIGHT = Math.min(400, Math.round(SCREEN_WIDTH * 1.05));
const CAROUSEL_CARD_WIDTH = Math.min(284, SCREEN_WIDTH * 0.78);

type PlacePreview = {
  id: string;
  destinationId: string;
  name: string;
  category: string;
  description: string | null;
  rating: number | null;
  reviewCount: number | null;
  imageUrl: string | null;
  isCurated: boolean;
  priceLevel: number | null;
  address: string | null;
  city: string | null;
};

type DestinationDetail = {
  id: string;
  name: string;
  country: string;
  region: string | null;
  description: string | null;
  timezone: string;
  currencyCode: string;
  bestTimeToVisit: string | null;
  emergencyNumber: string | null;
  imageUrl: string | null;
  kind: string | null;
};

function formatKindLabel(kind: string | null): string {
  if (!kind?.trim()) return "DESTINATION";
  return kind.replace(/_/g, " ").toUpperCase();
}

function aggregatePlaceRatings(places: PlacePreview[]): {
  rating: number;
  reviewText: string;
} | null {
  let weighted = 0;
  let totalReviews = 0;
  for (const p of places) {
    if (p.rating != null && p.reviewCount != null && p.reviewCount > 0) {
      weighted += p.rating * p.reviewCount;
      totalReviews += p.reviewCount;
    }
  }
  if (totalReviews > 0) {
    return {
      rating: weighted / totalReviews,
      reviewText: `${approx(totalReviews)} reviews`,
    };
  }
  const rated = places.filter((p) => p.rating != null);
  if (rated.length === 0) return null;
  const avg = rated.reduce((s, p) => s + (p.rating ?? 0), 0) / rated.length;
  return {
    rating: avg,
    reviewText: `${rated.length} rated places`,
  };
}

function currencyLabel(code: string): string {
  const upper = code.toUpperCase();
  const sym = getSymbolFromCurrency(upper);
  return sym ? `${upper} (${sym})` : upper;
}

/** Local wall time in `ianaTimeZone` plus offset, e.g. `22:10 (UTC+5:30)`. */
function formatDestinationClock(ianaTimeZone: string, at: Date): string {
  const tz = ianaTimeZone.trim();
  if (!tz) return "—";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "longOffset",
    }).formatToParts(at);

    let hour = "";
    let minute = "";
    let offsetRaw = "";
    for (const p of parts) {
      if (p.type === "hour") hour = p.value;
      if (p.type === "minute") minute = p.value;
      if (p.type === "timeZoneName") offsetRaw = p.value;
    }
    const time = `${hour}:${minute}`;
    if (!offsetRaw) {
      return `${time} (${tz})`;
    }
    const offset = offsetRaw
      .replace(/^GMT/i, "UTC")
      .replace(/\u2212/g, "-")
      .replace(/\s+/g, "");
    return `${time}`;
  } catch {
    return tz;
  }
}

function titleCaseWords(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** Returns null when the API did not provide a price tier — hide price UI entirely. */
function formatPlacePrice(place: PlacePreview, currencyCode: string): string | null {
  if (place.priceLevel === null) return null;
  if (place.priceLevel === 0) return "Free";
  const level = Math.min(4, Math.max(1, Math.round(place.priceLevel)));
  const sym = getSymbolFromCurrency(currencyCode.toUpperCase()) ?? "";
  return sym ? `From ${sym}${level * 15}+` : "$".repeat(level);
}

const OverlayIconButton = memo(function OverlayIconButton({
  onPress,
  children,
}: {
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="h-11 w-11 items-center justify-center rounded-full bg-black/45 active:opacity-80"
    >
      {children}
    </Pressable>
  );
});

const MustVisitCard = memo(function MustVisitCard({
  place,
  currencyCode,
}: {
  place: PlacePreview;
  currencyCode: string;
}) {
  const router = useRouter();
  const priceText = formatPlacePrice(place, currencyCode);
  const categoryLabel = titleCaseWords(place.category.trim() || "Place");

  return (
    <Pressable
      onPress={() => router.push(`/place/${place.id}` as never)}
      style={{ width: CAROUSEL_CARD_WIDTH }}
      className="mr-3 overflow-hidden rounded-2xl border border-border/60 bg-card active:opacity-90"
    >
      <View className="relative h-40 w-full bg-muted">
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
        {place.rating != null && (
          <View className="absolute right-2 top-2 flex-row items-center gap-1 rounded-lg bg-black/55 px-2 py-1">
            <Star size={12} color="#FBBF24" fill="#FBBF24" />
            <Text className="text-xs font-semibold text-white">{place.rating.toFixed(1)}</Text>
          </View>
        )}
      </View>
      <View className="gap-1.5 p-3.5">
        <Text className="text-base font-bold text-foreground" numberOfLines={1}>
          {place.name}
        </Text>
        {place.description ? (
          <Text className="text-xs leading-4 text-muted-foreground" numberOfLines={2}>
            {place.description}
          </Text>
        ) : null}
        <View className="mt-1 flex-row flex-wrap items-center gap-1">
          <Text className="text-xs font-semibold text-primary">{categoryLabel}</Text>
          {priceText != null ? (
            <>
              <Text className="text-xs text-muted-foreground">·</Text>
              <Text className="text-xs font-normal text-accent">{priceText}</Text>
            </>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

const ThingToDoRow = memo(function ThingToDoRow({
  place,
  currencyCode,
}: {
  place: PlacePreview;
  currencyCode: string;
}) {
  const router = useRouter();
  const priceText = formatPlacePrice(place, currencyCode);
  const categoryLabel = titleCaseWords(place.category.trim() || "Place");

  return (
    <View className="rounded-2xl border border-border/80 bg-card/30 overflow-hidden px-2">
      <Pressable
        onPress={() => router.push(`/place/${place.id}` as never)}
        className="flex-row gap-3 border-b border-border/50 py-3.5 pl-1 pr-1 active:opacity-85 last:border-b-0"
      >
        <View className="h-[4.5rem] w-[4.5rem] overflow-hidden rounded-xl bg-muted">
          {place.imageUrl ? (
            <Image
              source={{ uri: place.imageUrl }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              transition={150}
            />
          ) : null}
        </View>
        <View className="min-w-0 flex-1 justify-center">
          <Text className="text-base font-semibold text-foreground" numberOfLines={2}>
            {place.name}
          </Text>
          {place.description ? (
            <Text className="mt-0.5 text-xs leading-4 text-muted-foreground" numberOfLines={1}>
              {place.description}
            </Text>
          ) : null}
          <View className="mt-1.5 flex-row flex-wrap items-center gap-1">
            {place.rating != null ? (
              <>
                <Star size={12} color="#FBBF24" fill="#FBBF24" />
                <Text className="text-xs text-muted-foreground">{place.rating.toFixed(1)}</Text>
                <Text className="text-xs text-muted-foreground">·</Text>
              </>
            ) : null}
            <Text className="text-xs font-semibold text-primary">{categoryLabel}</Text>
            {priceText != null ? (
              <>
                <Text className="text-xs text-muted-foreground">·</Text>
                <Text className="text-xs font-normal text-accent">{priceText}</Text>
              </>
            ) : null}
          </View>
        </View>
      </Pressable>
    </View>
  );
});

export default function DestinationDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isFavorite, toggleFavorite } = useDestinationFavorites();
  const primaryVar = useUnstableNativeVariable("--primary");
  const accentColor = primaryVar ? `hsl(${primaryVar})` : "#3B82F6";

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const destinationQuery = useQuery({
    queryKey: ["destination-details", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Missing destination id");
      }
      const res = await client.api.v1.destinations({ destId: id }).get();
      if (res.error) throw new Error("Failed to load destination");
      return res.data;
    },
    enabled: !!id,
  });

  const allPlaces = useMemo(() => {
    const curated = (destinationQuery.data?.curatedPlaces ?? []) as PlacePreview[];
    const other = (destinationQuery.data?.otherPlaces ?? []) as PlacePreview[];
    return [...curated, ...other];
  }, [destinationQuery.data?.curatedPlaces, destinationQuery.data?.otherPlaces]);

  const ratingStats = useMemo(() => aggregatePlaceRatings(allPlaces), [allPlaces]);

  const openTrip = useCallback(
    (destination: DestinationDetail) => {
      router.push({
        pathname: "/trip/new",
        params: {
          destinationId: destination.id,
          destinationName: destination.name,
          destinationCountry: destination.country,
        },
      } as never);
    },
    [router],
  );

  if (destinationQuery.isLoading) {
    return (
      <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  const destination = destinationQuery.data?.destination as DestinationDetail | undefined;
  const curatedPlaces = (destinationQuery.data?.curatedPlaces ?? []) as PlacePreview[];
  const otherPlaces = (destinationQuery.data?.otherPlaces ?? []) as PlacePreview[];

  if (!destination) {
    return (
      <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-base text-muted-foreground">Destination not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const favorite = isFavorite(destination.id);
  const kindLabel = formatKindLabel(destination.kind);

  const onShare = () => {
    const line = destination.description?.trim() || `Explore ${destination.name}`;
    void Share.share({
      message: `${destination.name} — ${line}`,
      title: destination.name,
    });
  };

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="relative w-full" style={{ height: HERO_HEIGHT }}>
          {destination.imageUrl ? (
            <Image
              source={{ uri: destination.imageUrl }}
              style={{ width: SCREEN_WIDTH, height: HERO_HEIGHT }}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View className="h-full w-full bg-muted" />
          )}
          <View className="absolute inset-0 bg-black/10" />
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(0,0,0,0.8)", "rgba(0,0,0,0)"]}
            start={{ x: 0.5, y: 1 }}
            end={{ x: 0.5, y: 0 }}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: HERO_HEIGHT / 2.5,
              // opacity: 0.3,
            }}
          />

          <View
            className="absolute left-0 right-0 flex-row items-center justify-between px-4"
            style={{ top: insets.top + 8 }}
          >
            <OverlayIconButton onPress={() => router.back()}>
              <ChevronLeft size={22} color="#fff" />
            </OverlayIconButton>
            <View className="flex-row gap-2">
              {/* <OverlayIconButton onPress={onShare}>
                <Share2 size={18} color="#fff" />
              </OverlayIconButton> */}
              <OverlayIconButton
                onPress={() =>
                  void toggleFavorite(destination.id, {
                    name: destination.name,
                    country: destination.country,
                    region: destination.region,
                  })
                }
              >
                <Heart
                  size={18}
                  color={favorite ? "#F472B6" : "#fff"}
                  fill={favorite ? "#F472B6" : "transparent"}
                />
              </OverlayIconButton>
            </View>
          </View>

          <View className="absolute bottom-0 left-0 right-0 px-5 pb-6">
            <View className="mb-2 flex-row flex-wrap items-center gap-2">
              <View className="rounded-md bg-primary px-2.5 py-1">
                <Text className="text-[10px] font-extrabold tracking-wide text-primary-foreground">
                  {kindLabel}
                </Text>
              </View>
              {ratingStats ? (
                <View className="flex-row items-center gap-1">
                  <Star size={14} color="#FBBF24" fill="#FBBF24" />
                  <Text className="text-sm font-semibold text-white">
                    {ratingStats.rating.toFixed(1)} ({ratingStats.reviewText})
                  </Text>
                </View>
              ) : null}
            </View>
            <Text className="text-3xl font-bold text-white">{destination.name}</Text>
            {destination.description ? (
              <Text className="mt-2 text-sm leading-5 text-white/90">
                {destination.description}
              </Text>
            ) : null}
          </View>
        </View>

        <View className="pt-4 flex-row justify-around border-b border-border pb-4 bg-card/30">
          <View className="items-center gap-1" style={{ width: SCREEN_WIDTH / 4 - 8 }}>
            <Thermometer size={20} color={accentColor} />
            <Text className="text-center text-[11px] font-medium text-foreground">18°C</Text>
          </View>
          <View className="items-center gap-1" style={{ width: SCREEN_WIDTH / 4 - 8 }}>
            <Clock size={20} color={accentColor} />
            <Text className="text-center text-[11px] font-medium text-foreground" numberOfLines={2}>
              {formatDestinationClock(destination.timezone, now)}
            </Text>
          </View>
          <View className="items-center gap-1" style={{ width: SCREEN_WIDTH / 4 - 8 }}>
            <Banknote size={20} color={accentColor} />
            <Text className="text-center text-[11px] font-medium text-foreground" numberOfLines={2}>
              {currencyLabel(destination.currencyCode)}
            </Text>
          </View>
        </View>

        <View className="gap-6 px-5 pt-5">
          <View>
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-foreground">Must-Visit Places</Text>
              <Pressable onPress={() => router.push("/(tabs)/map" as never)} hitSlop={8}>
                <Text className="text-sm font-semibold text-primary">See Map</Text>
              </Pressable>
            </View>
            {curatedPlaces.length === 0 ? (
              <Text className="text-sm text-muted-foreground">No curated places yet.</Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 8 }}
              >
                {curatedPlaces.map((place) => (
                  <MustVisitCard
                    key={place.id}
                    place={place}
                    currencyCode={destination.currencyCode}
                  />
                ))}
              </ScrollView>
            )}
          </View>

          <View>
            <Text className="mb-3 text-lg font-bold text-foreground">Things to Do</Text>
            <View className="overflow-hidden gap-3">
              {otherPlaces.length === 0 ? (
                <Text className="py-6 text-center text-sm text-muted-foreground">
                  No more activities listed yet.
                </Text>
              ) : (
                otherPlaces.map((place) => (
                  <ThingToDoRow
                    key={place.id}
                    place={place}
                    currencyCode={destination.currencyCode}
                  />
                ))
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 px-4 pb-2 pt-1"
        pointerEvents="box-none"
        style={{ bottom: insets.bottom }}
      >
        <Pressable
          onPress={() => openTrip(destination)}
          className="flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 active:opacity-90"
        >
          <View className="shrink-0">
            <CirclePlus size={30} color="#fff" strokeWidth={2.25} />
          </View>
          <Text
            className="max-w-[72%] shrink text-center text-lg font-semibold leading-5 text-primary-foreground"
            numberOfLines={2}
          >
            Create trip to {destination.name}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
