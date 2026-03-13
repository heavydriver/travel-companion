import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CheckCircle2, Pencil, Trash2 } from "lucide-react-native";
import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { apiBaseUrl } from "@/api/client";
import { Button } from "@/components/shared/Button";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { LoadingOverlay } from "@/components/shared/LoadingOverlay";
import { Screen } from "@/components/shared/Screen";
import { TextField } from "@/components/shared/TextField";
import { useAuthStore } from "@/store/authStore";

type Trip = {
  id: string;
  destinationId: string;
  title: string;
  startDate: string;
  endDate: string;
  destination?: {
    name: string;
    countryCode: string;
  };
};

type ItineraryItem = {
  id: string;
  tripId: string;
  title: string;
  date: string;
  notes?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  order: number;
  isDone: boolean;
  placeId?: string | null;
};

async function fetchTrip(tripId: string, accessToken: string | null): Promise<Trip> {
  if (!accessToken) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${apiBaseUrl}/api/v1/trips/${tripId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to load trip");
  }

  const data = (await response.json()) as { trip: Trip };
  return data.trip;
}

async function fetchItineraryItems(
  tripId: string,
  accessToken: string | null,
): Promise<ItineraryItem[]> {
  if (!accessToken) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${apiBaseUrl}/api/v1/trips/${tripId}/itinerary-items`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to load itinerary");
  }

  const data = (await response.json()) as { items: ItineraryItem[] };
  return data.items;
}

async function patchItineraryItem(
  id: string,
  payload: Partial<Pick<ItineraryItem, "title" | "notes" | "startTime" | "endTime" | "isDone">>,
  accessToken: string | null,
) {
  if (!accessToken) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${apiBaseUrl}/api/v1/itinerary-items/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to update item");
  }

  const data = (await response.json()) as { item: ItineraryItem };
  return data.item;
}

async function deleteItineraryItem(id: string, accessToken: string | null) {
  if (!accessToken) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${apiBaseUrl}/api/v1/itinerary-items/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to delete item");
  }
}

async function reorderItems(
  tripId: string,
  items: Pick<ItineraryItem, "id" | "date" | "order">[],
  accessToken: string | null,
) {
  if (!accessToken) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${apiBaseUrl}/api/v1/trips/${tripId}/itinerary-items/reorder`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ items }),
  });

  if (!response.ok) {
    throw new Error("Failed to reorder items");
  }
}

async function deleteTrip(tripId: string, accessToken: string | null) {
  if (!accessToken) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${apiBaseUrl}/api/v1/trips/${tripId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to delete trip");
  }
}

type EditDraft = {
  title: string;
  notes: string;
};

function safeParseIsoDate(value: string): Date | null {
  const date = new Date(value);
  const isValid = !Number.isNaN(date.getTime());
  return isValid ? date : null;
}

function dateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function monthDayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, EditDraft>>({});

  const tripQuery = useQuery({
    queryKey: ["trip", id],
    queryFn: () => fetchTrip(id, accessToken),
  });

  const itemsQuery = useQuery({
    queryKey: ["itinerary", id],
    queryFn: () => fetchItineraryItems(id, accessToken),
  });

  const toggleDoneMutation = useMutation({
    mutationFn: async (item: ItineraryItem) =>
      patchItineraryItem(item.id, { isDone: !item.isDone }, accessToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["itinerary", id] });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async (item: ItineraryItem) => {
      const draft = editDrafts[item.id];
      return patchItineraryItem(
        item.id,
        {
          title: draft?.title ?? item.title,
          notes: draft?.notes ?? item.notes ?? "",
        },
        accessToken,
      );
    },
    onSuccess: () => {
      setEditingItemId(null);
      void queryClient.invalidateQueries({ queryKey: ["itinerary", id] });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => deleteItineraryItem(itemId, accessToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["itinerary", id] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (payload: Pick<ItineraryItem, "id" | "date" | "order">[]) =>
      reorderItems(id, payload, accessToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["itinerary", id] });
    },
  });

  const deleteTripMutation = useMutation({
    mutationFn: () => deleteTrip(id, accessToken),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
      router.replace("/(tabs)" as never);
    },
  });

  const trip = tripQuery.data;
  const items = itemsQuery.data ?? [];

  const tripDateLabels = useMemo(() => {
    if (!trip) return { startLabel: "—", endLabel: "—" };
    const startParsed = safeParseIsoDate(trip.startDate);
    const endParsed = safeParseIsoDate(trip.endDate);
    return {
      startLabel: startParsed ? monthDayLabel(startParsed) : "—",
      endLabel: endParsed ? monthDayLabel(endParsed) : "—",
    };
  }, [trip]);

  const days = useMemo(() => {
    if (!trip) return [];
    const start = safeParseIsoDate(trip.startDate);
    const end = safeParseIsoDate(trip.endDate);
    if (!start || !end) return [];

    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const results: Date[] = [];
    for (let d = startDay; d <= endDay; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      results.push(d);
    }
    // #region agent log
    fetch("http://127.0.0.1:7547/ingest/d07dcf33-150b-44fc-8a56-3e872fc4f822", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "0a344d" },
      body: JSON.stringify({
        sessionId: "0a344d",
        runId: "pre-fix",
        hypothesisId: "H1",
        location: "apps/mobile/src/app/trip/[id].tsx:days-useMemo",
        message: "Generated day keys (local) vs trip ISO slices",
        data: {
          tzOffsetMin: new Date().getTimezoneOffset(),
          startIso10: trip.startDate?.slice(0, 10) ?? null,
          endIso10: trip.endDate?.slice(0, 10) ?? null,
          firstDayKey: results[0] ? dateKey(results[0]) : null,
          lastDayKey: results.length ? dateKey(results[results.length - 1]) : null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return results;
  }, [trip]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, ItineraryItem[]>();
    for (const item of items) {
      const dateKey = item.date.slice(0, 10);
      const list = map.get(dateKey) ?? [];
      list.push(item);
      map.set(dateKey, list.sort((a, b) => a.order - b.order));
    }
    // #region agent log
    fetch("http://127.0.0.1:7547/ingest/d07dcf33-150b-44fc-8a56-3e872fc4f822", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "0a344d" },
      body: JSON.stringify({
        sessionId: "0a344d",
        runId: "pre-fix",
        hypothesisId: "H2",
        location: "apps/mobile/src/app/trip/[id].tsx:itemsByDay-useMemo",
        message: "Item date grouping keys (ISO slice)",
        data: {
          itemCount: items.length,
          uniqueKeysSample: Array.from(map.keys()).slice(0, 5),
          firstItemIso10: items[0]?.date?.slice(0, 10) ?? null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return map;
  }, [items]);

  const moveItem = (item: ItineraryItem, direction: "up" | "down") => {
    const dateKey = item.date.slice(0, 10);
    const dayItems = [...(itemsByDay.get(dateKey) ?? [])];
    const index = dayItems.findIndex((i) => i.id === item.id);
    if (index === -1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= dayItems.length) return;

    const swapped = dayItems[newIndex];
    const reordered = [...dayItems];
    reordered[index] = swapped;
    reordered[newIndex] = item;

    const payload = reordered.map((i, idx) => ({
      id: i.id,
      date: i.date,
      order: idx,
    }));

    reorderMutation.mutate(payload);
  };

  const handleStartEdit = (item: ItineraryItem) => {
    setEditingItemId(item.id);
    setEditDrafts((prev) => ({
      ...prev,
      [item.id]: {
        title: prev[item.id]?.title ?? item.title,
        notes: prev[item.id]?.notes ?? (item.notes ?? ""),
      },
    }));
  };

  const handleChangeDraft = (id: string, field: keyof EditDraft, value: string) => {
    setEditDrafts((prev) => ({
      ...prev,
      [id]: {
        title: field === "title" ? value : prev[id]?.title ?? "",
        notes: field === "notes" ? value : prev[id]?.notes ?? "",
      },
    }));
  };

  const handleSaveEdit = (item: ItineraryItem) => {
    updateItemMutation.mutate(item);
  };

  const isLoading = tripQuery.isLoading || itemsQuery.isLoading;

  return (
    <Screen scrollable>
      <View className="flex-1 gap-6">
        <ErrorBanner
          message={
            tripQuery.error || itemsQuery.error || deleteTripMutation.error
              ? "Something went wrong. Please try again."
              : null
          }
        />

        {trip ? (
          <View className="gap-3 rounded-2xl border border-border bg-card p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Trip
                </Text>
                <Text className="mt-1 text-xl font-bold text-foreground">{trip.title}</Text>
                <Text className="mt-0.5 text-sm text-muted-foreground">
                  {trip.destination?.name} · {trip.destination?.countryCode}
                </Text>
                <Text className="mt-0.5 text-xs text-muted-foreground">
                  {tripDateLabels.startLabel} – {tripDateLabels.endLabel}
                </Text>
              </View>
              <View className="items-end gap-2">
                <Button
                  label="Delete"
                  variant="secondary"
                  onPress={() => deleteTripMutation.mutate()}
                  className="min-w-[80px]"
                />
              </View>
            </View>
          </View>
        ) : null}

        <View className="gap-3">
          <Text className="text-base font-semibold text-foreground">
            Itinerary by day
          </Text>
          {days.length === 0 ? (
            <Text className="text-sm text-muted-foreground">
              Once your trip details load, your day-by-day itinerary will appear here.
            </Text>
          ) : (
            <View className="gap-4">
              {days.map((day: Date) => {
                const key = dateKey(day);
                const dayItems = itemsByDay.get(key) ?? [];
                const itemCount = dayItems.length;

                return (
                  <View
                    key={key}
                    className="overflow-hidden rounded-2xl border border-border bg-card"
                  >
                    <View className="flex-row items-center justify-between px-4 py-3">
                      <View>
                        <Text className="text-sm font-semibold text-foreground">
                          {dayLabel(day)}
                        </Text>
                        <Text className="text-xs text-muted-foreground">
                          {itemCount === 0
                            ? "No plans yet"
                            : itemCount === 1
                              ? "1 item"
                              : `${itemCount} items`}
                        </Text>
                      </View>
                    </View>

                    {dayItems.length > 0 ? (
                      <FlatList
                        data={dayItems}
                        keyExtractor={(item) => item.id}
                        scrollEnabled={false}
                        ItemSeparatorComponent={() => (
                          <View className="h-px bg-border/80" />
                        )}
                        renderItem={({ item }) => {
                          const isEditing = editingItemId === item.id;
                          const draft = editDrafts[item.id];

                          return (
                            <View className="flex-row items-stretch px-4 py-3">
                              <Pressable
                                onPress={() => toggleDoneMutation.mutate(item)}
                                className="mr-3 mt-1 h-7 w-7 items-center justify-center rounded-full border border-border bg-background active:opacity-80"
                                accessibilityRole="button"
                                accessibilityLabel={
                                  item.isDone ? "Mark as not done" : "Mark as done"
                                }
                              >
                                {item.isDone ? (
                                  <CheckCircle2 size={18} color="#22C55E" />
                                ) : null}
                              </Pressable>
                              <View className="flex-1 gap-1">
                                {isEditing ? (
                                  <>
                                    <TextField
                                      label="Title"
                                      value={draft?.title ?? item.title}
                                      onChangeText={(value) =>
                                        handleChangeDraft(item.id, "title", value)
                                      }
                                      placeholder="Activity title"
                                      className="mb-2"
                                    />
                                    <TextField
                                      label="Notes"
                                      value={draft?.notes ?? (item.notes ?? "")}
                                      onChangeText={(value) =>
                                        handleChangeDraft(item.id, "notes", value)
                                      }
                                      placeholder="Optional notes"
                                      className="mb-2"
                                    />
                                  </>
                                ) : (
                                  <>
                                    <Text
                                      className={`text-sm font-medium ${
                                        item.isDone ? "text-muted-foreground line-through" : "text-foreground"
                                      }`}
                                    >
                                      {item.title}
                                    </Text>
                                    {item.notes ? (
                                      <Text className="text-xs text-muted-foreground">
                                        {item.notes}
                                      </Text>
                                    ) : null}
                                    {item.startTime || item.endTime ? (
                                      <Text className="text-xs text-muted-foreground">
                                        {item.startTime ?? "—"} – {item.endTime ?? "—"}
                                      </Text>
                                    ) : null}
                                  </>
                                )}
                              </View>
                              <View className="ml-3 items-end justify-between">
                                <View className="flex-row gap-1">
                                  <Pressable
                                    className="h-8 w-8 items-center justify-center rounded-full bg-muted active:opacity-80"
                                    onPress={() => moveItem(item, "up")}
                                    accessibilityRole="button"
                                    accessibilityLabel="Move up"
                                  >
                                    <Text className="text-xs text-muted-foreground">↑</Text>
                                  </Pressable>
                                  <Pressable
                                    className="h-8 w-8 items-center justify-center rounded-full bg-muted active:opacity-80"
                                    onPress={() => moveItem(item, "down")}
                                    accessibilityRole="button"
                                    accessibilityLabel="Move down"
                                  >
                                    <Text className="text-xs text-muted-foreground">↓</Text>
                                  </Pressable>
                                </View>
                                <View className="mt-2 flex-row gap-2">
                                  {isEditing ? (
                                    <Button
                                      label="Save"
                                      onPress={() => handleSaveEdit(item)}
                                      size="md"
                                      variant="primary"
                                      className="px-3"
                                    />
                                  ) : (
                                    <Pressable
                                      onPress={() => handleStartEdit(item)}
                                      className="h-8 w-8 items-center justify-center rounded-full bg-muted active:opacity-80"
                                      accessibilityRole="button"
                                      accessibilityLabel="Edit item"
                                    >
                                      <Pencil size={16} color="#9CA3AF" />
                                    </Pressable>
                                  )}
                                  <Pressable
                                    onPress={() => deleteItemMutation.mutate(item.id)}
                                    className="h-8 w-8 items-center justify-center rounded-full bg-destructive/10 active:opacity-80"
                                    accessibilityRole="button"
                                    accessibilityLabel="Delete item"
                                  >
                                    <Trash2 size={16} color="#EF4444" />
                                  </Pressable>
                                </View>
                              </View>
                            </View>
                          );
                        }}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>

      {isLoading || deleteTripMutation.isPending ? (
        <LoadingOverlay label="Loading your trip..." />
      ) : null}
    </Screen>
  );
}

