import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Circle,
  Clock,
  Download,
  Edit3,
  MapPin,
  PackageCheck,
  Plus,
  Trash2,
} from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
import { client } from "@/api/client";
import { AddItineraryItemModal } from "@/components/shared/AddItineraryItemModal";
import { Button } from "@/components/shared/Button";
import { IOSDateTimePickerModal } from "@/components/shared/IOSDateTimePickerModal";
import { Screen } from "@/components/shared/Screen";
import { useOfflineGuard } from "@/hooks/useOfflineGuard";
import { formatDate, toDateOnly } from "@/lib/utils";
import { useOfflineStore } from "@/store/offlineStore";

type ItineraryItem = {
  id: string;
  tripId: string;
  title: string;
  notes: string | null;
  date: string | Date;
  startTime: string | null;
  endTime: string | null;
  order: number;
  isDone: boolean;
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

function oneParam(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function hasInvalidTimeRange(startTime: Date | null, endTime: Date | null) {
  if (!startTime || !endTime) return false;
  return startTime.getTime() >= endTime.getTime();
}

export default function TripDetailScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    openAdd?: string | string[];
    prefillTitle?: string | string[];
    prefillPlaceId?: string | string[];
    prefillDate?: string | string[];
  }>();
  const id = oneParam(params.id);
  const openAddParam = oneParam(params.openAdd);
  const prefillTitleParam = oneParam(params.prefillTitle);
  const prefillPlaceIdParam = oneParam(params.prefillPlaceId);
  const prefillDateParam = oneParam(params.prefillDate);
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutedFg = useUnstableNativeVariable("--muted-foreground");
  const mutedColor = mutedFg ? `hsl(${mutedFg})` : "#9CA3AF";
  const foreground = useUnstableNativeVariable("--foreground");
  const iconColor = foreground ? `hsl(${foreground})` : undefined;

  const { guardAction } = useOfflineGuard();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [addDate, setAddDate] = useState<Date>(new Date());
  const [addModalPrefill, setAddModalPrefill] = useState<{
    title: string;
    placeId: string | null;
  } | null>(null);

  const tripQuery = useQuery({
    queryKey: ["trip", id],
    queryFn: async () => {
      const res = await client.api.v1.trips({ tripId: id! }).get();
      if (res.error) throw new Error("Failed to load trip");
      return res.data;
    },
    enabled: !!id,
  });

  const trip = tripQuery.data?.trip;

  useEffect(() => {
    if (openAddParam !== "1" || !tripQuery.isSuccess || !trip) return;
    const requestedDate = prefillDateParam ? new Date(prefillDateParam) : null;
    const nextAddDate =
      requestedDate && !Number.isNaN(requestedDate.getTime())
        ? requestedDate
        : new Date(trip.startDate);
    setAddModalPrefill({
      title: prefillTitleParam ?? "",
      placeId: prefillPlaceIdParam ?? null,
    });
    setAddDate(nextAddDate);
    setShowAddModal(true);
    router.setParams({
      openAdd: undefined,
      prefillTitle: undefined,
      prefillPlaceId: undefined,
      prefillDate: undefined,
    });
  }, [
    openAddParam,
    prefillDateParam,
    prefillTitleParam,
    prefillPlaceIdParam,
    tripQuery.isSuccess,
    trip,
    router,
  ]);

  const itemsQuery = useQuery({
    queryKey: ["itinerary", id],
    queryFn: async () => {
      const res = await client.api.v1.trips({ tripId: id! })["itinerary-items"].get();
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
      const res = await client.api.v1.trips({ tripId: id! }).delete();
      if (res.error) throw new Error("Failed to delete trip");
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      router.back();
    },
  });

  const items = (itemsQuery.data?.items ?? []) as ItineraryItem[];
  const grouped = groupByDate(items);
  const doneCount = items.filter((i) => i.isDone).length;
  const progress = items.length > 0 ? doneCount / items.length : 0;

  const destId = trip?.destination?.id;
  const isPackDownloaded = useOfflineStore((s) => (destId ? s.isDownloaded(destId) : false));
  const packMeta = useOfflineStore((s) => (destId ? s.getPackMeta(destId) : undefined));
  const downloading = useOfflineStore((s) => s.downloading);
  const savePack = useOfflineStore((s) => s.savePack);
  const setDownloading = useOfflineStore((s) => s.setDownloading);

  const downloadPack = useMutation({
    mutationFn: async () => {
      if (!destId) throw new Error("No destination");
      setDownloading(destId);
      const res = await client.api.v1["offline-pack"]({ destinationId: destId }).get();
      if (res.error) throw new Error("Failed to download pack");
      return res.data;
    },
    onSuccess: (data) => {
      if (!destId || !trip || !data) return;
      savePack(
        {
          destinationId: destId,
          destinationName: trip.destination.name,
          country: trip.destination.countryCode,
          countryCode: trip.destination.countryCode,
          packVersion: (data as any).packVersion ?? 1,
          downloadedAt: new Date().toISOString(),
          placesCount: ((data as any).places ?? []).length,
          phrasesCount: ((data as any).phrases ?? []).length,
        },
        data,
      );
    },
    onError: () => setDownloading(null),
  });

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
                  onPress: () => guardAction(() => deleteTrip.mutate()),
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
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 text-2xl font-bold text-foreground">{trip.title}</Text>
              <Pressable
                onPress={() => guardAction(() => setShowEditModal(true))}
                className="ml-2 rounded-lg border border-border bg-card p-2 active:opacity-80"
              >
                <Edit3 size={16} color={mutedColor} />
              </Pressable>
            </View>
            <View className="flex-row items-center gap-2">
              <Calendar size={14} color={mutedColor} />
              <Text className="text-sm text-muted-foreground">
                {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
              </Text>
            </View>
          </View>
        )}

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

        {/* Offline pack */}
        {trip && (
          <View className="rounded-xl border border-border bg-card px-4 py-3">
            {isPackDownloaded ? (
              <View className="flex-row items-center gap-3">
                <PackageCheck size={20} color="#22C55E" />
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground">
                    Offline pack downloaded
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {packMeta?.placesCount} places · {packMeta?.phrasesCount} phrases
                  </Text>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => guardAction(() => downloadPack.mutate())}
                disabled={downloading === destId}
                className="flex-row items-center gap-3 active:opacity-80"
              >
                <Download size={20} color={iconColor} />
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground">
                    {downloading === destId ? "Downloading..." : "Download Offline Pack"}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Save places & phrases for offline use
                  </Text>
                </View>
                {downloading === destId && <ActivityIndicator size="small" />}
              </Pressable>
            )}
          </View>
        )}

        {/* Itinerary header */}
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-bold text-foreground">Itinerary</Text>
          <Pressable
            onPress={() => guardAction(() => {
              setAddDate(trip ? new Date(trip.startDate) : new Date());
              setShowAddModal(true);
            })}
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
            <Text className="mt-2 text-base font-medium text-foreground">No items yet</Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              Tap Add to start building your itinerary
            </Text>
          </View>
        )}

        {grouped.map(([date, dayItems]) => {
          const dayDone = dayItems.filter((i) => i.isDone).length;
          return (
            <View key={date} className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-muted-foreground">
                  {formatDate(date)} · {dayItems.length} {dayItems.length === 1 ? "item" : "items"}
                </Text>
                {dayItems.length > 0 && (
                  <Text className="text-xs text-muted-foreground">
                    {dayDone}/{dayItems.length} done
                  </Text>
                )}
              </View>
              {dayItems.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => guardAction(() => setEditingItem(item))}
                  className="flex-row items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 active:opacity-90"
                >
                  <Pressable
                    onPress={() =>
                      guardAction(() => toggleDone.mutate({
                        itemId: item.id,
                        isDone: !item.isDone,
                      }))
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
                      <View className="mt-0.5 flex-row items-center gap-1">
                        {item.startTime && (
                          <>
                            <Clock size={12} color={mutedColor} />
                            <Text className="text-sm text-muted-foreground">
                              {item.startTime}
                              {item.endTime && ` – ${item.endTime}`}
                            </Text>
                          </>
                        )}
                        {item.notes && (
                          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                            {item.startTime ? " · " : ""}
                            {item.notes}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                  <Pressable
                    onPress={() =>
                      Alert.alert("Delete Item", `Remove "${item.title}"?`, [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: () => guardAction(() => deleteItem.mutate(item.id)),
                        },
                      ])
                    }
                    className="active:opacity-80"
                  >
                    <Trash2 size={18} color="#EF4444" />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          );
        })}
      </View>

      <AddItineraryItemModal
        visible={showAddModal}
        tripId={id!}
        defaultDate={addDate}
        tripStartDate={trip ? new Date(trip.startDate) : undefined}
        tripEndDate={trip ? new Date(trip.endDate) : undefined}
        initialTitle={addModalPrefill?.title}
        initialPlaceId={addModalPrefill?.placeId ?? null}
        onClose={() => {
          setShowAddModal(false);
          setAddModalPrefill(null);
        }}
        onSuccess={() => {
          setShowAddModal(false);
          setAddModalPrefill(null);
          queryClient.invalidateQueries({ queryKey: ["itinerary", id] });
        }}
      />

      {trip && (
        <EditTripModal
          visible={showEditModal}
          tripId={id!}
          currentTitle={trip.title}
          currentStartDate={new Date(trip.startDate)}
          currentEndDate={new Date(trip.endDate)}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            queryClient.invalidateQueries({ queryKey: ["trip", id] });
            queryClient.invalidateQueries({ queryKey: ["trips"] });
          }}
        />
      )}

      {editingItem && (
        <EditItemModal
          visible={!!editingItem}
          item={editingItem}
          tripStartDate={trip ? new Date(trip.startDate) : undefined}
          tripEndDate={trip ? new Date(trip.endDate) : undefined}
          onClose={() => setEditingItem(null)}
          onSuccess={() => {
            setEditingItem(null);
            queryClient.invalidateQueries({ queryKey: ["itinerary", id] });
          }}
        />
      )}
    </Screen>
  );
}

