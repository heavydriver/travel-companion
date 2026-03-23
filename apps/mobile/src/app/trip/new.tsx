import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { MapPin, Search } from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { z } from "zod";
import { client } from "@/api/client";
import { Button } from "@/components/shared/Button";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { Screen } from "@/components/shared/Screen";

const tripSchema = z
  .object({
    destinationId: z.string().min(1, "Please select a destination"),
    title: z.string().min(1, "Title is required").max(100),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
  })
  .refine((d) => new Date(d.endDate) >= new Date(d.startDate), {
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutedFg = useUnstableNativeVariable("--muted-foreground");
  const mutedColor = mutedFg ? `hsl(${mutedFg})` : "#9CA3AF";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDest, setSelectedDest] = useState<Destination | null>(null);
  const [showResults, setShowResults] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<TripValues>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      destinationId: "",
      title: "",
      startDate: "",
      endDate: "",
    },
  });

  const destQuery = useQuery({
    queryKey: ["destinations", searchQuery],
    queryFn: async () => {
      const res = await client.api.v1.destinations.get({
        query: { q: searchQuery },
      });
      if (res.error) throw new Error("Failed to search destinations");
      return res.data;
    },
    enabled: searchQuery.length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: async (values: TripValues) => {
      const res = await client.api.v1.trips.post({
        destinationId: values.destinationId,
        title: values.title,
        startDate: new Date(values.startDate).toISOString(),
        endDate: new Date(values.endDate).toISOString(),
      });
      if (res.error) throw new Error("Failed to create trip");
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      router.back();
    },
  });

  const onSubmit = handleSubmit((values) => createMutation.mutate(values));

  const selectDestination = (dest: Destination) => {
    setSelectedDest(dest);
    setValue("destinationId", dest.id);
    setSearchQuery(`${dest.name}, ${dest.country}`);
    setShowResults(false);
  };

  return (
    <Screen scrollable>
      <View className="gap-6">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="active:opacity-80">
            <Text className="text-base font-medium text-primary">Cancel</Text>
          </Pressable>
          <Text className="flex-1 text-center text-lg font-bold text-foreground">
            New Trip
          </Text>
          <View className="w-14" />
        </View>

        <ErrorBanner
          message={createMutation.error?.message ?? null}
        />

        {/* Destination search */}
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
                if (selectedDest && t !== `${selectedDest.name}, ${selectedDest.country}`) {
                  setSelectedDest(null);
                  setValue("destinationId", "");
                }
              }}
            />
          </View>
          {errors.destinationId && (
            <Text className="text-sm text-destructive">
              {errors.destinationId.message}
            </Text>
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
                    <Text className="text-base font-medium text-foreground">
                      {dest.name}
                    </Text>
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
          {errors.title && (
            <Text className="text-sm text-destructive">{errors.title.message}</Text>
          )}
        </View>

        {/* Dates */}
        <View className="flex-row gap-3">
          <View className="flex-1 gap-2">
            <Text className="text-sm font-medium text-foreground">Start Date</Text>
            <Controller
              control={control}
              name="startDate"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  className="rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground"
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={mutedColor}
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
            {errors.startDate && (
              <Text className="text-sm text-destructive">
                {errors.startDate.message}
              </Text>
            )}
          </View>

          <View className="flex-1 gap-2">
            <Text className="text-sm font-medium text-foreground">End Date</Text>
            <Controller
              control={control}
              name="endDate"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  className="rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground"
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={mutedColor}
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
            {errors.endDate && (
              <Text className="text-sm text-destructive">
                {errors.endDate.message}
              </Text>
            )}
          </View>
        </View>

        <Button
          label="Create Trip"
          onPress={() => void onSubmit()}
          loading={createMutation.isPending}
        />
      </View>
    </Screen>
  );
}
