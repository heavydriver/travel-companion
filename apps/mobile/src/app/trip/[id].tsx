import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Circle,
  MapPin,
  Plus,
  Trash2,
} from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { client } from "@/api/client";
import { Button } from "@/components/shared/Button";
import { Screen } from "@/components/shared/Screen";

type ItineraryItem = {
  id: string;
  tripId: string;
  title: string;
  notes: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  order: number;
  isDone: boolean;
  placeId: string | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function groupByDate(items: ItineraryItem[]) {
  const groups: Record<string, ItineraryItem[]> = {};
  for (const item of items) {
    const key = item.date.split("T")[0];
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutedFg = useUnstableNativeVariable("--muted-foreground");
  const mutedColor = mutedFg ? `hsl(${mutedFg})` : "#9CA3AF";
  const foreground = useUnstableNativeVariable("--foreground");
  const iconColor = foreground ? `hsl(${foreground})` : undefined;

  const [showAddModal, setShowAddModal] = useState(false);
  const [addDate, setAddDate] = useState("");

  const tripQuery = useQuery({
    queryKey: ["trip", id],
    queryFn: async () => {
      const res = await client.api.v1.trips({ id: id! }).get();
      if (res.error) throw new Error("Failed to load trip");
      return res.data;
    },
    enabled: !!id,
  });

  const itemsQuery = useQuery({
    queryKey: ["itinerary", id],
    queryFn: async () => {
      const res = await client.api.v1
        .trips({ tripId: id! })
        ["itinerary-items"].get();
      if (res.error) throw new Error("Failed to load itinerary");
      return res.data;
    },
    enabled: !!id,
  });

  const toggleDone = useMutation({
    mutationFn: async ({ itemId, isDone }: { itemId: string; isDone: boolean }) => {
      const res = await client.api.v1["itinerary-items"]({ id: itemId }).patch({
        isDone,
      });
      if (res.error) throw new Error("Failed to update");
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["itinerary", id] }),
  });

  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await client.api.v1["itinerary-items"]({ id: itemId }).delete();
      if (res.error) throw new Error("Failed to delete");
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["itinerary", id] }),
  });

  const deleteTrip = useMutation({
    mutationFn: async () => {
      const res = await client.api.v1.trips({ id: id! }).delete();
      if (res.error) throw new Error("Failed to delete trip");
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      router.back();
    },
  });

  const trip = tripQuery.data?.trip;
  const items = (itemsQuery.data?.items ?? []) as ItineraryItem[];
  const grouped = groupByDate(items);

  if (tripQuery.isLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scrollable contentClassName="pb-10">
      <View className="gap-5">
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center gap-1 active:opacity-80"
          >
            <ChevronLeft size={20} color={iconColor} />
            <Text className="text-base font-medium text-primary">Back</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              Alert.alert("Delete Trip", "This cannot be undone.", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => deleteTrip.mutate(),
                },
              ])
            }
            className="active:opacity-80"
          >
            <Trash2 size={20} color="#EF4444" />
          </Pressable>
        </View>

        {/* Trip info */}
        {trip && (
          <View className="gap-1">
            <View className="flex-row items-center gap-2">
              <MapPin size={16} color={mutedColor} />
              <Text className="text-sm text-muted-foreground">
                {trip.destination.name} · {trip.destination.countryCode}
              </Text>
            </View>
            <Text className="text-2xl font-bold text-foreground">
              {trip.title}
            </Text>
            <View className="flex-row items-center gap-2">
              <Calendar size={14} color={mutedColor} />
              <Text className="text-sm text-muted-foreground">
                {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
              </Text>
            </View>
          </View>
        )}

        {/* Itinerary */}
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-bold text-foreground">Itinerary</Text>
          <Pressable
            onPress={() => {
              setAddDate(trip?.startDate.split("T")[0] ?? "");
              setShowAddModal(true);
            }}
            className="flex-row items-center gap-1 rounded-lg bg-primary px-3 py-2 active:opacity-90"
          >
            <Plus size={16} color="white" />
            <Text className="text-sm font-semibold text-primary-foreground">Add</Text>
          </Pressable>
        </View>

        {itemsQuery.isLoading && (
          <View className="items-center py-4">
            <ActivityIndicator />
          </View>
        )}

        {!itemsQuery.isLoading && items.length === 0 && (
          <View className="items-center rounded-2xl border border-border bg-card py-8">
            <Calendar size={32} color={mutedColor} />
            <Text className="mt-2 text-base font-medium text-foreground">
              No items yet
            </Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              Tap Add to start building your itinerary
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
                    toggleDone.mutate({
                      itemId: item.id,
                      isDone: !item.isDone,
                    })
                  }
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.isDone }}
                >
                  {item.isDone ? (
                    <CheckCircle2 size={22} color="#22C55E" />
                  ) : (
                    <Circle size={22} color={mutedColor} />
                  )}
                </Pressable>
                <View className="flex-1">
                  <Text
                    className={`text-base font-medium ${item.isDone ? "text-muted-foreground line-through" : "text-foreground"}`}
                  >
                    {item.title}
                  </Text>
                  {(item.startTime || item.notes) && (
                    <Text className="text-sm text-muted-foreground">
                      {item.startTime && `${item.startTime}`}
                      {item.startTime && item.endTime && ` – ${item.endTime}`}
                      {item.notes && ` · ${item.notes}`}
                    </Text>
                  )}
                </View>
                <Pressable
                  onPress={() =>
                    Alert.alert("Delete Item", `Remove "${item.title}"?`, [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => deleteItem.mutate(item.id),
                      },
                    ])
                  }
                  className="active:opacity-80"
                >
                  <Trash2 size={18} color="#EF4444" />
                </Pressable>
              </View>
            ))}
          </View>
        ))}
      </View>

      {/* Add item modal */}
      <AddItemModal
        visible={showAddModal}
        tripId={id!}
        defaultDate={addDate}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          setShowAddModal(false);
          queryClient.invalidateQueries({ queryKey: ["itinerary", id] });
        }}
      />
    </Screen>
  );
}

