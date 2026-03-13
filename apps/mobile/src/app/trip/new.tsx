import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { FlatList, Pressable, Text, View } from "react-native";
import { z } from "zod";
import { apiBaseUrl } from "@/api/client";
import { Button } from "@/components/shared/Button";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { LoadingOverlay } from "@/components/shared/LoadingOverlay";
import { Screen } from "@/components/shared/Screen";
import { TextField } from "@/components/shared/TextField";
import { useAuthStore } from "@/store/authStore";

type DestinationResult = {
  id: string;
  name: string;
  country: string;
  countryCode: string;
};

type Trip = {
  id: string;
  destinationId: string;
  title: string;
  startDate: string;
  endDate: string;
};

const tripSchema = z
  .object({
    destinationId: z.string().min(1, "Please choose a destination"),
    destinationSearch: z.string().min(2, "Type at least 2 characters"),
    title: z.string().min(1, "Title is required").max(100, "Title is too long"),
    startDate: z
      .string()
      .min(1, "Start date is required")
      .refine((value) => !Number.isNaN(Date.parse(value)), {
        message: "Use format YYYY-MM-DD",
      }),
    endDate: z
      .string()
      .min(1, "End date is required")
      .refine((value) => !Number.isNaN(Date.parse(value)), {
        message: "Use format YYYY-MM-DD",
      }),
  })
  .refine(
    (values) => {
      const start = Date.parse(values.startDate);
      const end = Date.parse(values.endDate);
      return !Number.isNaN(start) && !Number.isNaN(end) && end >= start;
    },
    {
      message: "End date must be on or after start date",
      path: ["endDate"],
    },
  );

type TripFormValues = z.infer<typeof tripSchema>;

async function fetchDestinations(
  query: string,
  accessToken: string | null,
): Promise<DestinationResult[]> {
  if (!accessToken || query.trim().length < 2) {
    return [];
  }

  const url = new URL("/api/v1/destinations", apiBaseUrl);
  url.searchParams.set("q", query.trim());

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to load destinations");
  }

  const data = (await response.json()) as { destinations: DestinationResult[] };
  return data.destinations;
}

async function createTrip(
  values: TripFormValues,
  accessToken: string | null,
): Promise<Trip> {
  if (!accessToken) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${apiBaseUrl}/api/v1/trips`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      destinationId: values.destinationId,
      title: values.title.trim(),
      startDate: new Date(values.startDate).toISOString(),
      endDate: new Date(values.endDate).toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to create trip");
  }

  const data = (await response.json()) as { trip: Trip };
  return data.trip;
}

export default function NewTripScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TripFormValues>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      destinationId: "",
      destinationSearch: "",
      title: "",
      startDate: "",
      endDate: "",
    },
  });

  const destinationSearch = watch("destinationSearch");

  const destinationsQuery = useQuery({
    queryKey: ["destinations", destinationSearch],
    queryFn: () => fetchDestinations(destinationSearch, accessToken),
    enabled: destinationSearch.trim().length >= 2,
  });

  const createTripMutation = useMutation({
    mutationFn: (values: TripFormValues) => createTrip(values, accessToken),
    onSuccess: async (trip) => {
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
      router.replace(`/trip/${trip.id}` as never);
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    await createTripMutation.mutateAsync(values);
  });

  const showDestinationResults =
    destinationSearch.trim().length >= 2 && destinationsQuery.data?.length;

  return (
    <Screen scrollable>
      <View className="flex-1 gap-6">
        <View className="gap-2">
          <Text className="text-2xl font-bold text-foreground">Create a trip</Text>
          <Text className="text-sm text-muted-foreground">
            Choose a destination and dates to start building your itinerary.
          </Text>
        </View>

        <ErrorBanner
          message={
            createTripMutation.error ? "Unable to create trip. Please try again." : null
          }
        />

        <View className="gap-4">
          <Controller
            control={control}
            name="destinationSearch"
            render={({ field: { value, onChange } }) => (
              <View>
                <TextField
                  label="Destination"
                  placeholder="Search city or region"
                  value={value}
                  onChangeText={onChange}
                  autoCapitalize="words"
                  keyboardType="default"
                  error={errors.destinationId?.message ?? errors.destinationSearch?.message}
                />
                {showDestinationResults ? (
                  <View className="mt-2 rounded-xl border border-border bg-card">
                    {destinationsQuery.isLoading ? (
                      <View className="px-4 py-3">
                        <Text className="text-sm text-muted-foreground">
                          Searching destinations...
                        </Text>
                      </View>
                    ) : (
                      <FlatList
                        data={destinationsQuery.data}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                          <Pressable
                            className="border-t border-border px-4 py-3 active:bg-muted"
                            onPress={() => {
                              setValue("destinationId", item.id, { shouldValidate: true });
                              setValue(
                                "destinationSearch",
                                `${item.name}, ${item.countryCode}`,
                                { shouldValidate: true },
                              );
                            }}
                          >
                            <Text className="text-sm font-medium text-foreground">
                              {item.name}
                            </Text>
                            <Text className="text-xs text-muted-foreground">
                              {item.country} · {item.countryCode}
                            </Text>
                          </Pressable>
                        )}
                      />
                    )}
                  </View>
                ) : null}
              </View>
            )}
          />

          <Controller
            control={control}
            name="title"
            render={({ field: { value, onChange } }) => (
              <TextField
                label="Trip name"
                placeholder="Summer in Tokyo"
                value={value}
                onChangeText={onChange}
                autoCapitalize="words"
                keyboardType="default"
                error={errors.title?.message}
              />
            )}
          />

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Controller
                control={control}
                name="startDate"
                render={({ field: { value, onChange } }) => (
                  <TextField
                    label="Start date"
                    placeholder="YYYY-MM-DD"
                    value={value}
                    onChangeText={onChange}
                    keyboardType="default"
                    error={errors.startDate?.message}
                  />
                )}
              />
            </View>
            <View className="flex-1">
              <Controller
                control={control}
                name="endDate"
                render={({ field: { value, onChange } }) => (
                  <TextField
                    label="End date"
                    placeholder="YYYY-MM-DD"
                    value={value}
                    onChangeText={onChange}
                    keyboardType="default"
                    error={errors.endDate?.message}
                  />
                )}
              />
            </View>
          </View>
        </View>

        <View className="mt-2 gap-3">
          <Button
            label="Create trip"
            onPress={() => void onSubmit()}
            loading={isSubmitting || createTripMutation.isPending}
          />
        </View>
      </View>

      {createTripMutation.isPending ? <LoadingOverlay label="Creating your trip..." /> : null}
    </Screen>
  );
}

