import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  Calendar,
  CheckCircle2,
  Circle,
  MapPin,
} from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { client } from "@/api/client";
import { Button } from "@/components/shared/Button";
import { Screen } from "@/components/shared/Screen";
import { useOfflineGuard } from "@/hooks/useOfflineGuard";
import { useTripStore } from "@/store/tripStore";
import { formatDate, toDateOnly } from "@/lib/utils";

type ItineraryItem = {
  id: string;
  title: string;
  date: string | Date;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  isDone: boolean;
  order: number;
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

export default function ItineraryTabScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const activeTrip = useTripStore((s) => s.activeTrip)();
  const trips = useTripStore((s) => s.trips);
  const { guardAction } = useOfflineGuard();
  const mutedFg = useUnstableNativeVariable("--muted-foreground");
  const mutedColor = mutedFg ? `hsl(${mutedFg})` : "#9CA3AF";

  const toggleDone = useMutation({
    mutationFn: async ({ itemId, isDone }: { itemId: string; isDone: boolean }) => {
      const res = await client.api.v1["itinerary-items"]({ id: itemId }).patch({ isDone });
      if (res.error) throw new Error("Failed to update");
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itinerary", activeTrip?.id] });
    },
  });

  const itemsQuery = useQuery({
    queryKey: ["itinerary", activeTrip?.id],
    queryFn: async () => {
      const res = await client.api.v1
        .trips({ tripId: activeTrip!.id })
        ["itinerary-items"].get();
      if (res.error) throw new Error("Failed to load itinerary");
      return res.data;
    },
    enabled: !!activeTrip?.id,
  });

  if (trips.length === 0) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center gap-3">
          <Calendar size={40} color={mutedColor} />
          <Text className="text-lg font-semibold text-foreground">
            No trips yet
          </Text>
          <Text className="text-center text-sm text-muted-foreground">
            Create a trip from the Home tab to see your itinerary here
          </Text>
        </View>
      </Screen>
    );
  }

  if (!activeTrip) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center gap-3">
          <MapPin size={40} color={mutedColor} />
          <Text className="text-lg font-semibold text-foreground">
            Select a trip
          </Text>
          <Text className="text-center text-sm text-muted-foreground">
            Tap a trip on the Home tab to view its itinerary
          </Text>
        </View>
      </Screen>
    );
  }

  const items = (itemsQuery.data?.items ?? []) as ItineraryItem[];
  const grouped = groupByDate(items);
  const doneCount = items.filter((i) => i.isDone).length;
  const progress = items.length > 0 ? doneCount / items.length : 0;

  return (
    <Screen scrollable contentClassName="pb-6">
      <View className="gap-5">
        {/* Trip header */}
        <View>
          <View className="flex-row items-center gap-2">
            <MapPin size={14} color={mutedColor} />
            <Text className="text-sm text-muted-foreground">
              {activeTrip.destination.name}
            </Text>
          </View>
          <Text className="text-2xl font-bold text-foreground">
            {activeTrip.title}
          </Text>
        </View>

        {/* Progress bar */}
        {items.length > 0 && (
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-medium text-foreground">Progress</Text>
              <Text className="text-sm text-muted-foreground">
                {doneCount}/{items.length} completed
              </Text>
            </View>
            <View className="h-2.5 overflow-hidden rounded-full bg-muted">
              <View
                className="h-full rounded-full bg-chart-2"
                style={{ width: `${progress * 100}%` }}
              />
            </View>
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
          <View className="items-center rounded-2xl border border-border bg-card py-8">
            <Calendar size={32} color={mutedColor} />
            <Text className="mt-2 text-base font-medium text-foreground">
              No items yet
            </Text>
            <Text className="mt-1 text-center text-sm text-muted-foreground">
              Open the full itinerary to add activities
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
              <View
                key={item.id}
                className="flex-row items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <Pressable
                  onPress={() =>
                    guardAction(() =>
                      toggleDone.mutate({ itemId: item.id, isDone: !item.isDone })
                    )
                  }
                  hitSlop={8}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.isDone }}
                  accessibilityLabel={`Mark ${item.title} as ${item.isDone ? "not done" : "done"}`}
                >
                  {item.isDone ? (
                    <CheckCircle2 size={22} color="#22C55E" />
                  ) : (
                    <Circle size={22} color={mutedColor} />
                  )}
                </Pressable>
                <Pressable
                  className="flex-1 active:opacity-80"
                  onPress={() => router.push(`/trip/${activeTrip.id}` as never)}
                >
                  <Text
                    className={`text-base font-medium ${item.isDone ? "text-muted-foreground line-through" : "text-foreground"}`}
                  >
                    {item.title}
                  </Text>
                  {item.startTime && (
                    <Text className="text-sm text-muted-foreground">
                      {item.startTime}
                      {item.endTime && ` – ${item.endTime}`}
                    </Text>
                  )}
                </Pressable>
              </View>
            ))}
          </View>
        ))}
      </View>
    </Screen>
  );
}