function AddItemModal({
  visible,
  tripId,
  defaultDate,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  tripId: string;
  defaultDate: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const mutedFg = useUnstableNativeVariable("--muted-foreground");
  const mutedColor = mutedFg ? `hsl(${mutedFg})` : "#9CA3AF";

  const { control, handleSubmit, reset } = useForm({
    defaultValues: {
      title: "",
      date: defaultDate,
      startTime: "",
      endTime: "",
      notes: "",
    },
  });

  const addMutation = useMutation({
    mutationFn: async (values: {
      title: string;
      date: string;
      startTime: string;
      endTime: string;
      notes: string;
    }) => {
      const res = await client.api.v1
        .trips({ tripId })
        ["itinerary-items"].post({
          title: values.title,
          date: new Date(values.date).toISOString(),
          ...(values.startTime && { startTime: values.startTime }),
          ...(values.endTime && { endTime: values.endTime }),
          ...(values.notes && { notes: values.notes }),
        });
      if (res.error) throw new Error("Failed to add item");
      return res.data;
    },
    onSuccess: () => {
      reset();
      onSuccess();
    },
  });

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 justify-end bg-black/50">
        <View className="rounded-t-3xl bg-background px-5 pb-10 pt-6">
          <View className="mb-5 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-foreground">Add Item</Text>
            <Pressable onPress={onClose}>
              <Text className="text-base font-medium text-primary">Cancel</Text>
            </Pressable>
          </View>

          <View className="gap-4">
            <Controller
              control={control}
              name="title"
              rules={{ required: true }}
              render={({ field: { onChange, value } }) => (
                <TextInput
                  className="rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground"
                  placeholder="What are you doing?"
                  placeholderTextColor={mutedColor}
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />

            <Controller
              control={control}
              name="date"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  className="rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground"
                  placeholder="Date (YYYY-MM-DD)"
                  placeholderTextColor={mutedColor}
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />

            <View className="flex-row gap-3">
              <Controller
                control={control}
                name="startTime"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground"
                    placeholder="Start (HH:MM)"
                    placeholderTextColor={mutedColor}
                    value={value}
                    onChangeText={onChange}
                  />
                )}
              />
              <Controller
                control={control}
                name="endTime"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground"
                    placeholder="End (HH:MM)"
                    placeholderTextColor={mutedColor}
                    value={value}
                    onChangeText={onChange}
                  />
                )}
              />
            </View>

            <Controller
              control={control}
              name="notes"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  className="rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground"
                  placeholder="Notes (optional)"
                  placeholderTextColor={mutedColor}
                  value={value}
                  onChangeText={onChange}
                  multiline
                  numberOfLines={2}
                  maxLength={500}
                />
              )}
            />

            <Button
              label="Add to Itinerary"
              onPress={() => void handleSubmit((v) => addMutation.mutate(v))()}
              loading={addMutation.isPending}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
