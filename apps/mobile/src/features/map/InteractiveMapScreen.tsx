import BottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFlatList,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import { approximateNumber as approx } from "approximate-number";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  Crosshair,
  MapPin,
  Minus,
  Navigation,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react-native";
import { Camera, MapView, MarkerView, StyleURL, UserLocation } from "@rnmapbox/maps";
import { useColorScheme, useUnstableNativeVariable } from "nativewind";
import { type ElementRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { client } from "@/api/client";
import { PlaceCard } from "@/components/shared/PlaceCard";
import { Button } from "@/components/shared/Button";
import { getEligibleTripForDestination, type Trip, useTripStore } from "@/store/tripStore";
import { useMapSessionStore, type MapSessionPlace } from "@/store/mapSessionStore";
import { THEME } from "@/lib/theme";
import { ensureMapboxToken } from "./ensureMapboxToken";
import { applyMapFilters, deriveCategories, type MapFilterControls } from "./filterMapPlaces";
import { MapPinMarker } from "./MapPinMarker";
import { pinColorForCategory } from "./categoryPinColor";

function toRad(n: number) {
  return (n * Math.PI) / 180;
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

type ApiPlaceRow = {
  id: string;
  destinationId: string;
  name: string;
  category: string;
  description: string | null;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  isCurated: boolean;
  isFeatured: boolean;
  openingHours?: unknown | null;
};

function normalizeListPlace(p: ApiPlaceRow): MapSessionPlace {
  return {
    id: p.id,
    destinationId: p.destinationId,
    name: p.name,
    category: p.category,
    description: p.description,
    latitude: p.latitude,
    longitude: p.longitude,
    imageUrl: p.imageUrl,
    rating: p.rating,
    reviewCount: p.reviewCount,
    isCurated: p.isCurated,
    isFeatured: p.isFeatured,
    openingHours: p.openingHours ?? null,
  };
}

function formatCategoryLabel(category: string): string {
  const t = category.trim();
  if (!t) return "Place";
  return t
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

type PlaceDetail = {
  id: string;
  destinationId: string;
  name: string;
  category: string;
  description: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  imageUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  isCurated: boolean;
};

export function InteractiveMapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { colorScheme } = useColorScheme();
  const primaryParts = useUnstableNativeVariable("--primary");
  const primaryIconColor = primaryParts ? `hsl(${primaryParts})` : "#3B82F6";
  const session = useMapSessionStore((s) => s.session);
  const clearSession = useMapSessionStore((s) => s.clearSession);
  const storeTrips = useTripStore((s) => s.trips);
  const activeTrip = useTripStore((s) => s.activeTrip)();

  const [mapReady, setMapReady] = useState(false);
  const [tokenOk, setTokenOk] = useState(() => ensureMapboxToken());
  const [locPermission, setLocPermission] = useState<Location.PermissionStatus | null>(null);
  const [userCoord, setUserCoord] = useState<[number, number] | null>(null);
  const [, setZoom] = useState(12);
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [minRating, setMinRating] = useState<number | null>(null);
  const [curatedOnly, setCuratedOnly] = useState(false);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [itineraryOnly, setItineraryOnly] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [sheetMode, setSheetMode] = useState<"list" | "detail">("list");
  const [nowTick, setNowTick] = useState(() => new Date());

  const cameraRef = useRef<ElementRef<typeof Camera>>(null);
  const sheetRef = useRef<BottomSheet>(null);
  const didInitialFly = useRef(false);

  const destinationId = session?.destinationId ?? activeTrip?.destination.id ?? null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: destination scope changes require resetting fly + filters
  useEffect(() => {
    didInitialFly.current = false;
    setSelectedCategories(new Set());
  }, [destinationId]);

  useEffect(() => {
    setTokenOk(ensureMapboxToken());
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNowTick(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await Location.requestForegroundPermissionsAsync();
      setLocPermission(res.status);
    })();
  }, []);

  const destinationQuery = useQuery({
    queryKey: ["destination-details", destinationId],
    queryFn: async () => {
      if (!destinationId) throw new Error("No destination");
      const res = await client.api.v1.destinations({ destId: destinationId }).get();
      if (res.error) throw new Error("Failed to load destination");
      return res.data;
    },
    enabled: Boolean(destinationId),
    staleTime: 5 * 60 * 1000,
  });

  const placesQuery = useQuery({
    queryKey: ["map-destination-places", destinationId],
    queryFn: async () => {
      if (!destinationId) throw new Error("No destination");
      const res = await client.api.v1.destinations({ destId: destinationId }).places.get();
      if (res.error) throw new Error("Failed to load places");
      return res.data;
    },
    enabled: Boolean(destinationId && (!session || session.places.length === 0)),
    staleTime: 2 * 60 * 1000,
  });

  const tripsQuery = useQuery({
    queryKey: ["trips", "destination", destinationId],
    queryFn: async () => {
      if (!destinationId) throw new Error("No destination");
      const res = await client.api.v1.trips.get({ query: { destinationId } });
      if (res.error) throw new Error("Failed to load trips");
      return res.data;
    },
    enabled: Boolean(destinationId),
    staleTime: 60 * 1000,
  });

  const eligibleTrip = useMemo(() => {
    if (!destinationId) return undefined;
    const fromApi = (tripsQuery.data?.trips ?? []) as Trip[];
    const list = tripsQuery.isSuccess ? fromApi : storeTrips.filter((t) => t.destination.id === destinationId);
    return getEligibleTripForDestination(list, destinationId);
  }, [destinationId, tripsQuery.data, tripsQuery.isSuccess, storeTrips]);

  const itineraryQuery = useQuery({
    queryKey: ["itinerary", eligibleTrip?.id],
    queryFn: async () => {
      if (!eligibleTrip) throw new Error("No trip");
      const res = await client.api.v1.trips({ tripId: eligibleTrip.id })["itinerary-items"].get();
      if (res.error) throw new Error("Failed to load itinerary");
      return res.data;
    },
    enabled: Boolean(eligibleTrip?.id),
    staleTime: 30 * 1000,
  });

  const itineraryPlaceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const it of (itineraryQuery.data?.items ?? []) as { placeId: string | null }[]) {
      if (it.placeId) ids.add(it.placeId);
    }
    return ids;
  }, [itineraryQuery.data]);

  const destinationTimezone = useMemo(() => {
    if (session?.timezone) return session.timezone;
    const d = destinationQuery.data?.destination as { timezone?: string } | undefined;
    return d?.timezone?.trim() ?? null;
  }, [session?.timezone, destinationQuery.data]);

  const basePlaces = useMemo((): MapSessionPlace[] => {
    if (session && session.places.length > 0) return session.places;
    const raw = (placesQuery.data?.places ?? []) as ApiPlaceRow[];
    return raw.map((p) => normalizeListPlace(p));
  }, [session, placesQuery.data]);

  const destCenter = useMemo(() => {
    if (session) return { lat: session.latitude, lng: session.longitude };
    const d = destinationQuery.data?.destination as { latitude: number; longitude: number } | undefined;
    if (d) return { lat: d.latitude, lng: d.longitude };
    return null;
  }, [session, destinationQuery.data]);

  useEffect(() => {
    if (!mapReady || didInitialFly.current) return;
    if (locPermission === null) return;

    if (locPermission === "granted") {
      void Location.getCurrentPositionAsync({})
        .then((pos) => {
          const coord: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          setUserCoord(coord);
          didInitialFly.current = true;
          cameraRef.current?.setCamera({
            centerCoordinate: coord,
            zoomLevel: 15,
            animationDuration: 400,
          });
        })
        .catch(() => {
          if (!destCenter) return;
          didInitialFly.current = true;
          cameraRef.current?.setCamera({
            centerCoordinate: [destCenter.lng, destCenter.lat],
            zoomLevel: 12,
            animationDuration: 350,
          });
        });
      return;
    }

    if (!destCenter) return;
    didInitialFly.current = true;
    cameraRef.current?.setCamera({
      centerCoordinate: [destCenter.lng, destCenter.lat],
      zoomLevel: 12,
      animationDuration: 350,
    });
  }, [mapReady, locPermission, destCenter]);

  const allCategories = useMemo(() => deriveCategories(basePlaces), [basePlaces]);

  const filterPayload: MapFilterControls = useMemo(
    () => ({
      search,
      selectedCategories,
      minRating,
      curatedOnly,
      openNowOnly,
      itineraryOnly,
      itineraryPlaceIds,
      destinationTimezone,
      now: nowTick,
    }),
    [
      search,
      selectedCategories,
      minRating,
      curatedOnly,
      openNowOnly,
      itineraryOnly,
      itineraryPlaceIds,
      destinationTimezone,
      nowTick,
    ],
  );

  const filteredPlaces = useMemo(
    () => applyMapFilters(basePlaces, filterPayload),
    [basePlaces, filterPayload],
  );

  const selectedPlace = useMemo(
    () => filteredPlaces.find((p) => p.id === selectedPlaceId) ?? null,
    [filteredPlaces, selectedPlaceId],
  );

  const placeDetailQuery = useQuery({
    queryKey: ["place-details", selectedPlaceId],
    queryFn: async () => {
      if (!selectedPlaceId) throw new Error("No place");
      const res = await client.api.v1.places({ id: selectedPlaceId }).get();
      if (res.error) throw new Error("Failed to load place");
      return res.data;
    },
    enabled: Boolean(selectedPlaceId && sheetMode === "detail"),
    staleTime: 60 * 1000,
  });

  const placeDetail = placeDetailQuery.data?.place as PlaceDetail | undefined;
  const detailHeroImageUrl = placeDetail?.imageUrl ?? selectedPlace?.imageUrl ?? null;
  const placeInItinerary = Boolean(
    selectedPlaceId && itineraryPlaceIds.has(selectedPlaceId),
  );

  const snapPoints = useMemo(() => ["26%", "48%", "82%"], []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={0} appearsOnIndex={1} opacity={0.35} />
    ),
    [],
  );

  const openPlace = useCallback(
    (id: string) => {
      setSelectedPlaceId(id);
      setSheetMode("detail");
      sheetRef.current?.snapToIndex(2);
    },
    [],
  );

  const closeDetail = useCallback(() => {
    setSheetMode("list");
    setSelectedPlaceId(null);
    sheetRef.current?.snapToIndex(1);
  }, []);

  const clearCategoryFilter = useCallback(() => {
    setSelectedCategories(new Set());
  }, []);

  const toggleCategory = useCallback((cat: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (prev.size === 0) {
        return new Set([cat]);
      }
      if (next.has(cat)) {
        next.delete(cat);
        return next;
      }
      next.add(cat);
      return next;
    });
  }, []);

  const recenterUser = useCallback(() => {
    if (userCoord) {
      cameraRef.current?.setCamera({
        centerCoordinate: userCoord,
        zoomLevel: 15,
        animationDuration: 450,
      });
      setZoom(15);
      return;
    }
    void (async () => {
      const pos = await Location.getCurrentPositionAsync({});
      const coord: [number, number] = [pos.coords.longitude, pos.coords.latitude];
      setUserCoord(coord);
      cameraRef.current?.setCamera({
        centerCoordinate: coord,
        zoomLevel: 15,
        animationDuration: 450,
      });
      setZoom(15);
    })();
  }, [userCoord]);

  const recenterDestination = useCallback(() => {
    if (!destCenter) return;
    cameraRef.current?.setCamera({
      centerCoordinate: [destCenter.lng, destCenter.lat],
      zoomLevel: 12,
      animationDuration: 450,
    });
    setZoom(12);
  }, [destCenter]);

  const onZoom = useCallback((delta: number) => {
    setZoom((z) => {
      const next = Math.min(19, Math.max(3, z + delta));
      cameraRef.current?.setCamera({ zoomLevel: next, animationDuration: 200 });
      return next;
    });
  }, []);

  const openAddToItinerary = useCallback(() => {
    if (!eligibleTrip || !selectedPlaceId) return;
    const title = placeDetail?.name ?? selectedPlace?.name ?? "Place";
    router.push({
      pathname: "/trip/[id]",
      params: {
        id: eligibleTrip.id,
        openAdd: "1",
        prefillTitle: title,
        prefillPlaceId: selectedPlaceId,
      },
    });
  }, [eligibleTrip, selectedPlaceId, placeDetail?.name, selectedPlace?.name, router]);

  const addPlaceToItinerary = useCallback(
    (placeId: string, title: string) => {
      if (!eligibleTrip) return;
      router.push({
        pathname: "/trip/[id]",
        params: {
          id: eligibleTrip.id,
          openAdd: "1",
          prefillTitle: title,
          prefillPlaceId: placeId,
        },
      });
    },
    [eligibleTrip, router],
  );

  const mapStyle = colorScheme === "dark" ? StyleURL.Dark : StyleURL.Street;

  if (!tokenOk) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-center text-base text-muted-foreground">
          Add{" "}
          <Text className="font-mono text-foreground">EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN</Text> to your
          environment to use the map.
        </Text>
      </View>
    );
  }

  if (!destinationId || !destCenter) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-center text-lg font-semibold text-foreground">No destination</Text>
        <Text className="mt-2 text-center text-sm text-muted-foreground">
          Select an active trip on Home, or open a destination and tap &quot;See map&quot;.
        </Text>
        <Pressable
          onPress={() => router.push("/(tabs)/" as never)}
          className="mt-6 rounded-xl bg-primary px-5 py-3 active:opacity-90"
        >
          <Text className="font-semibold text-primary-foreground">Go to Home</Text>
        </Pressable>
      </View>
    );
  }

  const loadingPlaces =
    (!session || session.places.length === 0) && placesQuery.isPending && basePlaces.length === 0;

  return (
    <View className="flex-1 bg-background">
      <MapView
        style={{ flex: 1 }}
        styleURL={mapStyle}
        scaleBarEnabled={false}
        logoEnabled={false}
        attributionEnabled={true}
        onDidFinishLoadingMap={() => setMapReady(true)}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [destCenter.lng, destCenter.lat],
            zoomLevel: 12,
          }}
        />
        {locPermission === "granted" ? (
          <UserLocation
            visible
            androidRenderMode="normal"
            showsUserHeadingIndicator={false}
            onUpdate={(loc) => {
              if (loc.coords) {
                setUserCoord([loc.coords.longitude, loc.coords.latitude]);
              }
            }}
          />
        ) : null}
        {mapReady
          ? filteredPlaces.map((p) => (
              <MarkerView
                key={p.id}
                coordinate={[p.longitude, p.latitude]}
                anchor={{ x: 0.5, y: 1 }}
                allowOverlap
              >
                <MapPinMarker
                  name={p.name}
                  category={p.category}
                  selected={p.id === selectedPlaceId}
                  onPress={() => openPlace(p.id)}
                />
              </MarkerView>
            ))
          : null}
      </MapView>

      {loadingPlaces ? (
        <View className="absolute inset-0 items-center justify-center bg-background/40">
          <ActivityIndicator size="large" />
        </View>
      ) : null}

      {/* Top chrome */}
      <View
        className="absolute left-0 right-0 px-3"
        style={{ paddingTop: insets.top + 8 }}
        pointerEvents="box-none"
      >
        <View className="flex-row items-center gap-2">
          {session ? (
            <Pressable
              onPress={() => {
                clearSession();
                setSelectedCategories(new Set());
                didInitialFly.current = false;
              }}
              className="h-11 w-11 items-center justify-center rounded-xl border border-border bg-card active:opacity-80"
            >
              <ChevronLeft size={22} color="#fff" />
            </Pressable>
          ) : null}
          <View className="min-w-0 flex-1 flex-row items-center rounded-2xl border border-border bg-card px-3 py-2.5 shadow-sm">
            <Search size={18} color="#9CA3AF" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search destinations, places…"
              placeholderTextColor="#9CA3AF"
              className="ml-2 flex-1 py-0 text-base text-foreground"
              returnKeyType="search"
            />
          </View>
          <Pressable className="h-11 w-11 items-center justify-center rounded-xl border border-border bg-card active:opacity-80">
            <SlidersHorizontal size={18} color="#fff" />
          </Pressable>
        </View>

        <View className="mt-2 rounded-2xl border border-border bg-card px-2 py-2 shadow-sm">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 12, alignItems: "center" }}
          >
            <Pressable
              onPress={recenterDestination}
              className="flex-row items-center gap-1.5 rounded-full bg-primary px-3 py-2"
            >
              <Navigation size={14} color="#fff" />
              <Text className="text-xs font-semibold text-primary-foreground">Area</Text>
            </Pressable>
            <Pressable
              onPress={clearCategoryFilter}
              className={`rounded-full border px-3 py-2 ${
                selectedCategories.size === 0
                  ? "border-primary bg-primary/20"
                  : "border-border bg-muted/80"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  selectedCategories.size === 0 ? "text-primary" : "text-muted-foreground"
                }`}
              >
                All
              </Text>
            </Pressable>
            {allCategories.map((cat) => {
              const inFilter = selectedCategories.has(cat);
              const active =
                selectedCategories.size === 0 ? false : inFilter;
              return (
                <Pressable
                  key={cat}
                  onPress={() => toggleCategory(cat)}
                  className={`rounded-full border px-3 py-2 ${
                    active ? "border-primary bg-primary/20" : "border-border bg-muted/80"
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}
                    numberOfLines={1}
                  >
                    {formatCategoryLabel(cat)}
                  </Text>
                </Pressable>
              );
            })}
            <View className="flex-row items-center gap-2 rounded-full border border-border bg-muted/80 px-3 py-1.5">
              <Text className="text-[10px] font-bold text-foreground">ITINERARY</Text>
              <Switch value={itineraryOnly} onValueChange={setItineraryOnly} />
            </View>
          </ScrollView>
        </View>

        <View className="mt-2 rounded-2xl border border-border bg-card px-2 py-2 shadow-sm">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, alignItems: "center" }}
          >
            <FilterChip
              label="4★+"
              active={minRating === 4}
              onPress={() => setMinRating((v) => (v === 4 ? null : 4))}
            />
            <FilterChip
              label="Curated"
              active={curatedOnly}
              onPress={() => setCuratedOnly((v) => !v)}
            />
            <FilterChip
              label="Open now"
              active={openNowOnly}
              onPress={() => setOpenNowOnly((v) => !v)}
            />
          </ScrollView>
        </View>
      </View>

      {/* Map controls */}
      <View
        className="absolute right-3 gap-2"
        style={{ top: insets.top + 168 }}
        pointerEvents="box-none"
      >
        <RoundMapButton onPress={recenterDestination} accessibilityLabel="Center on destination">
          <MapPin size={18} color="#fff" />
        </RoundMapButton>
        <RoundMapButton onPress={recenterUser} accessibilityLabel="My location">
          <Crosshair size={18} color="#fff" />
        </RoundMapButton>
        <View className="overflow-hidden rounded-2xl border border-border/80 bg-card/95">
          <Pressable
            onPress={() => onZoom(1)}
            accessibilityLabel="Zoom in"
            className="h-11 w-11 items-center justify-center bg-card/95 active:opacity-80"
          >
            <Plus size={18} color="#fff" />
          </Pressable>
          <View className="h-px bg-border" />
          <Pressable
            onPress={() => onZoom(-1)}
            accessibilityLabel="Zoom out"
            className="h-11 w-11 items-center justify-center bg-card/95 active:opacity-80"
          >
            <Minus size={18} color="#fff" />
          </Pressable>
        </View>
      </View>

      <BottomSheet
        ref={sheetRef}
        index={1}
        snapPoints={snapPoints}
        topInset={insets.top}
        bottomInset={tabBarHeight}
        enablePanDownToClose={false}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={{
          backgroundColor: colorScheme === "dark" ? THEME.dark.card : THEME.light.card,
        }}
        handleIndicatorStyle={{
          backgroundColor: colorScheme === "dark" ? THEME.dark.mutedForeground : THEME.light.mutedForeground,
        }}
      >
        {sheetMode === "list" ? (
          <BottomSheetFlatList
            data={filteredPlaces}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}
            ListHeaderComponent={
              <View className="pb-2">
                <Text className="text-lg font-bold text-foreground">Places</Text>
                <Text className="text-xs text-muted-foreground">
                  {filteredPlaces.length} shown · tap a row or a map pin for details
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <PlaceCard
                title={item.name}
                subtitle={item.description}
                rating={item.rating}
                imageUrl={item.imageUrl}
                metaRight={
                  <Text className="text-xs font-semibold" style={{ color: pinColorForCategory(item.category) }}>
                    {formatCategoryLabel(item.category)}
                  </Text>
                }
                onPress={() => openPlace(item.id)}
                endAction={
                  eligibleTrip && !itineraryPlaceIds.has(item.id) ? (
                    <Pressable
                      onPress={() => addPlaceToItinerary(item.id, item.name)}
                      hitSlop={8}
                      accessibilityLabel="Add to itinerary"
                      className="h-10 w-10 items-center justify-center rounded-xl bg-primary/15 active:opacity-80"
                    >
                      <Plus size={20} color={primaryIconColor} />
                    </Pressable>
                  ) : null
                }
              />
            )}
          />
        ) : (
          <BottomSheetScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: 16,
              flexGrow: 1,
            }}
          >
            <View className="mb-3 flex-row items-start justify-between">
              <Pressable
                onPress={closeDetail}
                className="flex-row items-center gap-1 rounded-lg py-1 active:opacity-80"
              >
                <ChevronLeft size={20} color="#A1A1AA" />
                <Text className="text-sm font-medium text-primary">List</Text>
              </Pressable>
              <Pressable onPress={closeDetail} hitSlop={12} accessibilityLabel="Close">
                <X size={22} color="#A1A1AA" />
              </Pressable>
            </View>
            {placeDetailQuery.isPending ? (
              <View className="items-center py-10">
                <ActivityIndicator />
              </View>
            ) : placeDetail ? (
              <View className="w-full gap-3">
                <View className="flex-row gap-3">
                  <View className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {detailHeroImageUrl ? (
                      <Image
                        source={{ uri: detailHeroImageUrl }}
                        style={{ width: 96, height: 96 }}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    ) : null}
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-xl font-bold text-foreground" numberOfLines={2}>
                      {placeDetail.name}
                    </Text>
                    <Text className="mt-1 text-xs font-semibold text-primary">
                      {formatCategoryLabel(placeDetail.category)}
                    </Text>
                    <View className="mt-2 flex-row flex-wrap items-center gap-2">
                      {placeDetail.rating != null ? (
                        <View className="flex-row items-center gap-1">
                          <Star size={14} color="#FBBF24" fill="#FBBF24" />
                          <Text className="text-sm text-foreground">{placeDetail.rating.toFixed(1)}</Text>
                          {placeDetail.reviewCount != null && placeDetail.reviewCount > 0 ? (
                            <Text className="text-sm text-muted-foreground">
                              ({approx(placeDetail.reviewCount)} reviews)
                            </Text>
                          ) : null}
                        </View>
                      ) : null}
                      {userCoord ? (
                        <Text className="text-sm text-muted-foreground">
                          ·{" "}
                          {distanceKm(
                            userCoord[1],
                            userCoord[0],
                            placeDetail.latitude,
                            placeDetail.longitude,
                          ).toFixed(1)}{" "}
                          km
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
                {placeDetail.description ? (
                  <Text className="text-sm leading-6 text-muted-foreground">{placeDetail.description}</Text>
                ) : null}
                <View className="gap-3 pb-1">
                  <Button
                    label="Open full place page"
                    variant="secondary"
                    onPress={() => {
                      if (selectedPlaceId) router.push(`/place/${selectedPlaceId}` as never);
                    }}
                  />
                  {eligibleTrip && !placeInItinerary ? (
                    <Button label="Add to itinerary" onPress={openAddToItinerary} className="w-full" />
                  ) : placeInItinerary ? (
                    <Text className="text-sm text-muted-foreground">Already in your itinerary.</Text>
                  ) : (
                    <Text className="text-sm text-muted-foreground">
                      Create or select a trip for this destination to add stops.
                    </Text>
                  )}
                </View>
              </View>
            ) : (
              <Text className="text-muted-foreground">Could not load this place.</Text>
            )}
          </BottomSheetScrollView>
        )}
      </BottomSheet>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full border px-3 py-2 ${
        active ? "border-primary bg-primary/20" : "border-border bg-muted/80"
      }`}
    >
      <Text className={`text-xs font-semibold ${active ? "text-primary" : "text-foreground"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function RoundMapButton({
  children,
  onPress,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      className="h-11 w-11 items-center justify-center rounded-2xl border border-border/80 bg-card/95 active:opacity-80"
    >
      {children}
    </Pressable>
  );
}
