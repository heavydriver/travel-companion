import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  Banknote,
  Calendar,
  ExternalLink,
  Languages,
  MapPin,
  Plane,
  Plus,
  Settings,
  Thermometer,
  User,
  WifiOff,
} from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { Animated, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { client } from "@/api/client";
import { Progress } from "@/components/ui/progress";
import {
  cn,
  daysUntil,
  differenceInCalendarDays,
  formatDate,
  formatDateRange,
  isTripActiveToday,
  isTripPast,
  isTripUpcoming,
} from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useNetworkStore } from "@/store/networkStore";
import { type Trip, useTripStore } from "@/store/tripStore";

type DestinationLanguageLink = {
  id: string;
  isPrimary: boolean;
  language: { id: string; isoCode: string; name: string; nativeName: string };
};

type HomeDestinationDetail = {
  id: string;
  name: string;
  timezone: string;
  currencyCode: string;
  latitude: number;
  longitude: number;
  languages: DestinationLanguageLink[];
};

function sortTripsByStartDate(trips: Trip[]) {
  return [...trips].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );
}

function sortTripsByEndDateDesc(trips: Trip[]) {
  return [...trips].sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
}

function pickNonEnglishDestinationLanguage(links: DestinationLanguageLink[]) {
  const options = links.filter((link) => link.language.isoCode.toLowerCase() !== "en");
  if (options.length === 0) return null;
  return options.find((link) => link.isPrimary) ?? options[0] ?? null;
}

function getTripStatus(trip: Trip) {
  const now = new Date();
  const isUpcomingTrip = isTripUpcoming(trip.startDate, now);
  const isActiveTrip = isTripActiveToday(trip.startDate, trip.endDate, now);

  if (isActiveTrip) {
    const dayNum = differenceInCalendarDays(now, trip.startDate) + 1;
    const totalDays = differenceInCalendarDays(trip.endDate, trip.startDate) + 1;
    return {
      badge: "Active",
      badgeClass: "bg-green-600/30",
      textClass: "text-green-600",
      subtitle: `Day ${dayNum} of ${totalDays}`,
    };
  }
  if (isUpcomingTrip) {
    const days = daysUntil(trip.startDate);
    const subtitle =
      days === 0 ? "Starts today!" : days === 1 ? "Starts tomorrow" : `In ${days} days`;
    return { badge: "Upcoming", badgeClass: "bg-primary/20", textClass: "text-primary", subtitle };
  }
  return {
    badge: "Past",
    badgeClass: "bg-muted",
    textClass: "text-muted-foreground",
    subtitle: "Completed",
  };
}

function TripCard({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  const mutedFg = useUnstableNativeVariable("--muted-foreground");
  const mutedColor = mutedFg ? `hsl(${mutedFg})` : undefined;
  const status = getTripStatus(trip);

  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl border border-border bg-card p-4 active:opacity-90"
      accessibilityRole="button"
      accessibilityLabel={`${trip.title} trip to ${trip.destination.name}`}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            <MapPin size={16} color={mutedColor} />
            <Text className="text-sm text-muted-foreground">
              {trip.destination.name} · {trip.destination.countryCode}
            </Text>
          </View>
          <Text className="text-lg font-bold text-foreground">{trip.title}</Text>
          <View className="flex-row items-center gap-2">
            <Calendar size={13} color={mutedColor} />
            <Text className="text-sm text-muted-foreground">
              {formatDateRange(trip.startDate, trip.endDate)}
            </Text>
          </View>
        </View>
        <View className="items-end gap-1">
          <View className={cn("rounded-full px-2.5 py-1", status.badgeClass)}>
            <Text className={cn("text-xs font-semibold", status.textClass)}>{status.badge}</Text>
          </View>
          <Text className="text-xs text-muted-foreground">{status.subtitle}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View style={{ opacity }} className="rounded-2xl border border-border bg-card p-4">
      <View className="gap-2">
        <View className="h-3 w-32 rounded-full bg-muted" />
        <View className="h-5 w-48 rounded-full bg-muted" />
        <View className="h-3 w-36 rounded-full bg-muted" />
      </View>
    </Animated.View>
  );
}

