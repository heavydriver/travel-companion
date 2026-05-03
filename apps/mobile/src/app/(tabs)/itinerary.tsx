import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Calendar, CheckCircle2, Circle, ExternalLink, MapPin } from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { useCallback, useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { client } from "@/api/client";
import { Button } from "@/components/shared/Button";
import { Screen } from "@/components/shared/Screen";
import { Progress } from "@/components/ui/progress";
import {
  formatDate,
  formatDateRange,
  formatItineraryTimeRange,
  isTripActiveToday,
  toDateOnly,
} from "@/lib/utils";
import { useMapSessionStore } from "@/store/mapSessionStore";
import { type Trip, useTripStore } from "@/store/tripStore";

type ItineraryItem = {
  id: string;
  title: string;
  date: string | Date;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  isDone: boolean;
  order: number;
  placeId: string | null;
};

function groupByDate(items: ItineraryItem[]) {
  const groups: Record<string, ItineraryItem[]> = {};
  for (const item of items) {
    const key = toDateOnly(item.date);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

function getActiveTrips(trips: Trip[]) {
  return trips.filter((trip) => isTripActiveToday(trip.startDate, trip.endDate));
}

function TripSummaryCard({
  trip,
  progress,
  doneCount,
  totalCount,
  loading,
  onPress,
}: {
  trip: Trip;
  progress: number;
  doneCount: number;
  totalCount: number;
  loading: boolean;
  onPress: () => void;
}) {
  const mutedFg = useUnstableNativeVariable("--muted-foreground");
  const mutedColor = mutedFg ? `hsl(${mutedFg})` : "#9CA3AF";

  return (
    <Pressable
      onPress={onPress}
      className="p-4 border rounded-2xl border-border bg-card active:opacity-90"
    >
      <View className="gap-3">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <View className="flex-row items-center gap-2">
              <MapPin size={16} color={mutedColor} />
              <Text className="text-sm text-muted-foreground">
                {trip.destination.name} · {trip.destination.countryCode}
              </Text>
            </View>
            <Text className="text-lg font-bold text-foreground">
              {trip.title}
            </Text>
            <View className="flex-row items-center gap-2">
              <Calendar size={13} color={mutedColor} />
              <Text className="text-sm text-muted-foreground">
                {formatDateRange(trip.startDate, trip.endDate)}
              </Text>
            </View>
          </View>
          <View className="rounded-full bg-chart-2/20 px-2.5 py-1">
            <Text className="text-xs font-semibold text-chart-2">Active</Text>
          </View>
        </View>

        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-medium text-foreground">
              Progress
            </Text>
            <Text className="text-sm text-muted-foreground">
              {loading ? "Loading..." : `${doneCount}/${totalCount} completed`}
            </Text>
          </View>
          <Progress
              value={Math.max(0, Math.min(100, progress * 100))}
              className="h-2.5 bg-muted"
              indicatorClassName="bg-green-500"
          />
        </View>
      </View>
    </Pressable>
  );
}

export default function ItineraryTabScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const trips = useTripStore((s) => s.trips);
  const setActiveTripId = useTripStore((s) => s.setActiveTripId);
  const setMapSession = useMapSessionStore((s) => s.setSession);
  const mutedFg = useUnstableNativeVariable("--muted-foreground");
  const mutedColor = mutedFg ? `hsl(${mutedFg})` : "#9CA3AF";

  const activeTrips = getActiveTrips(trips);
  const singleActiveTrip =
    activeTrips.length === 1 ? activeTrips[0] : undefined;

  useEffect(() => {
    if (singleActiveTrip) {
      setActiveTripId(singleActiveTrip.id);
    }
  }, [setActiveTripId, singleActiveTrip]);

  const itemsQuery = useQuery({
    queryKey: ["itinerary", singleActiveTrip?.id],
    queryFn: async () => {
      if (!singleActiveTrip) throw new Error("No active trip");
      const res = await client.api.v1
        .trips({ tripId: singleActiveTrip.id })
        ["itinerary-items"].get();
      if (res.error) throw new Error("Failed to load itinerary");
      return res.data;
    },
    enabled: !!singleActiveTrip?.id,
  });

  const activeTripItemQueries = useQueries({
    queries: activeTrips.map((trip) => ({
      queryKey: ["itinerary", trip.id],
      queryFn: async () => {
        const res = await client.api.v1
          .trips({ tripId: trip.id })
          ["itinerary-items"].get();
        if (res.error) throw new Error("Failed to load itinerary");
        return res.data;
      },
      enabled: activeTrips.length > 1,
    })),
  });

  const toggleDone = useMutation({
    mutationFn: async ({
      tripId,
      itemId,
      isDone,
    }: {
      tripId: string;
      itemId: string;
      isDone: boolean;
    }) => {
      const res = await client.api.v1["itinerary-items"]({ id: itemId }).patch({
        isDone,
      });
      if (res.error) throw new Error("Failed to update");
      return { tripId };
    },
    onSuccess: ({ tripId }) => {
      queryClient.invalidateQueries({ queryKey: ["itinerary", tripId] });
    },
  });

  const openItem = useCallback(
    async (item: ItineraryItem) => {
      if (!singleActiveTrip) return;

      if (!item.placeId) {
        router.push(`/trip/${singleActiveTrip.id}` as never);
        return;
      }

      try {
        const [placeRes, destinationRes] = await Promise.all([
          client.api.v1.places({ id: item.placeId }).get(),
          client.api.v1.destinations({ destId: singleActiveTrip.destination.id }).get(),
        ]);

        if (placeRes.error || destinationRes.error) {
          router.push(`/trip/${singleActiveTrip.id}` as never);
          return;
        }

        const place = placeRes.data.place;
        const destination = destinationRes.data.destination;

        setMapSession({
          destinationId: destination.id,
          destinationName: destination.name,
          latitude: destination.latitude,
          longitude: destination.longitude,
          timezone: destination.timezone?.trim() ?? null,
          places: [],
          focusLatitude: place.latitude,
          focusLongitude: place.longitude,
          focusZoomLevel: 15,
          focusPlaceId: place.id,
          returnHref: `/trip/${singleActiveTrip.id}`,
        });
        router.push("/(tabs)/map" as never);
      } catch {
        router.push(`/trip/${singleActiveTrip.id}` as never);
      }
    },
    [router, setMapSession, singleActiveTrip],
  );

  if (trips.length === 0) {
    return (
      <Screen>
        <View className="items-center justify-center flex-1 gap-3">
          <Calendar size={40} color={mutedColor} />
          <Text className="text-lg font-semibold text-foreground">
            No trips yet
          </Text>
          <Text className="text-sm text-center text-muted-foreground">
            Create trip from Home tab to see itinerary here
          </Text>
        </View>
      </Screen>
    );
  }

  if (activeTrips.length === 0) {
    return (
      <Screen>
        <View className="items-center justify-center flex-1 gap-3">
          <MapPin size={40} color={mutedColor} />
          <Text className="text-lg font-semibold text-foreground">
            No active trip
          </Text>
          <Text className="text-sm text-center text-muted-foreground">
            Itinerary tab only shows trips happening now
          </Text>
        </View>
      </Screen>
    );
  }

  if (activeTrips.length > 1) {
    return (
      <Screen scrollable contentClassName="pb-6">
        <View className="gap-5">
          <View className="gap-1">
            <Text className="text-2xl font-bold text-foreground">
              Active Trips
            </Text>
            <Text className="text-sm text-muted-foreground">
              Multiple trips active. Pick one itinerary.
            </Text>
          </View>

          {activeTrips.map((trip, index) => {
            const items = ((
              activeTripItemQueries[index]?.data as
                | { items?: ItineraryItem[] }
                | undefined
            )?.items ?? []) as ItineraryItem[];
            const doneCount = items.filter((item) => item.isDone).length;
            const progress = items.length > 0 ? doneCount / items.length : 0;

            return (
              <TripSummaryCard
                key={trip.id}
                trip={trip}
                progress={progress}
                doneCount={doneCount}
                totalCount={items.length}
                loading={activeTripItemQueries[index]?.isLoading ?? false}
                onPress={() => {
                  setActiveTripId(trip.id);
                  router.push(`/trip/${trip.id}` as never);
                }}
              />
            );
          })}
        </View>
      </Screen>
    );
  }

  if (!singleActiveTrip) {
    return null;
  }

  const activeTrip = singleActiveTrip;
  const items = (itemsQuery.data?.items ?? []) as ItineraryItem[];
  const grouped = groupByDate(items);
  const doneCount = items.filter((i) => i.isDone).length;
  const progress = items.length > 0 ? doneCount / items.length : 0;

  return (
    <Screen scrollable contentClassName="pb-6">
      <View className="gap-5">
        <View>
          <View className="flex-row items-center justify-between gap-3">
            <View className="min-w-0 flex-1 flex-row items-center gap-2">
              <MapPin size={14} color={mutedColor} />
              <Text className="flex-1 text-sm text-muted-foreground" numberOfLines={1}>
                {activeTrip.destination.name} · {activeTrip.destination.countryCode}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push(`/destination/${activeTrip.destination.id}` as never)}
              className="rounded-lg border border-border bg-card p-2 active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel={`Open ${activeTrip.destination.name} destination details`}
            >
              <ExternalLink size={16} color={mutedColor} />
            </Pressable>
          </View>
          <Text className="text-2xl font-bold text-foreground">
            {activeTrip.title}
          </Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            {formatDateRange(activeTrip.startDate, activeTrip.endDate)}
          </Text>
        </View>

        {items.length > 0 && (
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-medium text-foreground">
                Progress
              </Text>
              <Text className="text-sm text-muted-foreground">
                {doneCount}/{items.length} completed
              </Text>
            </View>
            <Progress
              value={Math.max(0, Math.min(100, progress * 100))}
              className="h-2.5 bg-muted"
              indicatorClassName="bg-green-500"
            />
          </View>
        )}

        <Button
          label="Open Full Itinerary"
          variant="secondary"
          onPress={() => router.push(`/trip/${activeTrip.id}` as never)}
        />

        {itemsQuery.isLoading && (
          <View className="items-center py-8">
            <ActivityIndicator />
          </View>
        )}

        {!itemsQuery.isLoading && items.length === 0 && (
          <View className="items-center py-8 border rounded-2xl border-border bg-card">
            <Calendar size={32} color={mutedColor} />
            <Text className="mt-2 text-base font-medium text-foreground">
              No items yet
            </Text>
            <Text className="mt-1 text-sm text-center text-muted-foreground">
              Open full itinerary to add activities
            </Text>
          </View>
        )}

        {grouped.map(([date, dayItems]) => (
          <View key={date} className="gap-2">
            <Text className="text-sm font-semibold text-muted-foreground">
              {formatDate(date)} · {dayItems.length}{" "}
              {dayItems.length === 1 ? "item" : "items"}
            </Text>
            {dayItems.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => void openItem(item)}
                className="flex-row items-center gap-3 px-4 py-3 border rounded-xl border-border bg-card active:opacity-90"
              >
                <Pressable
                  onPress={() =>
                    toggleDone.mutate({
                      tripId: activeTrip.id,
                      itemId: item.id,
                      isDone: !item.isDone,
                    })
                  }
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.isDone }}
                >
                  {item.isDone ? (
                    <CheckCircle2 size={20} color="#22C55E" />
                  ) : (
                    <Circle size={20} color={mutedColor} />
                  )}
                </Pressable>

                <View className="min-w-0 flex-1">
                  <Text
                    className={`text-base font-medium ${item.isDone ? "text-muted-foreground line-through" : "text-foreground"}`}
                  >
                    {item.title}
                  </Text>
                  {(() => {
                    const timeLabel = formatItineraryTimeRange(item.startTime, item.endTime);
                    const detailLine = [timeLabel, item.notes?.trim()].filter(Boolean).join(" · ");
                    if (!detailLine) return null;
                    return (
                      <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                        {detailLine}
                      </Text>
                    );
                  })()}
                </View>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </Screen>
  );
}
