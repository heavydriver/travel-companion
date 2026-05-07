import { useQuery, useQueryClient } from "@tanstack/react-query";
import { approximateNumber as approx } from "approximate-number";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  CirclePlus,
  Clock,
  ExternalLink,
  Globe,
  MapPin,
  Phone,
  Route,
  Star,
} from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { memo, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { client } from "@/api/client";
import { AddItineraryItemModal } from "@/components/shared/AddItineraryItemModal";
import { showAppToast } from "@/components/shared/AppToast";
import { Button } from "@/components/shared/Button";
import {
  buildOfflineMapSession,
  findOfflinePackByPlaceId,
  getOfflinePlaceFromPack,
} from "@/features/offline/pack";
import { useOfflineItineraryStore } from "@/store/offlineItineraryStore";
import {
  createCurrentLocationNavigationPoint,
  useMapNavigationStore,
} from "@/store/mapNavigationStore";
import { type MapSessionPlace, useMapSessionStore } from "@/store/mapSessionStore";
import { getEligibleTripForDestination, type Trip, useTripStore } from "@/store/tripStore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
/** Slightly shorter than destination hero — closer to a maps preview strip. */
const HERO_HEIGHT = Math.min(280, Math.round(SCREEN_WIDTH * 0.62));

const WEEK_MINUTES = 7 * 24 * 60;
const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type OpeningEndpoint = { day: number; hour: number; minute: number };
type OpeningPeriod = { open: OpeningEndpoint; close: OpeningEndpoint };

type OpeningHoursPayload = {
  openNow?: boolean;
  periods?: OpeningPeriod[];
  nextCloseTime?: string;
};

type PlaceDetail = {
  id: string;
  destinationId: string;
  name: string;
  category: string;
  description: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  city: string | null;
  imageUrl: string | null;
  websiteUrl: string | null;
  phoneNumber: string | null;
  priceLevel: number | null;
  rating: number | null;
  reviewCount: number | null;
  isCurated: boolean;
  openingHours: unknown;
};

function toMinutes(day: number, hour: number, minute: number): number {
  return day * 24 * 60 + hour * 60 + minute;
}

/** API convention: 0 = Monday … 6 = Sunday — wall clock in destination IANA zone. */
const WEEKDAY_LONG_TO_API: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

function apiDayAndWeekMinutesInTimeZone(
  timeZone: string,
  at: Date,
): { apiDay: number; minutesFromWeekStart: number } | null {
  const tz = timeZone.trim();
  if (!tz) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23",
    }).formatToParts(at);
    const wdRaw = parts.find((p) => p.type === "weekday")?.value?.toLowerCase() ?? "";
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    const minute = Number(parts.find((p) => p.type === "minute")?.value);
    const apiDay = WEEKDAY_LONG_TO_API[wdRaw];
    if (apiDay === undefined || Number.isNaN(hour) || Number.isNaN(minute)) return null;
    return { apiDay, minutesFromWeekStart: apiDay * 24 * 60 + hour * 60 + minute };
  } catch {
    return null;
  }
}

function parseOpeningHours(raw: unknown): OpeningHoursPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const periodsRaw = o.periods;
  if (!Array.isArray(periodsRaw)) return null;
  const periods: OpeningPeriod[] = [];
  for (const p of periodsRaw) {
    if (!p || typeof p !== "object") continue;
    const pr = p as Record<string, unknown>;
    const open = pr.open as Record<string, unknown> | undefined;
    const close = pr.close as Record<string, unknown> | undefined;
    if (!open || !close) continue;
    const od = Number(open.day);
    const oh = Number(open.hour);
    const om = Number(open.minute);
    const cd = Number(close.day);
    const ch = Number(close.hour);
    const cm = Number(close.minute);
    if (
      [od, oh, om, cd, ch, cm].some((n) => Number.isNaN(n)) ||
      od < 0 ||
      od > 6 ||
      cd < 0 ||
      cd > 6
    ) {
      continue;
    }
    periods.push({
      open: { day: od, hour: oh, minute: om },
      close: { day: cd, hour: ch, minute: cm },
    });
  }
  if (periods.length === 0) return null;
  return {
    periods,
    openNow: typeof o.openNow === "boolean" ? o.openNow : undefined,
    nextCloseTime: typeof o.nextCloseTime === "string" ? o.nextCloseTime : undefined,
  };
}

