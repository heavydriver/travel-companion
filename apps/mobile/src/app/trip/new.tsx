import { zodResolver } from "@hookform/resolvers/zod";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Calendar, ChevronLeft, MapPin, Search, X } from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from "react-native";
import { z } from "zod";
import { client } from "@/api/client";
import { Button } from "@/components/shared/Button";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { IOSDateTimePickerModal } from "@/components/shared/IOSDateTimePickerModal";
import { useDebounce } from "@/hooks/useDebounce";
import { useOfflineGuard } from "@/hooks/useOfflineGuard";
import { Screen } from "@/components/shared/Screen";
import { formatDate } from "@/lib/utils";

const tripSchema = z
  .object({
    destinationId: z.string().min(1, "Please select a destination"),
    title: z.string().min(1, "Title is required").max(100),
    startDate: z.date({ required_error: "Start date is required" }),
    endDate: z.date({ required_error: "End date is required" }),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

type TripValues = z.infer<typeof tripSchema>;

type Destination = {
  id: string;
  name: string;
  country: string;
  countryCode: string;
};

export default function NewTripScreen() {
  const params = useLocalSearchParams<{
    destinationId?: string;
    destinationName?: string;
    destinationCountry?: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutedFg = useUnstableNativeVariable("--muted-foreground");
  const mutedColor = mutedFg ? `hsl(${mutedFg})` : "#9CA3AF";
  const foreground = useUnstableNativeVariable("--foreground");
  const iconColor = foreground ? `hsl(${foreground})` : undefined;

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [selectedDest, setSelectedDest] = useState<Destination | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TripValues>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      destinationId: "",
      title: "",
      startDate: undefined,
      endDate: undefined,
    },
  });

  const startDate = watch("startDate");
  const endDate = watch("endDate");

  const destQuery = useQuery({
    queryKey: ["destinations", debouncedSearch],
    queryFn: async () => {
      const res = await client.api.v1.destinations.get({
        query: { q: debouncedSearch },
      });
      if (res.error) throw new Error("Failed to search destinations");
      return res.data;
    },
    enabled: debouncedSearch.length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: async (values: TripValues) => {
      const res = await client.api.v1.trips.post({
        destinationId: values.destinationId,
        title: values.title,
        startDate: values.startDate.toISOString(),
        endDate: values.endDate.toISOString(),
      });
      if (res.error) throw new Error("Failed to create trip");
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      router.back();
    },
  });

  const { guardAction } = useOfflineGuard();
  const onSubmit = handleSubmit((values) => guardAction(() => createMutation.mutate(values)));

  const selectDestination = (dest: Destination) => {
    setSelectedDest(dest);
    setValue("destinationId", dest.id);
    setSearchQuery(`${dest.name}, ${dest.country}`);
    setShowResults(false);
  };

  const clearDestination = () => {
    setSelectedDest(null);
    setValue("destinationId", "");
    setSearchQuery("");
  };

  useEffect(() => {
    if (!params.destinationId || !params.destinationName) return;
    const prefetchedDestination: Destination = {
      id: params.destinationId,
      name: params.destinationName,
      country: params.destinationCountry ?? "",
      countryCode: "",
    };
    setSelectedDest(prefetchedDestination);
    setValue("destinationId", prefetchedDestination.id);
    setSearchQuery(
      prefetchedDestination.country
        ? `${prefetchedDestination.name}, ${prefetchedDestination.country}`
        : prefetchedDestination.name,
    );
    setShowResults(false);
  }, [params.destinationCountry, params.destinationId, params.destinationName, setValue]);

  return (
    <Screen scrollable>
      <View className="gap-6">
        {/* Header */}
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center gap-1 active:opacity-80"
          >
            <ChevronLeft size={20} color={iconColor} />
            <Text className="text-base font-medium text-primary">Cancel</Text>
          </Pressable>
          <Text className="flex-1 text-center text-lg font-bold text-foreground">New Trip</Text>
          <View className="w-14" />
        </View>

        <ErrorBanner message={createMutation.error?.message ?? null} />

        {/* Selected destination chip */}
        {selectedDest ? (
          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Destination</Text>
            <View className="flex-row items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
              <MapPin size={18} color={iconColor} />
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">{selectedDest.name}</Text>
                <Text className="text-sm text-muted-foreground">{selectedDest.country}</Text>
              </View>
              <Pressable onPress={clearDestination} className="active:opacity-80">
                <X size={18} color={mutedColor} />
              </Pressable>
            </View>
          </View>
        ) : (
          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Destination</Text>
            <View className="flex-row items-center rounded-xl border border-border bg-card px-3">
              <Search size={18} color={mutedColor} />
              <TextInput
                className="ml-2 flex-1 py-3 text-base text-foreground"
                placeholder="Search cities..."
                placeholderTextColor={mutedColor}
                value={searchQuery}
                onChangeText={(t) => {
                  setSearchQuery(t);
                  setShowResults(true);
                }}
              />
            </View>
            {errors.destinationId && (
              <Text className="text-sm text-destructive">{errors.destinationId.message}</Text>
            )}

            {showResults && searchQuery.length >= 2 && (
              <View className="rounded-xl border border-border bg-card">
                {destQuery.isLoading && (
                  <View className="items-center py-4">
                    <ActivityIndicator />
                  </View>
                )}
                {destQuery.data?.destinations?.map((dest) => (
                  <Pressable
                    key={dest.id}
                    onPress={() => selectDestination(dest as Destination)}
                    className="flex-row items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 active:bg-muted"
                  >
                    <MapPin size={18} color={mutedColor} />
                    <View>
                      <Text className="text-base font-medium text-foreground">{dest.name}</Text>
                      <Text className="text-sm text-muted-foreground">
                        {(dest as Destination).country}
                      </Text>
                    </View>
                  </Pressable>
                ))}
                {destQuery.data?.destinations?.length === 0 && (
                  <Text className="px-4 py-3 text-sm text-muted-foreground">
                    No destinations found
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Title */}
        <View className="gap-2">
          <Text className="text-sm font-medium text-foreground">Trip Title</Text>
          <Controller
            control={control}
            name="title"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className="rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground"
                placeholder="e.g. Tokyo Adventure"
                placeholderTextColor={mutedColor}
                value={value}
                onChangeText={onChange}
                maxLength={100}
              />
            )}
          />
          {errors.title && <Text className="text-sm text-destructive">{errors.title.message}</Text>}
        </View>

        {/* Dates */}
        <View className="flex-row gap-3">
          <View className="flex-1 gap-2">
            <Text className="text-sm font-medium text-foreground">Start Date</Text>
            <Pressable
              onPress={() => setShowStartPicker(true)}
              className="flex-row items-center gap-2 rounded-xl border border-border bg-card px-4 py-3"
            >
              <Calendar size={16} color={mutedColor} />
              <Text
                className={`text-base ${startDate ? "text-foreground" : "text-muted-foreground"}`}
              >
                {startDate ? formatDate(startDate) : "Select"}
              </Text>
            </Pressable>
            {showStartPicker && Platform.OS === "ios" && (
              <IOSDateTimePickerModal
                visible={showStartPicker}
                title="Start Date"
                value={startDate ?? new Date()}
                mode="date"
                minimumDate={new Date()}
                onCancel={() => setShowStartPicker(false)}
                onConfirm={(date) => {
                  setShowStartPicker(false);
                  setValue("startDate", date, { shouldValidate: true });
                  if (endDate && date > endDate) {
                    setValue("endDate", date, { shouldValidate: true });
                  }
                }}
              />
            )}
            {showStartPicker && Platform.OS !== "ios" && (
              <DateTimePicker
                value={startDate ?? new Date()}
                mode="date"
                minimumDate={new Date()}
                display="default"
                onChange={(_, date) => {
                  setShowStartPicker(false);
                  if (date) {
                    setValue("startDate", date, { shouldValidate: true });
                    if (endDate && date > endDate) {
                      setValue("endDate", date, { shouldValidate: true });
                    }
                  }
                }}
              />
            )}
            {errors.startDate && (
              <Text className="text-sm text-destructive">{errors.startDate.message}</Text>
            )}
          </View>

          <View className="flex-1 gap-2">
            <Text className="text-sm font-medium text-foreground">End Date</Text>
            <Pressable
              onPress={() => setShowEndPicker(true)}
              className="flex-row items-center gap-2 rounded-xl border border-border bg-card px-4 py-3"
            >
              <Calendar size={16} color={mutedColor} />
              <Text
                className={`text-base ${endDate ? "text-foreground" : "text-muted-foreground"}`}
              >
                {endDate ? formatDate(endDate) : "Select"}
              </Text>
            </Pressable>
            {showEndPicker && Platform.OS === "ios" && (
              <IOSDateTimePickerModal
                visible={showEndPicker}
                title="End Date"
                value={endDate ?? startDate ?? new Date()}
                mode="date"
                minimumDate={startDate ?? new Date()}
                onCancel={() => setShowEndPicker(false)}
                onConfirm={(date) => {
                  setShowEndPicker(false);
                  setValue("endDate", date, { shouldValidate: true });
                }}
              />
            )}
            {showEndPicker && Platform.OS !== "ios" && (
              <DateTimePicker
                value={endDate ?? startDate ?? new Date()}
                mode="date"
                minimumDate={startDate ?? new Date()}
                display="default"
                onChange={(_, date) => {
                  setShowEndPicker(false);
                  if (date) {
                    setValue("endDate", date, { shouldValidate: true });
                  }
                }}
              />
            )}
            {errors.endDate && (
              <Text className="text-sm text-destructive">{errors.endDate.message}</Text>
            )}
          </View>
        </View>

        {/* Trip summary preview */}
        {selectedDest && startDate && endDate && (
          <View className="rounded-xl border border-border bg-card/50 px-4 py-3">
            <Text className="text-sm text-muted-foreground">
              {Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1}{" "}
              days in {selectedDest.name}, {selectedDest.country}
            </Text>
          </View>
        )}

        <Button
          label="Create Trip"
          onPress={() => void onSubmit()}
          loading={createMutation.isPending}
        />
      </View>
    </Screen>
  );
}
