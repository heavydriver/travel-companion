import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation } from "@tanstack/react-query";
import { Calendar, Clock } from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
import { client } from "@/api/client";
import { formatDate, toDateOnly } from "@/lib/utils";
import { Button } from "./Button";
import { IOSDateTimePickerModal } from "./IOSDateTimePickerModal";

type AddItineraryItemModalProps = {
  visible: boolean;
  tripId: string;
  defaultDate: Date;
  tripStartDate?: Date;
  tripEndDate?: Date;
  initialTitle?: string;
  initialPlaceId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
  onSuccessMessage?: (title: string) => void;
};

function hasInvalidTimeRange(startTime: Date | null, endTime: Date | null) {
  if (!startTime || !endTime) return false;
  return startTime.getTime() >= endTime.getTime();
}

export function AddItineraryItemModal({
  visible,
  tripId,
  defaultDate,
  tripStartDate,
  tripEndDate,
  initialTitle,
  initialPlaceId,
  onClose,
  onSuccess,
  onSuccessMessage,
}: AddItineraryItemModalProps) {
  const mutedFg = useUnstableNativeVariable("--muted-foreground");
  const mutedColor = mutedFg ? `hsl(${mutedFg})` : "#9CA3AF";

  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [startTimeDate, setStartTimeDate] = useState<Date | null>(null);
  const [endTimeDate, setEndTimeDate] = useState<Date | null>(null);
  const [linkedPlaceId, setLinkedPlaceId] = useState<string | null>(null);

  const { control, handleSubmit, reset } = useForm({
    defaultValues: {
      title: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!visible) return;
    setSelectedDate(defaultDate);
    reset({
      title: (initialTitle ?? "").trim() ? (initialTitle ?? "") : "",
      notes: "",
    });
    setLinkedPlaceId(initialPlaceId ?? null);
    setStartTimeDate(null);
    setEndTimeDate(null);
  }, [visible, defaultDate, initialTitle, initialPlaceId, reset]);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  const invalidTimeRange = hasInvalidTimeRange(startTimeDate, endTimeDate);

  const addMutation = useMutation({
    mutationFn: async (values: { title: string; notes: string }) => {
      if (hasInvalidTimeRange(startTimeDate, endTimeDate)) {
        throw new Error("Start time must be earlier than end time");
      }
      const dateStr = toDateOnly(selectedDate);
      const res = await client.api.v1.trips({ tripId })["itinerary-items"].post({
        title: values.title,
        date: new Date(dateStr).toISOString(),
        ...(startTimeDate && { startTime: formatTime(startTimeDate) }),
        ...(endTimeDate && { endTime: formatTime(endTimeDate) }),
        ...(values.notes && { notes: values.notes }),
        ...(linkedPlaceId ? { placeId: linkedPlaceId } : {}),
      });
      if (res.error) throw new Error("Failed to add item");
      return values.title;
    },
    onSuccess: (title) => {
      reset();
      setStartTimeDate(null);
      setEndTimeDate(null);
      setSelectedDate(defaultDate);
      setLinkedPlaceId(null);
      onSuccessMessage?.(title);
      onSuccess();
    },
  });

  const handleClose = () => {
    reset();
    setStartTimeDate(null);
    setEndTimeDate(null);
    setSelectedDate(defaultDate);
    setLinkedPlaceId(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 justify-end bg-black/50">
        <View className="rounded-t-3xl bg-background px-5 pb-10 pt-6">
          <View className="mb-5 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-foreground">Add Item</Text>
            <Pressable onPress={handleClose}>
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
                    {startTimeDate ? formatTime(startTimeDate) : "Optional"}
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
                    {endTimeDate ? formatTime(endTimeDate) : "Optional"}
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

            {addMutation.error && (
              <Text className="text-sm text-destructive">{addMutation.error.message}</Text>
            )}

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
              disabled={invalidTimeRange}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
