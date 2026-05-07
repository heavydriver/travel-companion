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
  Languages,
  Star,
  Thermometer,
} from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { memo, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { client } from "@/api/client";
import { showAppToast } from "@/components/shared/AppToast";
import { PlaceCard } from "@/components/shared/PlaceCard";
import { useDestinationFavorites } from "@/features/destination/favorites";
import {
  buildOfflineMapSession,
  sliceOfflineWeatherData,
  useOfflinePackQuery,
} from "@/features/offline/pack";
import { formatTempFromC } from "@/lib/units";
import { usePreferencesStore } from "@/store/preferencesStore";
import { useNetworkStore } from "@/store/networkStore";
import { hasEligibleTripForDestination, type Trip, useTripStore } from "@/store/tripStore";
import { useMapSessionStore, type MapSessionPlace } from "@/store/mapSessionStore";

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
  isFeatured: boolean;
  priceLevel: number | null;
  address: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  openingHours?: unknown | null;
};

type DestinationLanguageLink = {
  id: string;
  isPrimary: boolean;
  language: { id: string; name: string; isoCode: string; nativeName: string };
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
  latitude: number;
  longitude: number;
  languages: DestinationLanguageLink[];
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

/** Local wall clock in IANA zone, e.g. `22:10`. */
function formatDestinationLocalClock(ianaTimeZone: string, at: Date): string {
  const tz = ianaTimeZone.trim();
  if (!tz) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(at);
  } catch {
    return tz;
  }
}

/** Offset label e.g. `UTC+5:30` for zone at `at`. */
function formatDestinationGmtStyleOffset(ianaTimeZone: string, at: Date): string {
  const tz = ianaTimeZone.trim();
  if (!tz) return "—";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      timeZoneName: "longOffset",
    }).formatToParts(at);
    const offsetRaw = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    if (!offsetRaw) return tz;
    return offsetRaw
      .replace(/^GMT/i, "UTC")
      .replace(/\u2212/g, "-")
      .replace(/\s+/g, "");
  } catch {
    return tz;
  }
}

function pickNonEnglishDestinationLanguage(
  links: DestinationLanguageLink[],
): DestinationLanguageLink | null {
  const list = links.filter((l) => l.language.isoCode.toLowerCase() !== "en");
  if (list.length === 0) return null;
  return list.find((l) => l.isPrimary) ?? list[0] ?? null;
}

function readOpenMeteoCurrentTempC(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const cur = (data as { current?: unknown }).current;
  if (!cur || typeof cur !== "object") return null;
  const t = (cur as { temperature_2m?: unknown }).temperature_2m;
  return typeof t === "number" && Number.isFinite(t) ? t : null;
}