function isOpenFromPeriodsAt(
  periods: OpeningPeriod[],
  pos: { minutesFromWeekStart: number },
): boolean {
  const cur = pos.minutesFromWeekStart;
  for (const p of periods) {
    const start = toMinutes(p.open.day, p.open.hour, p.open.minute);
    let end = toMinutes(p.close.day, p.close.hour, p.close.minute);
    if (end <= start) end += WEEK_MINUTES;
    if (cur >= start && cur < end) return true;
    if (cur + WEEK_MINUTES >= start && cur + WEEK_MINUTES < end) return true;
  }
  return false;
}

function findActivePeriodAt(
  periods: OpeningPeriod[],
  pos: { minutesFromWeekStart: number },
): OpeningPeriod | null {
  const cur = pos.minutesFromWeekStart;
  for (const p of periods) {
    const start = toMinutes(p.open.day, p.open.hour, p.open.minute);
    let end = toMinutes(p.close.day, p.close.hour, p.close.minute);
    if (end <= start) end += WEEK_MINUTES;
    if (cur >= start && cur < end) return p;
    if (cur + WEEK_MINUTES >= start && cur + WEEK_MINUTES < end) return p;
  }
  return null;
}

function formatClock12(hour: number, minute: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  const period = normalized >= 12 ? "PM" : "AM";
  const hour12 = normalized % 12 || 12;
  const minutePart = minute ? `:${String(minute).padStart(2, "0")}` : "";
  return `${hour12}${minutePart} ${period}`;
}

function formatPeriodTimeRange(p: OpeningPeriod): string {
  const openT = formatClock12(p.open.hour, p.open.minute);
  const closeT = formatClock12(p.close.hour, p.close.minute);
  return `${openT} – ${closeT}`;
}

function formatCategoryLabel(category: string): string {
  const t = category.trim();
  if (!t) return "Place";
  return t
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function formatPriceLevel(level: number | null): string | null {
  if (level === null) return null;
  if (level <= 0) return "Free";
  const n = Math.min(4, Math.max(1, Math.round(level)));
  return "$".repeat(n);
}

function clampDateToTrip(today: Date, tripStart: string, tripEnd: string) {
  const start = new Date(tripStart);
  const end = new Date(tripEnd);
  if (today < start) return start;
  if (today > end) return end;
  return today;
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

function InfoRow({
  icon,
  label,
  value,
  onPress,
  trailing,
  valueClassName,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onPress?: () => void;
  trailing?: ReactNode;
  valueClassName?: string;
}) {
  const body = (
    <View className="flex-row gap-3 border-b border-border/60 py-3.5 last:border-b-0">
      <View className="mt-0.5">{icon}</View>
      <View className="min-w-0 flex-1">
        <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </Text>
        <Text className={`mt-1 text-sm leading-5 text-foreground ${valueClassName ?? ""}`}>
          {value}
        </Text>
      </View>
      {trailing ? <View className="justify-center">{trailing}</View> : null}
      {onPress ? <ExternalLink size={16} color="#9CA3AF" /> : null}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} className="active:opacity-80">
        {body}
      </Pressable>
    );
  }
  return body;
}

function placeDetailToMapSessionPlace(p: PlaceDetail): MapSessionPlace {
  return {
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
    isFeatured: false,
    openingHours: p.openingHours ?? null,
  };
}

