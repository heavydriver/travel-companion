import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  MapPin,
  Plus,
  User,
} from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { client } from "@/api/client";
import { Screen } from "@/components/shared/Screen";
import { useAuthStore } from "@/store/authStore";
import { useTripStore, type Trip } from "@/store/tripStore";

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", opts)}`;
}

function TripCard({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  const mutedFg = useUnstableNativeVariable("--muted-foreground");
  const mutedColor = mutedFg ? `hsl(${mutedFg})` : undefined;

  const now = new Date();
  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);
  const isUpcoming = start > now;
  const isActive = start <= now && end >= now;
  const badge = isActive ? "Active" : isUpcoming ? "Upcoming" : "Past";
  const badgeClass = isActive
    ? "bg-chart-2/20"
    : isUpcoming
      ? "bg-primary/20"
      : "bg-muted";
  const badgeTextClass = isActive
    ? "text-chart-2"
    : isUpcoming
      ? "text-primary"
      : "text-muted-foreground";

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
          <Text className="text-sm text-muted-foreground">
            {formatDateRange(trip.startDate, trip.endDate)}
          </Text>
        </View>
        <View className={`rounded-full px-2.5 py-1 ${badgeClass}`}>
          <Text className={`text-xs font-semibold ${badgeTextClass}`}>
            {badge}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setTrips = useTripStore((s) => s.setTrips);
  const setActiveTripId = useTripStore((s) => s.setActiveTripId);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const foreground = useUnstableNativeVariable("--foreground");
  const iconColor = foreground ? `hsl(${foreground})` : undefined;
  const displayName = user?.name?.split(" ")[0] ?? "there";

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

  return (
    <Screen scrollable contentClassName="pb-6">
      <View className="gap-6">
        {/* Header */}
        <View className="relative flex-row items-start justify-between">
          <View>
            <Text className="text-2xl font-bold text-foreground">
              Hello, {displayName}!
            </Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              {trips.length} {trips.length === 1 ? "trip" : "trips"} planned
            </Text>
          </View>
          <Pressable
            onPress={() => setIsProfileMenuOpen((prev) => !prev)}
            className="h-10 w-10 items-center justify-center rounded-full border border-border bg-card active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="Profile menu"
          >
            <User size={20} color={iconColor} />
          </Pressable>

          {isProfileMenuOpen && (
            <View className="absolute right-0 top-12 w-48 rounded-xl border border-border bg-card p-1 z-20">
              <Pressable
                onPress={() => {
                  setIsProfileMenuOpen(false);
                  router.push("/profile" as never);
                }}
                className="rounded-lg px-3 py-2 active:opacity-80"
              >
                <Text className="text-sm text-foreground">Profile</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setIsProfileMenuOpen(false);
                  router.push("/settings" as never);
                }}
                className="rounded-lg px-3 py-2 active:opacity-80"
              >
                <Text className="text-sm text-foreground">Settings</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Create trip button */}
        <Pressable
          onPress={() => router.push("/trip/new" as never)}
          className="flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary/10 py-4 active:opacity-90"
          accessibilityRole="button"
          accessibilityLabel="Create a new trip"
        >
          <Plus size={20} color={iconColor} />
          <Text className="text-base font-semibold text-primary">
            Plan a New Trip
          </Text>
        </Pressable>

        {/* Trip list */}
        {tripsQuery.isLoading && (
          <View className="items-center py-8">
            <ActivityIndicator />
            <Text className="mt-2 text-sm text-muted-foreground">
              Loading your trips...
            </Text>
          </View>
        )}

        {!tripsQuery.isLoading && trips.length === 0 && (
          <View className="items-center rounded-2xl border border-border bg-card py-10">
            <MapPin size={40} color={iconColor} />
            <Text className="mt-3 text-lg font-semibold text-foreground">
              No trips yet
            </Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              Tap above to plan your first adventure
            </Text>
          </View>
        )}

        {trips.map((trip) => (
          <TripCard
            key={trip.id}
            trip={trip}
            onPress={() => {
              setActiveTripId(trip.id);
              router.push(`/trip/${trip.id}` as never);
            }}
          />
        ))}
      </View>
    </Screen>
  );
}