function EditTripModal({
  visible,
  tripId,
  currentTitle,
  currentStartDate,
  currentEndDate,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  tripId: string;
  currentTitle: string;
  currentStartDate: Date;
  currentEndDate: Date;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const mutedFg = useUnstableNativeVariable("--muted-foreground");
  const mutedColor = mutedFg ? `hsl(${mutedFg})` : "#9CA3AF";

  const [title, setTitle] = useState(currentTitle);
  const [startDate, setStartDate] = useState(currentStartDate);
  const [endDate, setEndDate] = useState(currentEndDate);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle(currentTitle);
      setStartDate(currentStartDate);
      setEndDate(currentEndDate);
    }
  }, [visible, currentTitle, currentStartDate, currentEndDate]);

  const editMutation = useMutation({
    mutationFn: async () => {
      const res = await client.api.v1.trips({ tripId }).patch({
        title,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      if (res.error) throw new Error("Failed to update trip");
      return res.data;
    },
    onSuccess,
  });

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 justify-end bg-black/50">
        <View className="rounded-t-3xl bg-background px-5 pb-10 pt-6">
          <View className="mb-5 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-foreground">Edit Trip</Text>
            <Pressable onPress={onClose}>
              <Text className="text-base font-medium text-primary">Cancel</Text>
            </Pressable>
          </View>

          <View className="gap-4">
            <View className="gap-1">
              <Text className="text-sm font-medium text-muted-foreground">Title</Text>
              <TextInput
                className="rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground"
                value={title}
                onChangeText={setTitle}
                maxLength={100}
                placeholderTextColor={mutedColor}
              />
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1 gap-1">
                <Text className="text-sm font-medium text-muted-foreground">Start Date</Text>
                <Pressable
                  onPress={() => setShowStartPicker(true)}
                  className="flex-row items-center gap-2 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <Calendar size={16} color={mutedColor} />
                  <Text className="text-base text-foreground">{formatDate(startDate)}</Text>
                </Pressable>
                {showStartPicker && Platform.OS === "ios" && (
                  <IOSDateTimePickerModal
                    visible={showStartPicker}
                    title="Start Date"
                    value={startDate}
                    mode="date"
                    onCancel={() => setShowStartPicker(false)}
                    onConfirm={(date) => {
                      setShowStartPicker(false);
                      setStartDate(date);
                      if (date > endDate) setEndDate(date);
                    }}
                  />
                )}
                {showStartPicker && Platform.OS !== "ios" && (
                  <DateTimePicker
                    value={startDate}
                    mode="date"
                    display="default"
                    onChange={(_, date) => {
                      setShowStartPicker(false);
                      if (date) {
                        setStartDate(date);
                        if (date > endDate) setEndDate(date);
                      }
                    }}
                  />
                )}
              </View>
              <View className="flex-1 gap-1">
                <Text className="text-sm font-medium text-muted-foreground">End Date</Text>
                <Pressable
                  onPress={() => setShowEndPicker(true)}
                  className="flex-row items-center gap-2 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <Calendar size={16} color={mutedColor} />
                  <Text className="text-base text-foreground">{formatDate(endDate)}</Text>
                </Pressable>
                {showEndPicker && Platform.OS === "ios" && (
                  <IOSDateTimePickerModal
                    visible={showEndPicker}
                    title="End Date"
                    value={endDate}
                    mode="date"
                    minimumDate={startDate}
                    onCancel={() => setShowEndPicker(false)}
                    onConfirm={(date) => {
                      setShowEndPicker(false);
                      setEndDate(date);
                    }}
                  />
                )}
                {showEndPicker && Platform.OS !== "ios" && (
                  <DateTimePicker
                    value={endDate}
                    mode="date"
                    minimumDate={startDate}
                    display="default"
                    onChange={(_, date) => {
                      setShowEndPicker(false);
                      if (date) setEndDate(date);
                    }}
                  />
                )}
              </View>
            </View>

            <Button
              label="Save Changes"
              onPress={() => editMutation.mutate()}
              loading={editMutation.isPending}
              disabled={!title.trim()}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function EditItemModal({
  visible,
  item,
  tripStartDate,
  tripEndDate,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  item: ItineraryItem;
  tripStartDate?: Date;
  tripEndDate?: Date;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const mutedFg = useUnstableNativeVariable("--muted-foreground");
  const mutedColor = mutedFg ? `hsl(${mutedFg})` : "#9CA3AF";

  const [title, setTitle] = useState(item.title);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [selectedDate, setSelectedDate] = useState(new Date(item.date));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const parseTime = (t: string | null): Date | null => {
    if (!t) return null;
    const [h, m] = t.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  const [startTimeDate, setStartTimeDate] = useState<Date | null>(parseTime(item.startTime));
  const [endTimeDate, setEndTimeDate] = useState<Date | null>(parseTime(item.endTime));

  useEffect(() => {
    setTitle(item.title);
    setNotes(item.notes ?? "");
    setSelectedDate(new Date(item.date));
    setStartTimeDate(parseTime(item.startTime));
    setEndTimeDate(parseTime(item.endTime));
  }, [item]);

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  const invalidTimeRange = hasInvalidTimeRange(startTimeDate, endTimeDate);

  const editMutation = useMutation({
    mutationFn: async () => {
      if (hasInvalidTimeRange(startTimeDate, endTimeDate)) {
        throw new Error("Start time must be earlier than end time");
      }
      const res = await client.api.v1["itinerary-items"]({ id: item.id }).patch({
        title,
        date: selectedDate.toISOString(),
        startTime: startTimeDate ? fmtTime(startTimeDate) : null,
        endTime: endTimeDate ? fmtTime(endTimeDate) : null,
        notes: notes || null,
      });
      if (res.error) throw new Error("Failed to update item");
      return res.data;
    },
    onSuccess,
  });

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 justify-end bg-black/50">
        <View className="rounded-t-3xl bg-background px-5 pb-10 pt-6">
          <View className="mb-5 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-foreground">Edit Item</Text>
            <Pressable onPress={onClose}>
              <Text className="text-base font-medium text-primary">Cancel</Text>
            </Pressable>
          </View>

          <View className="gap-4">
            <TextInput
              className="rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground"
              placeholder="What are you doing?"
              placeholderTextColor={mutedColor}
              value={title}
              onChangeText={setTitle}
            />

            <View className="gap-1">
              <Text className="text-sm font-medium text-muted-foreground">Date</Text>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                className="flex-row items-center gap-2 rounded-xl border border-border bg-card px-4 py-3"
              >
                <Calendar size={16} color={mutedColor} />
                <Text className="text-base text-foreground">{formatDate(selectedDate)}</Text>
              </Pressable>
              {showDatePicker && Platform.OS === "ios" && (
                <IOSDateTimePickerModal
                  visible={showDatePicker}
                  title="Item Date"
                  value={selectedDate}
                  mode="date"
                  minimumDate={tripStartDate}
                  maximumDate={tripEndDate}
                  onCancel={() => setShowDatePicker(false)}
                  onConfirm={(date) => {
                    setShowDatePicker(false);
                    setSelectedDate(date);
                  }}
                />
              )}
              {showDatePicker && Platform.OS !== "ios" && (
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="default"
                  minimumDate={tripStartDate}
                  maximumDate={tripEndDate}
                  onChange={(_, date) => {
                    setShowDatePicker(false);
                    if (date) setSelectedDate(date);
                  }}
                />
              )}
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1 gap-1">
                <Text className="text-sm font-medium text-muted-foreground">Start Time</Text>
                <Pressable
                  onPress={() => setShowStartTimePicker(true)}
                  className="flex-row items-center gap-2 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <Clock size={16} color={mutedColor} />
                  <Text
                    className={`text-base ${startTimeDate ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {startTimeDate ? fmtTime(startTimeDate) : "Optional"}
                  </Text>
                </Pressable>
                {showStartTimePicker && Platform.OS === "ios" && (
                  <IOSDateTimePickerModal
                    visible={showStartTimePicker}
                    title="Start Time"
                    value={startTimeDate ?? new Date()}
                    mode="time"
                    is24Hour
                    onCancel={() => setShowStartTimePicker(false)}
                    onConfirm={(date) => {
                      setShowStartTimePicker(false);
                      setStartTimeDate(date);
                    }}
                  />
                )}
                {showStartTimePicker && Platform.OS !== "ios" && (
                  <DateTimePicker
                    value={startTimeDate ?? new Date()}
                    mode="time"
                    is24Hour
                    display="default"
                    onChange={(_, date) => {
                      setShowStartTimePicker(false);
                      if (date) setStartTimeDate(date);
                    }}
                  />
                )}
              </View>
              <View className="flex-1 gap-1">
                <Text className="text-sm font-medium text-muted-foreground">End Time</Text>
                <Pressable
                  onPress={() => setShowEndTimePicker(true)}
                  className="flex-row items-center gap-2 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <Clock size={16} color={mutedColor} />
                  <Text
                    className={`text-base ${endTimeDate ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {endTimeDate ? fmtTime(endTimeDate) : "Optional"}
                  </Text>
                </Pressable>
                {showEndTimePicker && Platform.OS === "ios" && (
                  <IOSDateTimePickerModal
                    visible={showEndTimePicker}
                    title="End Time"
                    value={endTimeDate ?? new Date()}
                    mode="time"
                    is24Hour
                    onCancel={() => setShowEndTimePicker(false)}
                    onConfirm={(date) => {
                      setShowEndTimePicker(false);
                      setEndTimeDate(date);
                    }}
                  />
                )}
                {showEndTimePicker && Platform.OS !== "ios" && (
                  <DateTimePicker
                    value={endTimeDate ?? new Date()}
                    mode="time"
                    is24Hour
                    display="default"
                    onChange={(_, date) => {
                      setShowEndTimePicker(false);
                      if (date) setEndTimeDate(date);
                    }}
                  />
                )}
              </View>
            </View>

            {invalidTimeRange && (
              <Text className="text-sm text-destructive">
                Start time must be earlier than end time
              </Text>
            )}

            <TextInput
              className="rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground"
              placeholder="Notes (optional)"
              placeholderTextColor={mutedColor}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
              maxLength={500}
            />

            <Button
              label="Save Changes"
              onPress={() => editMutation.mutate()}
              loading={editMutation.isPending}
              disabled={!title.trim() || invalidTimeRange}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