export default function PlaceDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const storeTrips = useTripStore((state) => state.trips);
  const setMapSession = useMapSessionStore((s) => s.setSession);
  const setMapNavigationDraft = useMapNavigationStore((s) => s.setDraft);
  const primaryVar = useUnstableNativeVariable("--primary");
  const accentColor = primaryVar ? `hsl(${primaryVar})` : "#3B82F6";
  const mutedVar = useUnstableNativeVariable("--muted-foreground");
  const mutedIconColor = mutedVar ? `hsl(${mutedVar})` : "#9CA3AF";

  const [now, setNow] = useState(() => new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const placeQuery = useQuery({
    queryKey: ["place-details", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Missing place id");
      }
      const res = await client.api.v1.places({ id }).get();
      if (res.error) throw new Error("Failed to load place");
      return res.data;
    },
    enabled: !!id,
  });

  const offlinePackByPlaceQuery = useQuery({
    queryKey: ["offline-place-pack", id],
    queryFn: async () => {
      if (!id) return null;
      return findOfflinePackByPlaceId(id);
    },
    enabled: !!id,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const offlinePack = offlinePackByPlaceQuery.data;
  const offlinePlace = useMemo(
    () => (id ? (getOfflinePlaceFromPack(offlinePack, id) as PlaceDetail | null) : null),
    [offlinePack, id],
  );

  const place = (placeQuery.data?.place as PlaceDetail | undefined) ?? offlinePlace ?? undefined;

  const tripsForDestinationQuery = useQuery({
    queryKey: ["trips", "destination", place?.destinationId],
    queryFn: async () => {
      if (!place?.destinationId) throw new Error("Missing destination id");
      const res = await client.api.v1.trips.get({
        query: { destinationId: place.destinationId },
      });
      if (res.error) throw new Error("Failed to load trips");
      return res.data;
    },
    enabled: Boolean(place?.destinationId),
    staleTime: 60 * 1000,
  });

  const eligibleTrip = useMemo(() => {
    if (!place) return undefined;
    const fromApi = (tripsForDestinationQuery.data?.trips ?? []) as Trip[];
    const list = tripsForDestinationQuery.isSuccess
      ? fromApi
      : storeTrips.filter((t) => t.destination.id === place.destinationId);
    return getEligibleTripForDestination(list, place.destinationId);
  }, [place, tripsForDestinationQuery.data, tripsForDestinationQuery.isSuccess, storeTrips]);

  const offlineTripItems = useOfflineItineraryStore((state) =>
    eligibleTrip?.id ? state.tripItems[eligibleTrip.id] : undefined,
  );

  const destinationMetaQuery = useQuery({
    queryKey: ["destination-details", place?.destinationId],
    queryFn: async () => {
      if (!place?.destinationId) {
        throw new Error("Missing destination id");
      }
      const res = await client.api.v1.destinations({ destId: place.destinationId }).get();
      if (res.error) throw new Error("Failed to load destination");
      return res.data;
    },
    enabled: Boolean(place?.destinationId),
    staleTime: 5 * 60 * 1000,
  });

  const itineraryQuery = useQuery({
    queryKey: ["itinerary", eligibleTrip?.id],
    queryFn: async () => {
      if (!eligibleTrip) throw new Error("No trip");
      const res = await client.api.v1.trips({ tripId: eligibleTrip.id })["itinerary-items"].get();
      if (res.error) throw new Error("Failed to load itinerary");
      return res.data;
    },
    enabled: Boolean(eligibleTrip?.id && place?.id),
    staleTime: 30 * 1000,
  });

  const openTrip = useCallback(
    (destination: { id: string; name: string; country: string }) => {
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

  const destinationTimeZone = useMemo(() => {
    const dest =
      (destinationMetaQuery.data?.destination as { timezone?: string } | undefined) ??
      offlinePack?.destination;
    const tz = dest?.timezone?.trim();
    return tz && tz.length > 0 ? tz : null;
  }, [destinationMetaQuery.data, offlinePack?.destination]);

  const openingParsed = useMemo(
    () => parseOpeningHours(place?.openingHours),
    [place?.openingHours],
  );

  const nowInDestination = useMemo(() => {
    if (!destinationTimeZone) return null;
    return apiDayAndWeekMinutesInTimeZone(destinationTimeZone, now);
  }, [destinationTimeZone, now]);

  const openNow = useMemo(() => {
    if (!openingParsed?.periods?.length || !nowInDestination) return null;
    return isOpenFromPeriodsAt(openingParsed.periods, nowInDestination);
  }, [openingParsed, nowInDestination]);

  const closesAtLabel = useMemo(() => {
    if (!openingParsed?.periods?.length || openNow !== true || !nowInDestination) return null;
    const active = findActivePeriodAt(openingParsed.periods, nowInDestination);
    if (!active) return null;
    return formatClock12(active.close.hour, active.close.minute);
  }, [openingParsed, nowInDestination, openNow]);

  const periodsByDay = useMemo(() => {
    const buckets: OpeningPeriod[][] = [[], [], [], [], [], [], []];
    if (!openingParsed?.periods?.length) return buckets;
    for (const p of openingParsed.periods) {
      if (p.open.day >= 0 && p.open.day <= 6) buckets[p.open.day].push(p);
    }
    for (const list of buckets) {
      list.sort(
        (a, b) =>
          toMinutes(a.open.day, a.open.hour, a.open.minute) -
          toMinutes(b.open.day, b.open.hour, b.open.minute),
      );
    }
    return buckets;
  }, [openingParsed]);

  const todayApiDay = nowInDestination?.apiDay ?? null;

  const placeInItinerary = Boolean(
    place &&
      ((eligibleTrip?.destination.id && offlinePack?.destination.id === eligibleTrip.destination.id
        ? offlineTripItems
        : itineraryQuery.data?.items) ?? []
      ).some((it: { placeId: string | null }) => it.placeId === place.id),
  );

  const openOnMap = useCallback(() => {
    if (!place) return;
    if (offlinePack) {
      setMapSession(
        buildOfflineMapSession(offlinePack, {
          focusLatitude: place.latitude,
          focusLongitude: place.longitude,
          focusZoomLevel: 15,
          focusPlaceId: place.id,
          returnHref: `/place/${place.id}`,
        }),
      );
      router.push("/(tabs)/map" as never);
      return;
    }
    const dest = destinationMetaQuery.data?.destination as
      | { name: string; latitude: number; longitude: number; timezone?: string }
      | undefined;
    if (!dest) return;
    setMapSession({
      destinationId: place.destinationId,
      destinationName: dest.name,
      latitude: dest.latitude,
      longitude: dest.longitude,
      timezone: dest.timezone?.trim() ?? null,
      places: [placeDetailToMapSessionPlace(place)],
      focusLatitude: place.latitude,
      focusLongitude: place.longitude,
      focusZoomLevel: 15,
      focusPlaceId: place.id,
      returnHref: `/place/${place.id}`,
    });
    router.push("/(tabs)/map" as never);
  }, [place, offlinePack, destinationMetaQuery.data, setMapSession, router]);

  const openNavigationPreview = useCallback(() => {
    if (!place) return;
    if (offlinePack) {
      setMapSession(
        buildOfflineMapSession(offlinePack, {
          focusLatitude: place.latitude,
          focusLongitude: place.longitude,
          focusZoomLevel: 15,
          focusPlaceId: place.id,
          returnHref: `/place/${place.id}`,
        }),
      );
      setMapNavigationDraft({
        origin: createCurrentLocationNavigationPoint(),
        destination: {
          id: `place-${place.id}`,
          label: place.name,
          subtitle: place.address?.trim() || offlinePack.destination.name,
          coordinate: [place.longitude, place.latitude],
          kind: "place",
        },
        waypoints: [],
        mode: "driving",
        autoOpenPlanner: true,
      });
      router.push("/(tabs)/map" as never);
      return;
    }
    const dest = destinationMetaQuery.data?.destination as
      | { name: string; latitude: number; longitude: number; timezone?: string }
      | undefined;
    if (!dest) return;

    setMapSession({
      destinationId: place.destinationId,
      destinationName: dest.name,
      latitude: dest.latitude,
      longitude: dest.longitude,
      timezone: dest.timezone?.trim() ?? null,
      places: [placeDetailToMapSessionPlace(place)],
      focusLatitude: place.latitude,
      focusLongitude: place.longitude,
      focusZoomLevel: 15,
      focusPlaceId: place.id,
      returnHref: `/place/${place.id}`,
    });
    setMapNavigationDraft({
      origin: createCurrentLocationNavigationPoint(),
      destination: {
        id: `place-${place.id}`,
        label: place.name,
        subtitle: place.address?.trim() || dest.name,
        coordinate: [place.longitude, place.latitude],
        kind: "place",
      },
      waypoints: [],
      mode: "driving",
      autoOpenPlanner: true,
    });
    router.push("/(tabs)/map" as never);
  }, [place, offlinePack, destinationMetaQuery.data, router, setMapNavigationDraft, setMapSession]);

  const openWebsite = useCallback(() => {
    if (!place?.websiteUrl?.trim()) return;
    let url = place.websiteUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    void Linking.openURL(url);
  }, [place?.websiteUrl]);

  const dialPhone = useCallback(() => {
    if (!place?.phoneNumber?.trim()) return;
    const raw = place.phoneNumber.replace(/\s/g, "");
    void Linking.openURL(`tel:${raw}`);
  }, [place?.phoneNumber]);

  if (placeQuery.isLoading && offlinePackByPlaceQuery.isLoading && !offlinePlace) {
    return (
      <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (!place) {
    return (
      <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-base text-muted-foreground">Place not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const categoryLabel = formatCategoryLabel(place.category);
  const priceText = formatPriceLevel(place.priceLevel);
  const reviewText =
    place.reviewCount != null && place.reviewCount > 0
      ? `${approx(place.reviewCount)} reviews`
      : place.reviewCount === 0
        ? "No reviews yet"
        : null;

  const locationLines = [place.address].filter(Boolean).join("\n");
  const coordsText = `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`;
  const showAddToItinerary = Boolean(eligibleTrip) && !placeInItinerary;
  const itineraryFirstLoadPending =
    Boolean(eligibleTrip) && !placeInItinerary && !itineraryQuery.isFetched;
  const destinationForCreate = destinationMetaQuery.data?.destination as
    | { id: string; name: string; country: string }
    | undefined;

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: showAddToItinerary ? 100 : eligibleTrip ? 40 : 140,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="relative w-full" style={{ height: HERO_HEIGHT }}>
          {place.imageUrl ? (
            <Image
              source={{ uri: place.imageUrl }}
              style={{ width: SCREEN_WIDTH, height: HERO_HEIGHT }}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View className="h-full w-full items-center justify-center bg-muted">
              <MapPin size={48} color={mutedIconColor} />
            </View>
          )}
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0)"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: HERO_HEIGHT * 0.45,
            }}
          />

          <View
            className="absolute left-0 right-0 flex-row items-center justify-between px-4"
            style={{ top: insets.top + 8 }}
          >
            <OverlayIconButton onPress={() => router.back()}>
              <ChevronLeft size={22} color="#fff" />
            </OverlayIconButton>
          </View>
        </View>

        {/* Maps-style sheet */}
        <View className="-mt-5 rounded-t-3xl border-t border-border/50 bg-background px-5 pt-5 shadow-sm pb-5">
          <View className="mb-1 flex-row flex-wrap items-center gap-2">
            <View className="rounded-full bg-primary/15 px-3 py-1">
              <Text className="text-xs font-semibold text-primary">{categoryLabel}</Text>
            </View>
            {place.isCurated ? (
              <View className="rounded-full bg-amber-500/15 px-3 py-1">
                <Text className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  Curated
                </Text>
              </View>
            ) : null}
          </View>

          <Text className="text-2xl font-bold leading-8 text-foreground">{place.name}</Text>

          <View className="flex-row flex-wrap items-center gap-2">
            {place.rating != null || reviewText ? (
              <View className="mt-2 flex-row flex-wrap items-center gap-2">
                {place.rating != null ? (
                  <View className="flex-row items-center gap-1 rounded-lg bg-muted px-2.5 py-1">
                    <Star size={14} color="#FBBF24" fill="#FBBF24" />
                    <Text className="text-sm font-semibold text-foreground">
                      {place.rating.toFixed(1)}
                    </Text>
                    {reviewText ? (
                      <Text className="text-sm text-muted-foreground">· {reviewText}</Text>
                    ) : null}
                  </View>
                ) : reviewText ? (
                  <Text className="text-sm text-muted-foreground">{reviewText}</Text>
                ) : null}
                {priceText != null ? (
                  <Text className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    {priceText}
                  </Text>
                ) : null}
              </View>
            ) : priceText != null ? (
              <Text className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                {priceText}
              </Text>
            ) : null}
          </View>

          {place.description?.trim() ? (
            <View className="mt-2">
              <Text className="text-sm leading-6 text-muted-foreground">
                {place.description.trim()}
              </Text>
            </View>
          ) : null}

          <View className="mt-5 rounded-2xl border border-border/80 bg-card/30 px-4 py-1">
            {locationLines ? (
              <InfoRow
                icon={<MapPin size={18} color={accentColor} />}
                label="Address"
                value={locationLines}
                trailing={
                  <Pressable
                    onPress={openNavigationPreview}
                    hitSlop={8}
                    accessibilityLabel="Navigate to this place"
                    className="h-10 w-10 items-center justify-center rounded-xl bg-primary/12 active:opacity-80"
                  >
                    <Route size={18} color={accentColor} />
                  </Pressable>
                }
              />
            ) : null}
            {place.phoneNumber?.trim() ? (
              <InfoRow
                icon={<Phone size={18} color={accentColor} />}
                label="Phone"
                value={place.phoneNumber}
                onPress={dialPhone}
              />
            ) : null}
            {place.websiteUrl?.trim() ? (
              <InfoRow
                icon={<Globe size={18} color={accentColor} />}
                label="Website"
                value={place.websiteUrl}
                onPress={openWebsite}
              />
            ) : null}
          </View>

          {destinationMetaQuery.data?.destination ? (
            <View className="mt-4">
              <Button
                label="View on map"
                variant="secondary"
                onPress={openOnMap}
                className="w-full"
              />
            </View>
          ) : null}

          {openingParsed?.periods && openingParsed.periods.length > 0 ? (
            <View className="mt-5 rounded-2xl border border-border/80 bg-card/30 px-4 py-1">
              <View className="flex-row justify-between items-center gap-3 border-b border-border/60 py-3">
                <View className="flex-row items-center gap-2">
                  <Clock size={18} color={accentColor} />
                  <View className="ml-1 min-w-0">
                    <Text className="text-base font-bold text-foreground">Hours</Text>
                    <Text className="mt-0.5 text-xs text-muted-foreground">
                      Local destination time
                    </Text>
                  </View>
                </View>
                {openNow !== null ? (
                  <View
                    className={`rounded-full px-2.5 py-1 ${openNow ? "bg-emerald-500/15" : "bg-red-500/15"}`}
                  >
                    <Text
                      className={`text-xs font-semibold ${openNow ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}
                    >
                      {openNow ? "Open now" : "Closed"}
                      {openNow && closesAtLabel ? ` · Closes ${closesAtLabel}` : ""}
                    </Text>
                  </View>
                ) : null}
              </View>
              {DAY_NAMES.map((dayName, dayIndex) => {
                const dayPeriods = periodsByDay[dayIndex] ?? [];
                const isToday = todayApiDay === dayIndex;
                const dayLabel = isToday ? `${dayName} · Today` : dayName;
                const scheduleText =
                  dayPeriods.length === 0
                    ? "Closed"
                    : dayPeriods.map((p) => formatPeriodTimeRange(p)).join(", ");
                return (
                  <View
                    key={dayName}
                    className={`flex-row items-start justify-between gap-3 rounded-md border-b border-border/40 py-3 last:border-b-0 ${isToday ? "bg-primary/5 px-2" : ""}`}
                  >
                    <Text
                      className={`text-sm ${isToday ? "font-bold text-foreground" : "font-medium text-muted-foreground"}`}
                    >
                      {dayLabel}
                    </Text>
                    <Text
                      className={`max-w-[62%] text-right text-sm ${dayPeriods.length === 0 ? "text-muted-foreground" : "text-foreground"}`}
                    >
                      {scheduleText}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          {!eligibleTrip ? (
            <View className="mt-6 rounded-2xl border border-border bg-card/50 px-4 py-4">
              <Text className="text-sm text-muted-foreground">
                No active trip for this destination. Create a trip to add this place to your
                itinerary.
              </Text>
              {destinationMetaQuery.isError ? (
                <Text className="mt-2 text-sm text-destructive">
                  {"Couldn't load destination details. Tap Create trip again to retry."}
                </Text>
              ) : null}
              <View className="mt-3">
                <Button
                  label="Create trip"
                  variant="secondary"
                  loading={destinationMetaQuery.isPending}
                  disabled={destinationMetaQuery.isPending}
                  onPress={() => {
                    if (destinationForCreate) {
                      openTrip(destinationForCreate);
                      return;
                    }
                    void destinationMetaQuery.refetch();
                  }}
                />
              </View>
            </View>
          ) : null}
        </View>

        <Text className="mt-4 px-5 text-center text-xs text-muted-foreground/70">{coordsText}</Text>
      </ScrollView>

      {showAddToItinerary ? (
        <View
          className="absolute bottom-0 left-0 right-0 px-4 pb-2 pt-1"
          pointerEvents="box-none"
          style={{ bottom: insets.bottom }}
        >
          <Pressable
            onPress={() => {
              setShowAddModal(true);
            }}
            disabled={itineraryFirstLoadPending}
            className="flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 active:opacity-90 disabled:opacity-60"
          >
            {itineraryFirstLoadPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <CirclePlus size={28} color="#fff" strokeWidth={2.25} />
            )}
            <Text className="text-center text-lg font-semibold text-primary-foreground">
              {itineraryFirstLoadPending ? "Loading itinerary…" : "Add to itinerary"}
            </Text>
          </Pressable>
          {/* <Text className="mt-1.5 text-center text-xs text-muted-foreground" numberOfLines={1}>
            {eligibleTrip.title}
          </Text> */}
        </View>
      ) : null}

      {place && eligibleTrip ? (
        <AddItineraryItemModal
          visible={showAddModal}
          tripId={eligibleTrip.id}
          defaultDate={clampDateToTrip(new Date(), eligibleTrip.startDate, eligibleTrip.endDate)}
          tripStartDate={new Date(eligibleTrip.startDate)}
          tripEndDate={new Date(eligibleTrip.endDate)}
          offlineDestinationId={eligibleTrip.destination.id}
          initialTitle={place.name}
          initialPlaceId={place.id}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            void queryClient.invalidateQueries({ queryKey: ["itinerary", eligibleTrip.id] });
          }}
          onSuccessMessage={(title) => {
            showAppToast({
              variant: "success",
              title: "Added to trip",
              message: `${title} was added to ${eligibleTrip.title}.`,
            });
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}