function NextTripHero({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  const now = new Date();
  const isActive = isTripActiveToday(trip.startDate, trip.endDate, now);
  const days = Math.max(0, daysUntil(trip.startDate));
  const totalDays = differenceInCalendarDays(trip.endDate, trip.startDate) + 1;
  const currentDay = isActive
    ? Math.min(totalDays, Math.max(1, differenceInCalendarDays(now, trip.startDate) + 1))
    : 0;
  const remainingDays = isActive ? Math.max(0, totalDays - currentDay) : 0;
  const dayProgress = isActive ? (currentDay / totalDays) * 100 : 0;

  const countdownLabel = isActive
    ? `Day ${currentDay} of ${totalDays}`
    : days <= 0
      ? "Starts today!"
      : days === 1
        ? "Starts tomorrow"
        : `${days} days away`;

  return (
    <Pressable
      onPress={onPress}
      className="overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-5 active:opacity-90"
    >
      <View className="flex-row items-center gap-2">
        <Plane size={16} color="hsl(142 71% 45%)" />
        <Text className="text-xs text-foreground font-semibold uppercase tracking-wide text-chart-2">
          {isActive ? "Currently traveling" : "Next adventure"}
        </Text>
      </View>

      <Text className="mt-2 text-xl font-bold text-foreground">{trip.title}</Text>

      <View className="mt-1 flex-row items-center gap-1.5">
        <MapPin size={13} color="hsl(218 11% 65%)" />
        <Text className="text-sm text-muted-foreground">
          {trip.destination.name} · {formatDateRange(trip.startDate, trip.endDate)}
        </Text>
      </View>

      <View className="mt-4 flex-row items-end justify-between">
        <View>
          <Text className="text-3xl font-bold text-primary">
            {isActive ? `${currentDay}` : `${days}`}
          </Text>
          <Text className="text-xs text-muted-foreground">{countdownLabel}</Text>
        </View>

        {isActive && (
          <View className="items-end">
            <View className="h-2 w-24 overflow-hidden rounded-full bg-muted">
              <Progress
                value={Math.max(0, Math.min(100, dayProgress))}
                className="h-2.5 bg-muted"
                indicatorClassName="bg-green-500"
              />
            </View>
            <Text className="mt-1 text-xs text-muted-foreground">
              {remainingDays} {remainingDays === 1 ? "day" : "days"} left
            </Text>
          </View>
        )}

        {!isActive && (
          <View className="items-end">
            <Text className="text-sm font-medium text-primary">
              {totalDays} {totalDays === 1 ? "day" : "days"}
            </Text>
            <Text className="text-xs text-muted-foreground">{formatDate(trip.startDate)}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function QuickToolButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center justify-center gap-1 rounded-2xl border border-border bg-card px-2 py-3 active:opacity-85"
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {children}
      <Text className="text-center text-[11px] font-medium text-foreground">{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const setTrips = useTripStore((s) => s.setTrips);
  const setActiveTripId = useTripStore((s) => s.setActiveTripId);
  const foreground = useUnstableNativeVariable("--foreground");
  const iconColor = foreground ? `hsl(${foreground})` : undefined;
  const mutedFg = useUnstableNativeVariable("--muted-foreground");
  const mutedColor = mutedFg ? `hsl(${mutedFg})` : undefined;
  const displayName = user?.name?.split(" ")[0] ?? "there";

  const isConnected = useNetworkStore((s) => s.isConnected);

  const tripsQuery = useQuery({
    queryKey: ["trips"],
    queryFn: async () => {
      const res = await client.api.v1.trips.get();
      if (res.error) throw new Error("Failed to load trips");
      return res.data;
    },
  });

  useEffect(() => {
    if (tripsQuery.data?.trips) {
      setTrips(tripsQuery.data.trips as Trip[]);
    }
  }, [tripsQuery.data, setTrips]);

  const trips = (tripsQuery.data?.trips ?? []) as Trip[];

  const activeTrips = sortTripsByStartDate(
    trips.filter((trip) => isTripActiveToday(trip.startDate, trip.endDate)),
  );
  const upcomingTrips = sortTripsByStartDate(
    trips.filter((trip) => isTripUpcoming(trip.startDate)),
  );
  const pastTrips = sortTripsByEndDateDesc(trips.filter((trip) => isTripPast(trip.endDate)));
  const heroTrip = activeTrips[0] ?? upcomingTrips[0] ?? null;
  const heroTripIsActive = heroTrip
    ? isTripActiveToday(heroTrip.startDate, heroTrip.endDate)
    : false;
  const activeSectionTrips = heroTripIsActive
    ? activeTrips.filter((trip) => trip.id !== heroTrip?.id)
    : activeTrips;
  const upcomingSectionTrips =
    heroTrip && !heroTripIsActive
      ? upcomingTrips.filter((trip) => trip.id !== heroTrip.id)
      : upcomingTrips;
  const hasCurrentOrUpcomingTrips = activeTrips.length > 0 || upcomingTrips.length > 0;
  const activeHeroTrip = heroTripIsActive ? heroTrip : null;

  const activeDestinationQuery = useQuery({
    queryKey: ["home-active-destination", activeHeroTrip?.destination.id],
    queryFn: async () => {
      if (!activeHeroTrip?.destination.id) throw new Error("Missing destination id");
      const res = await client.api.v1.destinations({ destId: activeHeroTrip.destination.id }).get();
      if (res.error) throw new Error("Failed to load destination");
      return res.data;
    },
    enabled: Boolean(activeHeroTrip?.destination.id),
    staleTime: 10 * 60 * 1000,
  });

  const activeDestination = activeDestinationQuery.data?.destination as
    | HomeDestinationDetail
    | undefined;
  const activeTripLanguage = activeDestination
    ? pickNonEnglishDestinationLanguage(activeDestination.languages ?? [])
    : null;
  const activeTripCurrencyCode =
    activeDestination?.currencyCode?.toUpperCase() ??
    activeHeroTrip?.currencyCode?.toUpperCase() ??
    null;
  const hasWeatherTool =
    activeDestination != null &&
    Number.isFinite(activeDestination.latitude) &&
    Number.isFinite(activeDestination.longitude) &&
    activeDestination.timezone.trim().length > 0;
  const weatherDestination = hasWeatherTool ? activeDestination : null;

  const onRefresh = useCallback(() => {
    tripsQuery.refetch();
  }, [tripsQuery]);

  const openTrip = useCallback(
    (trip: Trip) => {
      setActiveTripId(trip.id);
      router.push(`/trip/${trip.id}` as never);
    },
    [router, setActiveTripId],
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <View className="flex-1">
        <ScrollView
          contentContainerClassName="flex-grow px-5 pt-6"
          contentContainerStyle={{ paddingBottom: activeHeroTrip ? 124 + insets.bottom : 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={tripsQuery.isRefetching} onRefresh={onRefresh} />
          }
        >
          <View className="gap-6">
            {/* Header */}
            <View className="flex-row items-start justify-between">
              <View>
                <Text className="text-2xl font-bold text-foreground">Hello, {displayName}!</Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  {trips.length === 0
                    ? "Ready to plan your first trip?"
                    : `${trips.length} ${trips.length === 1 ? "trip" : "trips"} planned`}
                </Text>
              </View>
              <View className="flex items-center gap-2">
                <View className="flex-row items-center gap-2">
                  <Pressable
                    onPress={() => router.push("/profile" as never)}
                    className="h-10 w-10 items-center justify-center rounded-full border border-border bg-card active:opacity-80"
                    accessibilityRole="button"
                    accessibilityLabel="Profile"
                  >
                    <User size={20} color={iconColor} />
                  </Pressable>
                  <Pressable
                    onPress={() => router.push("/settings" as never)}
                    className="h-10 w-10 items-center justify-center rounded-full border border-border bg-card active:opacity-80"
                    accessibilityRole="button"
                    accessibilityLabel="Settings"
                  >
                    <Settings size={20} color={iconColor} />
                  </Pressable>
                </View>
                {!isConnected && (
                  <View className="flex-row items-center justify-center gap-2 rounded-full bg-destructive/30 px-2 py-1">
                    <WifiOff size={14} color={iconColor} />
                    <Text className="text-xs font-light text-foreground">offline</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Create trip button */}
            <Pressable
              onPress={() => router.push("/trip/new" as never)}
              className="flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary/10 py-4 active:opacity-90"
              accessibilityRole="button"
              accessibilityLabel="Create a new trip"
            >
              <Plus size={20} color={iconColor} />
              <Text className="text-base font-semibold text-primary">Plan a New Trip</Text>
            </Pressable>

            {/* Next trip hero */}
            {heroTrip ? <NextTripHero trip={heroTrip} onPress={() => openTrip(heroTrip)} /> : null}

            {/* Loading skeletons */}
            {tripsQuery.isLoading && (
              <View className="gap-4">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </View>
            )}

            {/* Empty */}
            {!tripsQuery.isLoading && trips.length === 0 && (
              <View className="items-center rounded-2xl border border-border bg-card py-10">
                <MapPin size={40} color={mutedColor} />
                <Text className="mt-3 text-lg font-semibold text-foreground">No trips yet</Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Tap above to plan your first adventure
                </Text>
              </View>
            )}

            {!tripsQuery.isLoading && trips.length > 0 && !hasCurrentOrUpcomingTrips && (
              <Pressable
                onPress={() => router.push("/trip/new" as never)}
                className="rounded-2xl border border-border bg-card px-5 py-6 active:opacity-90"
                accessibilityRole="button"
                accessibilityLabel="Create a new trip"
              >
                <Text className="text-lg font-semibold text-foreground">
                  No active or upcoming trips
                </Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Plan a new trip to bring this home screen back to life.
                </Text>
              </Pressable>
            )}

            {/* Active trips */}
            {activeSectionTrips.length > 0 && (
              <View className="gap-3">
                <Text className="text-sm text-foreground font-semibold text-chart-2">
                  ACTIVE NOW
                </Text>
                {activeSectionTrips.map((trip) => (
                  <TripCard key={trip.id} trip={trip} onPress={() => openTrip(trip)} />
                ))}
              </View>
            )}

            {/* Upcoming trips */}
            {upcomingSectionTrips.length > 0 && (
              <View className="gap-3">
                <Text className="text-sm font-semibold text-primary">UPCOMING</Text>
                {upcomingSectionTrips.map((trip) => (
                  <TripCard key={trip.id} trip={trip} onPress={() => openTrip(trip)} />
                ))}
              </View>
            )}

            {/* Past trips */}
            {pastTrips.length > 0 && (
              <View className="gap-3">
                <Text className="text-sm font-semibold text-muted-foreground">PAST TRIPS</Text>
                {pastTrips.map((trip) => (
                  <TripCard key={trip.id} trip={trip} onPress={() => openTrip(trip)} />
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        {activeHeroTrip && (
          <View
            className="border-t border-border bg-background/95 px-4 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Quick Tools for {activeHeroTrip.destination.name}
            </Text>
            <View className="flex-row gap-2">
              {activeTripLanguage ? (
                <QuickToolButton
                  label="Language"
                  onPress={() =>
                    router.push({
                      pathname: "/language-guide",
                      params: {
                        destinationId: activeHeroTrip.destination.id,
                        languageId: activeTripLanguage.language.id,
                      },
                    } as never)
                  }
                >
                  <Languages size={18} color={iconColor} />
                </QuickToolButton>
              ) : null}

              {weatherDestination ? (
                <QuickToolButton
                  label="Weather"
                  onPress={() =>
                    router.push({
                      pathname: "/weather",
                      params: {
                        destinationId:
                          typeof (weatherDestination as { id?: string }).id === "string"
                            ? (weatherDestination as { id: string }).id
                            : activeHeroTrip?.destination.id,
                        lat: String(weatherDestination.latitude),
                        lng: String(weatherDestination.longitude),
                        timezone: weatherDestination.timezone,
                        name: weatherDestination.name,
                        days: "7",
                      },
                    } as never)
                  }
                >
                  <Thermometer size={18} color={iconColor} />
                </QuickToolButton>
              ) : null}

              {activeTripCurrencyCode ? (
                <QuickToolButton
                  label="Currency"
                  onPress={() =>
                    router.push({
                      pathname: "/currency",
                      params: {
                        base: activeTripCurrencyCode,
                        quote: "USD",
                        destinationId: activeHeroTrip?.destination.id,
                      },
                    } as never)
                  }
                >
                  <Banknote size={18} color={iconColor} />
                </QuickToolButton>
              ) : null}

              <QuickToolButton
                label="Details"
                onPress={() =>
                  router.push(`/destination/${activeHeroTrip.destination.id}` as never)
                }
              >
                <ExternalLink size={18} color={iconColor} />
              </QuickToolButton>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