function shufflePlaces<T>(places: T[]): T[] {
  const shuffled = [...places];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
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

function toMapSessionPlaces(places: PlacePreview[]): MapSessionPlace[] {
  return places.map((p) => ({
    id: p.id,
    destinationId: p.destinationId,
    name: p.name,
    category: p.category,
    description: p.description,
    latitude: p.latitude,
    longitude: p.longitude,
    imageUrl: p.imageUrl,
    rating: p.rating,
    reviewCount: p.reviewCount,
    isCurated: p.isCurated,
    isFeatured: p.isFeatured,
    openingHours: p.openingHours ?? null,
  }));
}

export default function DestinationDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const setMapSession = useMapSessionStore((s) => s.setSession);
  const insets = useSafeAreaInsets();
  const { isFavorite, toggleFavorite } = useDestinationFavorites();
  const isConnected = useNetworkStore((state) => state.isConnected);
  const storeTrips = useTripStore((state) => state.trips);
  const primaryVar = useUnstableNativeVariable("--primary");
  const accentColor = primaryVar ? `hsl(${primaryVar})` : "#3B82F6";
  const unitSystem = usePreferencesStore((s) => s.unitSystem);

  const [now, setNow] = useState(() => new Date());
  const [timeMode, setTimeMode] = useState<"local" | "gmt">("local");
  const offlinePackQuery = useOfflinePackQuery(id);
  const offlinePack = offlinePackQuery.data;
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(tick);
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
    refetchOnWindowFocus: false,
  });

  const [shuffledCuratedPlaces, setShuffledCuratedPlaces] = useState<PlacePreview[]>([]);
  const [shuffledOtherPlaces, setShuffledOtherPlaces] = useState<PlacePreview[]>([]);

  const curatedPlacesSource = useMemo(() => {
    if (destinationQuery.data?.curatedPlaces) {
      return destinationQuery.data.curatedPlaces as PlacePreview[];
    }
    return (offlinePack?.curatedPlaces ?? []) as PlacePreview[];
  }, [destinationQuery.data?.curatedPlaces, offlinePack?.curatedPlaces]);
  const otherPlacesSource = useMemo(() => {
    if (destinationQuery.data?.otherPlaces) {
      return destinationQuery.data.otherPlaces as PlacePreview[];
    }
    return (offlinePack?.otherPlaces ?? []) as PlacePreview[];
  }, [destinationQuery.data?.otherPlaces, offlinePack?.otherPlaces]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: dataUpdatedAt triggers reshuffle after refetch when TanStack keeps same place array refs
  useEffect(() => {
    setShuffledCuratedPlaces(shufflePlaces(curatedPlacesSource));
    setShuffledOtherPlaces(shufflePlaces(otherPlacesSource));
  }, [destinationQuery.dataUpdatedAt, curatedPlacesSource, otherPlacesSource]);

  const destForQueries =
    (destinationQuery.data?.destination as DestinationDetail | undefined) ??
    (offlinePack?.destination as DestinationDetail | undefined);

  const tripsForDestinationQuery = useQuery({
    queryKey: ["trips", "destination", id],
    queryFn: async () => {
      if (!id) throw new Error("Missing destination id");
      const res = await client.api.v1.trips.get({
        query: { destinationId: id },
      });
      if (res.error) throw new Error("Failed to load trips");
      return res.data;
    },
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  });

  const weatherPeekQuery = useQuery({
    queryKey: [
      "weather-forecast",
      destForQueries?.latitude,
      destForQueries?.longitude,
      destForQueries?.timezone,
      7,
    ],
    queryFn: async () => {
      if (!destForQueries) throw new Error("No destination");
      const res = await client.api.v1.weather.forecast.get({
        query: {
          latitude: destForQueries.latitude,
          longitude: destForQueries.longitude,
          forecastDays: 7,
          timezone: destForQueries.timezone,
        },
      });
      if (res.error) throw new Error("Weather failed");
      return res.data;
    },
    enabled: Boolean(destForQueries && isConnected),
    staleTime: 10 * 60 * 1000,
  });

  const allPlaces = useMemo(() => {
    const curated = curatedPlacesSource as PlacePreview[];
    const other = otherPlacesSource as PlacePreview[];
    return [...curated, ...other];
  }, [curatedPlacesSource, otherPlacesSource]);

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

  if (destinationQuery.isLoading && !offlinePack) {
    return (
      <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  const destination =
    (destinationQuery.data?.destination as DestinationDetail | undefined) ??
    (offlinePack?.destination as DestinationDetail | undefined);

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
  const languageForGuide = pickNonEnglishDestinationLanguage(destination.languages ?? []);
  const hasActiveOrUpcomingTrip = hasEligibleTripForDestination(
    (((tripsForDestinationQuery.data?.trips ?? []) as Trip[]).length > 0
      ? ((tripsForDestinationQuery.data?.trips ?? []) as Trip[])
      : storeTrips) as Trip[],
    destination.id,
  );
  const peekTempC = readOpenMeteoCurrentTempC(
    (weatherPeekQuery.data as unknown) ?? sliceOfflineWeatherData(offlinePack, 7),
  );

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingBottom: hasActiveOrUpcomingTrip ? 32 : 120 }}
        className="flex-1"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
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
              {languageForGuide ? (
                <OverlayIconButton
                  onPress={() =>
                    router.push({
                      pathname: "/language-guide",
                      params: {
                        languageId: languageForGuide.language.id,
                        destinationId: destination.id,
                      },
                    } as never)
                  }
                >
                  <Languages size={18} color="#fff" />
                </OverlayIconButton>
              ) : null}
              <OverlayIconButton
                onPress={() => {
                  const wasFavorite = favorite;
                  void (async () => {
                    try {
                      await toggleFavorite(destination.id, {
                        name: destination.name,
                        country: destination.country,
                        imageUrl: destination.imageUrl,
                      });
                      showAppToast({
                        variant: wasFavorite ? "destructive" : "success",
                        title: wasFavorite ? "Removed from favorites" : "Added to favorites",
                        message: wasFavorite
                          ? `${destination.name} was removed from favorite destinations`
                          : `${destination.name} was added to favorite destinations`,
                      });
                    } catch {
                      showAppToast({
                        variant: "error",
                        title: "Could not update favorites",
                        message: "Please try again.",
                      });
                    }
                  })();
                }}
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
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/weather",
                params: {
                  destinationId: destination.id,
                  lat: String(destination.latitude),
                  lng: String(destination.longitude),
                  timezone: destination.timezone,
                  name: destination.name,
                  days: "7",
                },
              } as never)
            }
            className="items-center gap-1 active:opacity-75"
            style={{ width: SCREEN_WIDTH / 4 - 8 }}
          >
            <Thermometer size={20} color={accentColor} />
            <Text className="text-center text-[11px] font-medium text-foreground">
              {formatTempFromC(peekTempC, unitSystem)}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTimeMode((m) => (m === "local" ? "gmt" : "local"))}
            className="items-center gap-1 active:opacity-75"
            style={{ width: SCREEN_WIDTH / 4 - 8 }}
          >
            <Clock size={20} color={accentColor} />
            <Text className="text-center text-[11px] font-medium text-foreground" numberOfLines={2}>
              {timeMode === "local"
                ? formatDestinationLocalClock(destination.timezone, now)
                : formatDestinationGmtStyleOffset(destination.timezone, now)}
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/currency",
                params: {
                  base: destination.currencyCode.toUpperCase(),
                  quote: "USD",
                  destinationId: destination.id,
                },
              } as never)
            }
            className="items-center gap-1 active:opacity-75"
            style={{ width: SCREEN_WIDTH / 4 - 8 }}
          >
            <Banknote size={20} color={accentColor} />
            <Text className="text-center text-[11px] font-medium text-foreground" numberOfLines={2}>
              {currencyLabel(destination.currencyCode)}
            </Text>
          </Pressable>
        </View>

        <View className="gap-6 px-5 pt-5">
          <View>
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-foreground">Must-Visit Places</Text>
              <Pressable
                onPress={() => {
                  setMapSession(
                    offlinePack
                      ? buildOfflineMapSession(offlinePack, {
                          returnHref: `/destination/${destination.id}`,
                          startWithCuratedPlacesOnly: true,
                        })
                      : {
                          destinationId: destination.id,
                          destinationName: destination.name,
                          latitude: destination.latitude,
                          longitude: destination.longitude,
                          timezone: destination.timezone,
                          places: toMapSessionPlaces(allPlaces),
                          returnHref: `/destination/${destination.id}`,
                          startWithCuratedPlacesOnly: true,
                        },
                  );
                  router.push("/(tabs)/map" as never);
                }}
                hitSlop={8}
              >
                <Text className="text-sm font-semibold text-primary">See Map</Text>
              </Pressable>
            </View>
            {shuffledCuratedPlaces.length === 0 ? (
              <Text className="text-sm text-muted-foreground">No curated places yet.</Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 8 }}
              >
                {shuffledCuratedPlaces.map((place) => (
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
            {shuffledOtherPlaces.length === 0 ? (
              <Text className="py-6 text-center text-sm text-muted-foreground">
                No more activities listed yet.
              </Text>
            ) : (
              <View className="gap-3">
                {shuffledOtherPlaces.map((place) => {
                  const priceText = formatPlacePrice(place, destination.currencyCode);
                  const categoryLabel = titleCaseWords(place.category.trim() || "Place");
                  return (
                    <PlaceCard
                      key={place.id}
                      title={place.name}
                      subtitle={place.description}
                      rating={place.rating}
                      imageUrl={place.imageUrl}
                      metaRight={
                        <>
                          <Text className="text-xs font-semibold text-primary">
                            {categoryLabel}
                          </Text>
                          {priceText != null ? (
                            <>
                              <Text className="text-xs text-muted-foreground">·</Text>
                              <Text className="text-xs font-normal text-accent">{priceText}</Text>
                            </>
                          ) : null}
                        </>
                      }
                      onPress={() => router.push(`/place/${place.id}` as never)}
                    />
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {!hasActiveOrUpcomingTrip ? (
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
      ) : null}
    </SafeAreaView>
  );
}
