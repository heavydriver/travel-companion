import { MapboxNavigationView } from "@badatgil/expo-mapbox-navigation";
import BottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFlatList,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import {
  Camera,
  CircleLayer,
  LineLayer,
  type MapState,
  MapView,
  MarkerView,
  ShapeSource,
  UserLocation,
} from "@rnmapbox/maps";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { approximateNumber as approx } from "approximate-number";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ArrowUpDown,
  Bike,
  CarFront,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Footprints,
  LocateFixed,
  Navigation,
  Plus,
  Route,
  Search,
  Star,
  X,
} from "lucide-react-native";
import { useColorScheme, useUnstableNativeVariable } from "nativewind";
import {
  type ElementRef,
  type ReactNode,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { client } from "@/api/client";
import { AddItineraryItemModal } from "@/components/shared/AddItineraryItemModal";
import { showAppToast } from "@/components/shared/AppToast";
import { Button } from "@/components/shared/Button";
import { KeyboardSheetModal } from "@/components/shared/KeyboardSheetModal";
import { PlaceCard } from "@/components/shared/PlaceCard";
import {
  findOfflinePackByPlaceId,
  getOfflinePlaceFromPack,
  useOfflinePackQuery,
} from "@/features/offline/pack";
import { useDebounce } from "@/hooks/useDebounce";
import { THEME } from "@/lib/theme";
import { formatDistanceFromKm } from "@/lib/units";
import { isTripPast } from "@/lib/utils";
import {
  createCurrentLocationNavigationPoint,
  MAX_MAP_NAVIGATION_WAYPOINTS,
  type MapNavigationDraft,
  type MapNavigationPoint,
  type MapNavigationRouteMode,
  useMapNavigationStore,
} from "@/store/mapNavigationStore";
import { type MapSessionPlace, useMapSessionStore } from "@/store/mapSessionStore";
import { useNetworkStore } from "@/store/networkStore";
import { usePreferencesStore } from "@/store/preferencesStore";
import { getEligibleTripForDestination, type Trip, useTripStore } from "@/store/tripStore";
import { pinColorForCategory } from "./categoryPinColor";
import { ensureMapboxToken } from "./ensureMapboxToken";
import { applyMapFilters, deriveCategories, type MapFilterControls } from "./filterMapPlaces";
import { MapPinMarker } from "./MapPinMarker";
import { fetchMapboxRoutePreview, type MapboxDirectionsProfile } from "./mapboxDirections";
import {
  createMapboxSearchSessionToken,
  fetchMapboxSearchSuggestions,
  formatMapboxPoiCategory,
  formatMapboxSearchSubtitle,
  type MapboxSearchBoxSuggestion,
  mapboxFeatureZoom,
  retrieveMapboxSearchFeature,
  reverseMapboxSearchByCoordinate,
} from "./mapboxSearchBox";
import { DARK_MAP_STYLE, LIGHT_MAP_STYLE } from "./mapStyles";

const MAP_PINS_SOURCE_ID = "travel-map-pins";
const MAP_PINS_HALO_LAYER_ID = "travel-map-pins-halo";
const MAP_PINS_LAYER_ID = "travel-map-pins-circle";

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

/** Fewer markers when zoomed out so the map stays responsive. */
function maxPinsForZoom(zoom: number): number {
  if (zoom <= 9) return 12;
  if (zoom <= 10) return 18;
  if (zoom <= 11) return 28;
  if (zoom <= 12) return 44;
  if (zoom <= 13) return 68;
  if (zoom <= 14) return 104;
  if (zoom <= 15) return 150;
  return 500;
}

/** Zoomed-out map: if filters are on, show every matching pin (no cap). */
const ZOOM_SHOW_ALL_FILTERED_BELOW = 11.75;

/** Pretend we are slightly zoomed in so caps ramp up a bit before the camera settles. */
const OPTIMISTIC_ZOOM_BIAS = 0.5;

function hasActiveMapFilters(f: MapFilterControls): boolean {
  if (f.search.trim().length > 0) return true;
  if (f.selectedCategories.size > 0) return true;
  if (f.minRating != null) return true;
  if (f.curatedOnly) return true;
  if (f.openNowOnly) return true;
  if (f.itineraryOnly) return true;
  return false;
}

/** Pin view scales with zoom (used while camera moves, not only on idle). */
function pinZoomScaleFromZoom(zoom: number): number {
  const t = (zoom - 9) / 7;
  return Math.min(1.62, Math.max(0.34, 0.34 + t * 1.12));
}

function withOpacity(hex: string, alpha: number): string {
  const normalized = hex.trim();
  const short = /^#([\da-fA-F]{3})$/;
  const full = /^#([\da-fA-F]{6})$/;

  if (short.test(normalized)) {
    const [, raw] = normalized.match(short) ?? [];
    if (!raw) return hex;
    const [r, g, b] = raw.split("");
    return `rgba(${Number.parseInt(r + r, 16)}, ${Number.parseInt(g + g, 16)}, ${Number.parseInt(b + b, 16)}, ${alpha})`;
  }

  if (full.test(normalized)) {
    const [, raw] = normalized.match(full) ?? [];
    if (!raw) return hex;
    return `rgba(${Number.parseInt(raw.slice(0, 2), 16)}, ${Number.parseInt(raw.slice(2, 4), 16)}, ${Number.parseInt(raw.slice(4, 6), 16)}, ${alpha})`;
  }

  return hex;
}

function brightenHex(hex: string, amount: number): string {
  const normalized = hex.trim();
  const full = /^#([\da-fA-F]{6})$/;
  const match = normalized.match(full);
  if (!match?.[1]) return hex;

  const raw = match[1];
  const brighten = (channel: string) => {
    const base = Number.parseInt(channel, 16);
    return Math.max(0, Math.min(255, Math.round(base + (255 - base) * amount)));
  };

  const r = brighten(raw.slice(0, 2));
  const g = brighten(raw.slice(2, 4));
  const b = brighten(raw.slice(4, 6));
  return `rgb(${r}, ${g}, ${b})`;
}

function buildMapPinShape(
  places: MapSessionPlace[],
  itineraryIds: Set<string>,
  opts?: { useBrightDarkModeColors?: boolean },
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: places.map((p) => ({
      type: "Feature",
      id: p.id,
      geometry: {
        type: "Point",
        coordinates: [p.longitude, p.latitude],
      },
      properties: {
        placeId: p.id,
        color: opts?.useBrightDarkModeColors
          ? brightenHex(pinColorForCategory(p.category), 0.22)
          : pinColorForCategory(p.category),
        priority: itineraryIds.has(p.id) ? 3 : p.isFeatured ? 2 : p.isCurated ? 1 : 0,
      },
    })),
  };
}

function selectPlacesForMapPins(
  places: MapSessionPlace[],
  opts: {
    zoom: number;
    centerLng: number;
    centerLat: number;
    selectedId: string | null;
    itineraryIds: Set<string>;
    filtersActive: boolean;
  },
): MapSessionPlace[] {
  if (opts.filtersActive && opts.zoom < ZOOM_SHOW_ALL_FILTERED_BELOW) {
    return places;
  }

  const max = maxPinsForZoom(opts.zoom + OPTIMISTIC_ZOOM_BIAS);
  if (places.length <= max) return places;

  const scored = places.map((p) => {
    const d = distanceKm(opts.centerLat, opts.centerLng, p.latitude, p.longitude);
    let score = -d * 5;
    if (p.id === opts.selectedId) score += 1_000_000;
    if (opts.itineraryIds.has(p.id)) score += 4000;
    if (p.isFeatured) score += 500;
    if (p.isCurated) score += 250;
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, max).map((r) => r.p);
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

/** Provisional map center so MapView can mount before GPS / Mapbox user location is ready. */
const MAP_BOOTSTRAP_CENTER = { lat: 37.7749, lng: -122.4194 };

function formatCategoryLabel(category: string): string {
  const t = category.trim();
  if (!t) return "Place";
  return t
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function normalizeSearchQuery(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeMatchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isSearchDetailFeatureType(featureType: string): boolean {
  return featureType === "poi" || featureType === "address";
}

function reverseResultPriority(featureType: string): number {
  switch (featureType) {
    case "poi":
      return 0;
    case "address":
      return 1;
    case "street":
      return 2;
    case "neighborhood":
    case "locality":
      return 3;
    case "place":
      return 4;
    default:
      return 5;
  }
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

type SearchSelection = {
  mapboxId: string;
  name: string;
  subtitle: string | null;
  coordinate: [number, number];
  featureType: string;
};

type ExternalSearchPlaceDetail = {
  mapboxId: string;
  name: string;
  subtitle: string | null;
  fullAddress: string | null;
  address: string | null;
  featureType: string;
  displayCategory: string | null;
  coordinate: [number, number];
};

function findMatchingSavedPlace(
  places: MapSessionPlace[],
  feature: { name: string; coordinate: [number, number] },
): MapSessionPlace | null {
  const featureName = normalizeMatchText(feature.name);
  let best: { place: MapSessionPlace; score: number } | null = null;

  for (const place of places) {
    const dist = distanceKm(
      feature.coordinate[1],
      feature.coordinate[0],
      place.latitude,
      place.longitude,
    );
    if (dist > 0.4) continue;

    const placeName = normalizeMatchText(place.name);
    const exactName = placeName === featureName;
    const partialName =
      placeName.includes(featureName) || featureName.includes(placeName) || exactName;
    if (!partialName && dist > 0.06) continue;

    const score = (partialName ? 100 : 0) - dist * 100 + (place.isFeatured ? 8 : 0);
    if (!best || score > best.score) {
      best = { place, score };
    }
  }

  return best?.place ?? null;
}

type NavigationFieldTarget =
  | { kind: "origin" }
  | { kind: "destination" }
  | { kind: "waypoint"; index: number };

function formatRouteDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

function routeProfileForMode(mode: MapNavigationRouteMode): MapboxDirectionsProfile {
  switch (mode) {
    case "walking":
      return "mapbox/walking";
    case "cycling":
      return "mapbox/cycling";
    default:
      return "mapbox/driving-traffic";
  }
}

function nativeNavigationProfileForMode(mode: MapNavigationRouteMode): string {
  const profile = routeProfileForMode(mode);
  return Platform.OS === "android" ? profile.replace("mapbox/", "") : profile;
}

function toNavigationPointFromSavedPlace(place: MapSessionPlace): MapNavigationPoint {
  return {
    id: `place-${place.id}`,
    label: place.name,
    subtitle: place.description,
    coordinate: [place.longitude, place.latitude],
    kind: "place",
  };
}

function toNavigationPointFromPlaceDetail(place: PlaceDetail): MapNavigationPoint {
  return {
    id: `place-${place.id}`,
    label: place.name,
    subtitle: place.address?.trim() || null,
    coordinate: [place.longitude, place.latitude],
    kind: "place",
  };
}

function toNavigationPointFromExternalPlace(place: ExternalSearchPlaceDetail): MapNavigationPoint {
  return {
    id: `external-${place.mapboxId}`,
    label: place.name,
    subtitle: place.fullAddress ?? place.address ?? place.subtitle,
    coordinate: place.coordinate,
    kind: place.featureType === "poi" ? "search" : "dropped_pin",
  };
}

function toNavigationPointFromSearchSuggestion(selection: SearchSelection): MapNavigationPoint {
  return {
    id: `search-${selection.mapboxId}`,
    label: selection.name,
    subtitle: selection.subtitle,
    coordinate: selection.coordinate,
    kind: "search",
  };
}

function resolveNavigationPointCoordinate(
  point: MapNavigationPoint | null,
  userCoord: [number, number] | null,
): [number, number] | null {
  if (!point) return null;
  if (point.usesLiveLocation) return userCoord;
  return point.coordinate;
}

export function InteractiveMapScreen() {
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const unitSystem = usePreferencesStore((s) => s.unitSystem);
  const isConnected = useNetworkStore((s) => s.isConnected);
  const hasInternetReachability = useNetworkStore((s) => s.isInternetReachable === true);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { colorScheme } = useColorScheme();
  const primaryParts = useUnstableNativeVariable("--primary");
  const primaryIconColor = primaryParts ? `hsl(${primaryParts})` : "#3B82F6";
  const session = useMapSessionStore((s) => s.session);
  const sessionRevision = useMapSessionStore((s) => s.sessionRevision);
  const clearSession = useMapSessionStore((s) => s.clearSession);
  const storeTrips = useTripStore((s) => s.trips);
  const navigationDraft = useMapNavigationStore((s) => s.draft);
  const navigationDraftRevision = useMapNavigationStore((s) => s.draftRevision);
  const setNavigationDraft = useMapNavigationStore((s) => s.setDraft);
  const updateNavigationDraft = useMapNavigationStore((s) => s.updateDraft);
  const clearNavigationDraft = useMapNavigationStore((s) => s.clearDraft);

  const [mapReady, setMapReady] = useState(false);
  const [tokenOk, setTokenOk] = useState(() => ensureMapboxToken());
  const [locPermission, setLocPermission] = useState<Location.PermissionStatus | null>(null);
  const [userCoord, setUserCoord] = useState<[number, number] | null>(null);
  /** Point used for /places/nearby only — must not follow every UserLocation tick or the query key changes forever. */
  const [nearbyAnchorCoord, setNearbyAnchorCoord] = useState<[number, number] | null>(null);
  const [mapZoom, setMapZoom] = useState(12);
  const [livePinZoom, setLivePinZoom] = useState(12);
  /** Map center for pin picking; only moves on idle (or explicit recenter) so pins do not reshuffle while panning. */
  const [pinStableCenter, setPinStableCenter] = useState<[number, number] | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [minRating, setMinRating] = useState<number | null>(null);
  const [curatedOnly, setCuratedOnly] = useState(false);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [itineraryOnly, setItineraryOnly] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [sheetMode, setSheetMode] = useState<"list" | "detail">("list");
  const [sheetIndex, setSheetIndex] = useState(2);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [nowTick, setNowTick] = useState(() => new Date());
  const [pickedDestination, setPickedDestination] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [searchSelection, setSearchSelection] = useState<SearchSelection | null>(null);
  const [selectedExternalPlace, setSelectedExternalPlace] =
    useState<ExternalSearchPlaceDetail | null>(null);
  const [pendingDropPinCoord, setPendingDropPinCoord] = useState<[number, number] | null>(null);
  const [inspectingLongPress, setInspectingLongPress] = useState(false);
  const [retrievingSuggestionId, setRetrievingSuggestionId] = useState<string | null>(null);
  const [activeTurnByTurn, setActiveTurnByTurn] = useState(false);
  const [editingNavigationField, setEditingNavigationField] =
    useState<NavigationFieldTarget | null>(null);
  const [navigationFieldQuery, setNavigationFieldQuery] = useState("");
  const [resolvingNavigationFieldId, setResolvingNavigationFieldId] = useState<string | null>(null);
  const [showAddItineraryModal, setShowAddItineraryModal] = useState(false);
  const [addModalPrefill, setAddModalPrefill] = useState<{ title: string; placeId: string | null } | null>(
    null,
  );

  const cameraRef = useRef<ElementRef<typeof Camera>>(null);
  const sheetRef = useRef<BottomSheet>(null);
  const appliedSessionRevisionRef = useRef(-1);
  const curatedSessionAppliedRef = useRef(-1);
  const centeredPickedDestinationRef = useRef<string | null>(null);
  const cameraIntentRef = useRef(0);
  const liveZoomFrameRef = useRef<number | null>(null);
  const pendingLiveZoomRef = useRef(12);
  const suppressSessionClearEffectsRef = useRef(false);
  const allowNextBeforeRemoveRef = useRef(false);
  const goToExploreOnNextBackRef = useRef(false);
  const mapboxSearchSessionRef = useRef(createMapboxSearchSessionToken());
  const inspectCoordinateRequestRef = useRef(0);
  const navigationFieldSessionRef = useRef(createMapboxSearchSessionToken());
  const handledNavigationDraftRevisionRef = useRef(-1);
  const lastFittedRouteKeyRef = useRef<string | null>(null);

  const searchDebounced = useDebounce(search, 320);
  const navigationFieldQueryDebounced = useDebounce(navigationFieldQuery, 260);
  const localeTag = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().locale?.split("-")[0] ?? "en",
    [],
  );
  const navigationPlannerVisible = Boolean(navigationDraft);
  const allowSearchBoxApi = !session && !pickedDestination;
  const normalizedSearch = useMemo(() => normalizeSearchQuery(search), [search]);
  const normalizedSelectedSearch = useMemo(
    () => (searchSelection ? normalizeSearchQuery(searchSelection.name) : ""),
    [searchSelection],
  );
  const placeSearch = allowSearchBoxApi ? "" : search;

  /** Destination whose places we load from the API (session or search pick). */
  const mapsPlacesSourceId = session?.destinationId ?? pickedDestination?.id ?? null;
  const browseNearbyMode = !mapsPlacesSourceId && !session;

  useEffect(() => {
    if (!session) return;
    setPickedDestination(null);
    setSearchSelection(null);
    setSelectedExternalPlace(null);
    setPendingDropPinCoord(null);
    setInspectingLongPress(false);
  }, [session]);

  useEffect(() => {
    if (session || pickedDestination) {
      goToExploreOnNextBackRef.current = false;
    }
  }, [session, pickedDestination]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: destination scope changes require resetting filters + pin anchor
  useEffect(() => {
    setSelectedCategories(new Set());
    setPinStableCenter(null);
  }, [mapsPlacesSourceId, session?.destinationId, pickedDestination?.id]);

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

  const anchorSeedDoneRef = useRef(false);

  useEffect(() => {
    if (locPermission !== "granted") {
      setNearbyAnchorCoord(null);
      anchorSeedDoneRef.current = false;
    }
  }, [locPermission]);

  /** Seed nearby anchor once from Mapbox user location if GPS path has not set it yet (no dependency churn on userCoord). */
  useEffect(() => {
    if (session || mapsPlacesSourceId || locPermission !== "granted" || !userCoord) return;
    if (nearbyAnchorCoord) return;
    if (anchorSeedDoneRef.current) return;
    anchorSeedDoneRef.current = true;
    setNearbyAnchorCoord(userCoord);
  }, [session, mapsPlacesSourceId, locPermission, userCoord, nearbyAnchorCoord]);

  const nearbyQueryKey = useMemo(() => {
    if (!nearbyAnchorCoord) return null;
    const [lng, lat] = nearbyAnchorCoord;
    return [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5] as const;
  }, [nearbyAnchorCoord]);
  const searchProximity = useMemo(
    () => searchSelection?.coordinate ?? nearbyAnchorCoord ?? userCoord,
    [searchSelection, nearbyAnchorCoord, userCoord],
  );

  const destinationQuery = useQuery({
    queryKey: ["destination-details", mapsPlacesSourceId],
    queryFn: async () => {
      if (!mapsPlacesSourceId) throw new Error("No destination");
      const res = await client.api.v1.destinations({ destId: mapsPlacesSourceId }).get();
      if (res.error) throw new Error("Failed to load destination");
      return res.data;
    },
    enabled: Boolean(mapsPlacesSourceId),
    staleTime: 5 * 60 * 1000,
  });

  const placesQuery = useQuery({
    queryKey: ["map-destination-places", mapsPlacesSourceId],
    queryFn: async () => {
      if (!mapsPlacesSourceId) throw new Error("No destination");
      const res = await client.api.v1.destinations({ destId: mapsPlacesSourceId }).places.get();
      if (res.error) throw new Error("Failed to load places");
      return res.data;
    },
    enabled: Boolean(mapsPlacesSourceId && (!session || session.places.length === 0)),
    staleTime: 2 * 60 * 1000,
  });

  const nearbyPlacesQuery = useQuery({
    queryKey: ["map-nearby-places", nearbyQueryKey?.[0], nearbyQueryKey?.[1]],
    queryFn: async () => {
      if (!nearbyAnchorCoord) throw new Error("No location");
      const [lng, lat] = nearbyAnchorCoord;
      const res = await client.api.v1.places.nearby.get({
        query: { lat, lng, radiusKm: 35, limit: 80 },
      });
      if (res.error) throw new Error("Failed to load nearby places");
      return res.data;
    },
    enabled: Boolean(
      isFocused &&
        locPermission === "granted" &&
        nearbyAnchorCoord &&
        !mapsPlacesSourceId &&
        !session,
    ),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  const mapboxSuggestQuery = useQuery({
    queryKey: [
      "mapbox-search-suggest",
      searchDebounced,
      searchProximity?.[0],
      searchProximity?.[1],
    ],
    queryFn: async () => {
      return fetchMapboxSearchSuggestions({
        query: searchDebounced,
        sessionToken: mapboxSearchSessionRef.current,
        proximity: searchProximity,
        language: localeTag,
        limit: 6,
      });
    },
    enabled:
      tokenOk &&
      allowSearchBoxApi &&
      searchDebounced.trim().length >= 2 &&
      normalizeSearchQuery(searchDebounced) !== normalizedSelectedSearch,
    staleTime: 30 * 1000,
  });

  const destinationTimezone = useMemo(() => {
    if (session?.timezone) return session.timezone;
    const d = destinationQuery.data?.destination as { timezone?: string } | undefined;
    return d?.timezone?.trim() ?? null;
  }, [session?.timezone, destinationQuery.data]);

  const basePlaces = useMemo((): MapSessionPlace[] => {
    if (session && session.places.length > 0) return session.places;
    const fromDest = (placesQuery.data?.places ?? []) as ApiPlaceRow[];
    if (fromDest.length > 0) return fromDest.map((p) => normalizeListPlace(p));
    const fromNearby = (nearbyPlacesQuery.data?.places ?? []) as ApiPlaceRow[];
    return fromNearby.map((p) => normalizeListPlace(p));
  }, [session, placesQuery.data, nearbyPlacesQuery.data]);

  const selectedPlaceForScope = useMemo(
    () => (selectedPlaceId ? (basePlaces.find((p) => p.id === selectedPlaceId) ?? null) : null),
    [basePlaces, selectedPlaceId],
  );

  const tripDestinationScopeId = useMemo(
    () =>
      session?.destinationId ??
      pickedDestination?.id ??
      selectedPlaceForScope?.destinationId ??
      null,
    [session?.destinationId, pickedDestination?.id, selectedPlaceForScope?.destinationId],
  );

  const tripsQuery = useQuery({
    queryKey: ["trips", "destination", tripDestinationScopeId],
    queryFn: async () => {
      if (!tripDestinationScopeId) throw new Error("No destination");
      const res = await client.api.v1.trips.get({
        query: { destinationId: tripDestinationScopeId },
      });
      if (res.error) throw new Error("Failed to load trips");
      return res.data;
    },
    enabled: Boolean(tripDestinationScopeId),
    staleTime: 60 * 1000,
  });

  const eligibleTrip = useMemo(() => {
    if (!tripDestinationScopeId) return undefined;
    const fromApi = (tripsQuery.data?.trips ?? []) as Trip[];
    const list = tripsQuery.isSuccess
      ? fromApi
      : storeTrips.filter((t) => t.destination.id === tripDestinationScopeId);
    return getEligibleTripForDestination(list, tripDestinationScopeId);
  }, [tripDestinationScopeId, tripsQuery.data, tripsQuery.isSuccess, storeTrips]);
  const offlineScopePackQuery = useOfflinePackQuery(tripDestinationScopeId);

  const activeNearbyTrips = useMemo(
    () => storeTrips.filter((trip) => !isTripPast(trip.endDate)),
    [storeTrips],
  );

  const nearbyItineraryQueries = useQueries({
    queries: activeNearbyTrips.map((trip) => ({
      queryKey: ["itinerary", trip.id],
      queryFn: async () => {
        const res = await client.api.v1.trips({ tripId: trip.id })["itinerary-items"].get();
        if (res.error) throw new Error("Failed to load itinerary");
        return res.data;
      },
      enabled: browseNearbyMode,
      staleTime: 30 * 1000,
    })),
  });

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
    if (browseNearbyMode) {
      for (const query of nearbyItineraryQueries) {
        for (const it of (query.data?.items ?? []) as { placeId: string | null }[]) {
          if (it.placeId) ids.add(it.placeId);
        }
      }
      return ids;
    }

    for (const it of (itineraryQuery.data?.items ?? []) as { placeId: string | null }[]) {
      if (it.placeId) ids.add(it.placeId);
    }
    return ids;
  }, [browseNearbyMode, itineraryQuery.data, nearbyItineraryQueries]);

  const destCenter = useMemo(() => {
    if (session) return { lat: session.latitude, lng: session.longitude };
    const d = destinationQuery.data?.destination as
      | { latitude: number; longitude: number }
      | undefined;
    if (pickedDestination && d) return { lat: d.latitude, lng: d.longitude };
    if (pickedDestination && userCoord) return { lat: userCoord[1], lng: userCoord[0] };
    if (d) return { lat: d.latitude, lng: d.longitude };
    if (userCoord) return { lat: userCoord[1], lng: userCoord[0] };
    return null;
  }, [session, pickedDestination, destinationQuery.data, userCoord]);

  const destCenterRef = useRef(destCenter);
  destCenterRef.current = destCenter;

  const showPlaceList = useCallback((nextIndex = 2) => {
    setSelectedPlaceId(null);
    setSelectedExternalPlace(null);
    setPendingDropPinCoord(null);
    setInspectingLongPress(false);
    setSheetMode("list");
    requestAnimationFrame(() => {
      sheetRef.current?.snapToIndex(nextIndex);
    });
  }, []);

  const showPlaceDetail = useCallback((id: string, nextIndex = 1) => {
    setSelectedExternalPlace(null);
    setPendingDropPinCoord(null);
    setInspectingLongPress(false);
    setSelectedPlaceId(id);
    setSheetMode("detail");
    requestAnimationFrame(() => {
      sheetRef.current?.snapToIndex(nextIndex);
    });
  }, []);

  const showExternalPlaceDetail = useCallback((place: ExternalSearchPlaceDetail, nextIndex = 1) => {
    setSelectedPlaceId(null);
    setSelectedExternalPlace(place);
    setPendingDropPinCoord(null);
    setInspectingLongPress(false);
    setSheetMode("detail");
    requestAnimationFrame(() => {
      sheetRef.current?.snapToIndex(nextIndex);
    });
  }, []);

  const nextCameraIntent = useCallback(() => {
    cameraIntentRef.current += 1;
    return cameraIntentRef.current;
  }, []);

  const moveCamera = useCallback(
    (coord: [number, number], zoom: number, animationDuration: number) => {
      setPinStableCenter(coord);
      setMapZoom(zoom);
      setLivePinZoom(zoom);
      cameraRef.current?.setCamera({
        centerCoordinate: coord,
        zoomLevel: zoom,
        heading: 0,
        pitch: 0,
        animationDuration,
      });
    },
    [],
  );

  const syncNearbyAnchor = useCallback(
    (coord: [number, number], opts?: { forceNearbyAnchor?: boolean }) => {
      setNearbyAnchorCoord((prev) => {
        if (opts?.forceNearbyAnchor) return coord;
        if (!prev) return coord;
        const movedKm = distanceKm(prev[1], prev[0], coord[1], coord[0]);
        return movedKm >= 0.5 ? coord : prev;
      });
    },
    [],
  );

  /** Real coords when available; otherwise a fixed point so MapView can load (unblocks mapReady → flyToUser). */
  const mapCoreCenter = useMemo(() => {
    if (destCenter) return destCenter;
    if (locPermission === "granted") return MAP_BOOTSTRAP_CENTER;
    return null;
  }, [destCenter, locPermission]);

  useEffect(() => {
    if (mapCoreCenter) {
      setPinStableCenter((prev) => prev ?? [mapCoreCenter.lng, mapCoreCenter.lat]);
    }
  }, [mapCoreCenter]);

  useEffect(() => {
    if (!session?.startWithCuratedPlacesOnly) return;
    if (sessionRevision <= curatedSessionAppliedRef.current) return;
    curatedSessionAppliedRef.current = sessionRevision;
    setCuratedOnly(true);
  }, [session?.startWithCuratedPlacesOnly, sessionRevision]);

  const flyToUser = useCallback(
    (opts?: { forceNearbyAnchor?: boolean }) => {
      if (locPermission === null) return;
      if (locPermission === "granted") {
        const intentId = nextCameraIntent();
        let movedToKnownCoord = false;

        const applyUserCoord = (coord: [number, number], animationDuration: number) => {
          if (intentId !== cameraIntentRef.current) return;
          movedToKnownCoord = true;
          setUserCoord(coord);
          syncNearbyAnchor(coord, opts);
          moveCamera(coord, 15, animationDuration);
        };

        if (userCoord) {
          applyUserCoord(userCoord, 250);
        } else {
          void Location.getLastKnownPositionAsync()
            .then((pos) => {
              if (!pos?.coords) return;
              applyUserCoord([pos.coords.longitude, pos.coords.latitude], 240);
            })
            .catch(() => {});
        }

        void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          .then((pos) => {
            applyUserCoord(
              [pos.coords.longitude, pos.coords.latitude],
              movedToKnownCoord ? 260 : 420,
            );
          })
          .catch(() => {
            if (movedToKnownCoord || intentId !== cameraIntentRef.current) return;
            const c = destCenterRef.current ?? MAP_BOOTSTRAP_CENTER;
            moveCamera([c.lng, c.lat], 12, 350);
          });
        return;
      }
      const c = destCenterRef.current;
      if (!c) return;
      nextCameraIntent();
      moveCamera([c.lng, c.lat], 12, 350);
    },
    [locPermission, moveCamera, nextCameraIntent, syncNearbyAnchor, userCoord],
  );

  const flyToUserRef = useRef(flyToUser);
  flyToUserRef.current = flyToUser;

  /** Deep link / “See map” — center on destination or focused place. */
  useEffect(() => {
    if (!mapReady || locPermission === null) return;
    if (!session) return;
    if (sessionRevision <= appliedSessionRevisionRef.current) return;
    appliedSessionRevisionRef.current = sessionRevision;

    const lng = session.focusLongitude ?? session.longitude;
    const lat = session.focusLatitude ?? session.latitude;
    const zoom =
      session.focusZoomLevel ??
      (session.focusLongitude != null && session.focusLatitude != null ? 15 : 12);

    nextCameraIntent();
    moveCamera([lng, lat], zoom, 450);

    if (session.focusPlaceId) {
      showPlaceDetail(session.focusPlaceId, 1);
      return;
    }

    showPlaceList(2);
  }, [
    locPermission,
    mapReady,
    moveCamera,
    nextCameraIntent,
    session,
    sessionRevision,
    showPlaceDetail,
    showPlaceList,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (session) return;
      if (locPermission === null) return;
      flyToUserRef.current();
    }, [session, locPermission]),
  );

  const hadSessionRef = useRef(false);
  useEffect(() => {
    if (session) {
      hadSessionRef.current = true;
      return;
    }
    if (!hadSessionRef.current) return;
    hadSessionRef.current = false;
    if (suppressSessionClearEffectsRef.current) {
      suppressSessionClearEffectsRef.current = false;
      return;
    }
    if (locPermission === null) return;
    flyToUserRef.current();
  }, [session, locPermission]);

  useEffect(() => {
    return () => {
      if (liveZoomFrameRef.current != null) {
        cancelAnimationFrame(liveZoomFrameRef.current);
      }
    };
  }, []);

  const allCategories = useMemo(() => deriveCategories(basePlaces), [basePlaces]);

  const filterPayload: MapFilterControls = useMemo(
    () => ({
      search: placeSearch,
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
      placeSearch,
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

  const filtersActive = useMemo(() => hasActiveMapFilters(filterPayload), [filterPayload]);

  const orderedPlaces = useMemo(() => {
    const sortCoord = nearbyAnchorCoord ?? userCoord;
    if (session || pickedDestination || !sortCoord) return filteredPlaces;
    const [lng, lat] = sortCoord;
    return [...filteredPlaces].sort(
      (a, b) =>
        distanceKm(lat, lng, a.latitude, a.longitude) -
        distanceKm(lat, lng, b.latitude, b.longitude),
    );
  }, [filteredPlaces, nearbyAnchorCoord, session, pickedDestination, userCoord]);

  const pinsToRender = useMemo(() => {
    if (!destCenter) return filteredPlaces;
    const [lng, lat] = pinStableCenter ?? [destCenter.lng, destCenter.lat];
    return selectPlacesForMapPins(filteredPlaces, {
      zoom: mapZoom,
      centerLng: lng,
      centerLat: lat,
      selectedId: selectedPlaceId,
      itineraryIds: itineraryPlaceIds,
      filtersActive,
    });
  }, [
    filteredPlaces,
    mapZoom,
    pinStableCenter,
    destCenter,
    selectedPlaceId,
    itineraryPlaceIds,
    filtersActive,
  ]);

  const nativePinsShape = useMemo(() => {
    const unselectedPins =
      selectedPlaceId == null ? pinsToRender : pinsToRender.filter((p) => p.id !== selectedPlaceId);
    return buildMapPinShape(unselectedPins, itineraryPlaceIds, {
      useBrightDarkModeColors: colorScheme === "dark",
    });
  }, [colorScheme, itineraryPlaceIds, pinsToRender, selectedPlaceId]);

  const selectedPlace = useMemo(() => {
    const fromOrdered = orderedPlaces.find((p) => p.id === selectedPlaceId) ?? null;
    if (fromOrdered) return fromOrdered;
    if (!selectedPlaceId) return null;
    return basePlaces.find((p) => p.id === selectedPlaceId) ?? null;
  }, [orderedPlaces, basePlaces, selectedPlaceId]);

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
  const offlinePlacePackQuery = useQuery({
    queryKey: ["offline-place-pack", selectedPlaceId],
    queryFn: async () => {
      if (!selectedPlaceId) return null;
      return findOfflinePackByPlaceId(selectedPlaceId);
    },
    enabled: Boolean(selectedPlaceId && sheetMode === "detail"),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const offlinePlaceDetail = useMemo(
    () =>
      selectedPlaceId
        ? ((getOfflinePlaceFromPack(
            offlinePlacePackQuery.data,
            selectedPlaceId,
          ) as PlaceDetail | null) ?? null)
        : null,
    [offlinePlacePackQuery.data, selectedPlaceId],
  );
  const placeDetail =
    (!isConnected ? offlinePlaceDetail : null) ??
    (placeDetailQuery.data?.place as PlaceDetail | undefined) ??
    offlinePlaceDetail ??
    undefined;
  const detailHeroImageUrl = placeDetail?.imageUrl ?? selectedPlace?.imageUrl ?? null;
  const placeInItinerary = Boolean(selectedPlaceId && itineraryPlaceIds.has(selectedPlaceId));
  const selectedSavedPlaceFromSearch = useMemo(
    () =>
      searchSelection
        ? findMatchingSavedPlace(basePlaces, {
            name: searchSelection.name,
            coordinate: searchSelection.coordinate,
          })
        : null,
    [basePlaces, searchSelection],
  );
  const activeNavigationDestination = useMemo(() => {
    if (placeDetail) return toNavigationPointFromPlaceDetail(placeDetail);
    if (selectedExternalPlace) return toNavigationPointFromExternalPlace(selectedExternalPlace);
    if (selectedPlace) return toNavigationPointFromSavedPlace(selectedPlace);
    if (searchSelection) return toNavigationPointFromSearchSuggestion(searchSelection);
    return null;
  }, [placeDetail, searchSelection, selectedExternalPlace, selectedPlace]);

  const effectiveNavigationOriginCoord = useMemo(
    () => resolveNavigationPointCoordinate(navigationDraft?.origin ?? null, userCoord),
    [navigationDraft?.origin, userCoord],
  );

  const effectiveNavigationWaypointCoords = useMemo(
    () =>
      (navigationDraft?.waypoints ?? [])
        .map((point) => resolveNavigationPointCoordinate(point, userCoord))
        .filter((point): point is [number, number] => point != null),
    [navigationDraft?.waypoints, userCoord],
  );

  const effectiveNavigationDestinationCoord = useMemo(
    () => resolveNavigationPointCoordinate(navigationDraft?.destination ?? null, userCoord),
    [navigationDraft?.destination, userCoord],
  );

  const routePreviewCoordinates = useMemo(() => {
    if (!effectiveNavigationOriginCoord || !effectiveNavigationDestinationCoord) return [];
    return [
      effectiveNavigationOriginCoord,
      ...effectiveNavigationWaypointCoords,
      effectiveNavigationDestinationCoord,
    ];
  }, [
    effectiveNavigationDestinationCoord,
    effectiveNavigationOriginCoord,
    effectiveNavigationWaypointCoords,
  ]);

  const routePreviewKey = useMemo(
    () =>
      routePreviewCoordinates
        .map((point) => `${point[0].toFixed(4)},${point[1].toFixed(4)}`)
        .join(";"),
    [routePreviewCoordinates],
  );

  const navigationFieldSuggestionsQuery = useQuery({
    queryKey: [
      "mapbox-navigation-field-suggest",
      editingNavigationField?.kind,
      editingNavigationField?.kind === "waypoint" ? editingNavigationField.index : null,
      navigationFieldQueryDebounced,
      userCoord?.[0],
      userCoord?.[1],
    ],
    queryFn: async () =>
      fetchMapboxSearchSuggestions({
        query: navigationFieldQueryDebounced,
        sessionToken: navigationFieldSessionRef.current,
        proximity: userCoord,
        language: localeTag,
        limit: 6,
      }),
    enabled: Boolean(editingNavigationField && navigationFieldQueryDebounced.trim().length >= 2),
    staleTime: 30 * 1000,
  });

  const routePreviewQuery = useQuery({
    queryKey: [
      "mapbox-route-preview",
      navigationDraft?.mode,
      routePreviewKey,
      localeTag,
      navigationPlannerVisible,
    ],
    queryFn: async ({ signal }) =>
      fetchMapboxRoutePreview({
        coordinates: routePreviewCoordinates,
        profile: routeProfileForMode(navigationDraft?.mode ?? "driving"),
        language: localeTag,
        signal,
      }),
    enabled: Boolean(navigationPlannerVisible && routePreviewCoordinates.length >= 2),
    staleTime: 60 * 1000,
  });

  const detailOwnerDestinationQuery = useQuery({
    queryKey: ["destination-details", placeDetail?.destinationId],
    queryFn: async () => {
      if (!placeDetail?.destinationId) throw new Error("No destination");
      const res = await client.api.v1.destinations({ destId: placeDetail.destinationId }).get();
      if (res.error) throw new Error("Failed to load destination");
      return res.data;
    },
    enabled: Boolean(
      placeDetail?.destinationId &&
        sheetMode === "detail" &&
        placeDetail.destinationId !== mapsPlacesSourceId,
    ),
    staleTime: 5 * 60 * 1000,
  });

  const createTripPrefill = useMemo(() => {
    if (!placeDetail?.destinationId || eligibleTrip) return null;
    const fromMain = destinationQuery.data?.destination as
      | { name: string; country: string }
      | undefined;
    if (mapsPlacesSourceId === placeDetail.destinationId && fromMain) {
      return {
        destinationId: placeDetail.destinationId,
        destinationName: fromMain.name,
        destinationCountry: fromMain.country,
      };
    }
    const fromExtra = detailOwnerDestinationQuery.data?.destination as
      | { name: string; country: string }
      | undefined;
    if (!fromExtra) return null;
    return {
      destinationId: placeDetail.destinationId,
      destinationName: fromExtra.name,
      destinationCountry: fromExtra.country,
    };
  }, [
    placeDetail?.destinationId,
    eligibleTrip,
    destinationQuery.data,
    mapsPlacesSourceId,
    detailOwnerDestinationQuery.data,
  ]);
  const navigationFieldSuggestions = useMemo(
    () => (navigationFieldSuggestionsQuery.data ?? []) as MapboxSearchBoxSuggestion[],
    [navigationFieldSuggestionsQuery.data],
  );
  const routePreview = routePreviewQuery.data ?? null;
  const routePreviewShape = useMemo(() => {
    if (!routePreview) return null;
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: routePreview.geometry,
          properties: {},
        },
      ],
    } as GeoJSON.FeatureCollection<GeoJSON.LineString>;
  }, [routePreview]);
  const turnByTurnCoordinates = useMemo(
    () =>
      routePreviewCoordinates.map((point) => ({
        latitude: point[1],
        longitude: point[0],
      })),
    [routePreviewCoordinates],
  );
  const routeSummaryBackgroundColor =
    colorScheme === "dark" ? THEME.dark.background : THEME.light.background;
  const navigationTripProgressTextColor =
    colorScheme === "dark" ? THEME.dark.foreground : THEME.light.foreground;
  const navigationTripProgressSecondaryTextColor =
    colorScheme === "dark" ? THEME.dark.mutedForeground : THEME.light.mutedForeground;
  const plannerModeLabel =
    navigationDraft?.mode === "walking"
      ? "Walk"
      : navigationDraft?.mode === "cycling"
        ? "Cycle"
        : "Drive";

  const snapPoints = useMemo(() => ["8%", "30%", "45%", "88%"], []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={2} appearsOnIndex={3} opacity={0.32} />
    ),
    [],
  );

  const onSheetChange = useCallback((index: number) => {
    startTransition(() => {
      setSheetIndex((prev) => (prev === index ? prev : index));
    });
  }, []);

  const openPlace = useCallback(
    (id: string) => {
      const p =
        orderedPlaces.find((x) => x.id === id) ?? basePlaces.find((x) => x.id === id) ?? null;
      if (p) {
        nextCameraIntent();
        moveCamera([p.longitude, p.latitude], Math.max(mapZoom, 14), 380);
      }
      showPlaceDetail(id, 1);
    },
    [orderedPlaces, basePlaces, mapZoom, moveCamera, nextCameraIntent, showPlaceDetail],
  );

  const inspectCoordinate = useCallback(
    async (coord: [number, number]) => {
      inspectCoordinateRequestRef.current += 1;
      const requestId = inspectCoordinateRequestRef.current;
      setPendingDropPinCoord(coord);
      setInspectingLongPress(true);
      setSelectedPlaceId(null);
      setSelectedExternalPlace(null);
      setSheetMode("detail");
      requestAnimationFrame(() => {
        sheetRef.current?.snapToIndex(1);
      });

      nextCameraIntent();
      moveCamera(coord, Math.max(mapZoom, 15), 260);

      try {
        const results = await reverseMapboxSearchByCoordinate({
          coordinate: coord,
          language: localeTag,
          limit: 5,
        });

        const rankedResults = [...results].sort(
          (a, b) => reverseResultPriority(a.featureType) - reverseResultPriority(b.featureType),
        );

        for (const feature of rankedResults) {
          if (requestId !== inspectCoordinateRequestRef.current) return;
          const matchedPlace = findMatchingSavedPlace(basePlaces, {
            name: feature.name,
            coordinate: coord,
          });
          if (matchedPlace) {
            openPlace(matchedPlace.id);
            return;
          }
        }

        const feature = rankedResults[0];
        if (requestId !== inspectCoordinateRequestRef.current) return;
        if (!feature) {
          showExternalPlaceDetail({
            mapboxId: `dropped-pin-${coord[0]}-${coord[1]}`,
            name: "Dropped pin",
            subtitle: null,
            fullAddress: null,
            address: null,
            featureType: "poi",
            displayCategory: "Dropped Pin",
            coordinate: coord,
          });
          return;
        }

        showExternalPlaceDetail({
          mapboxId: feature.mapboxId,
          name: feature.name,
          subtitle: formatMapboxSearchSubtitle(feature),
          fullAddress: feature.fullAddress,
          address: feature.address ?? feature.placeFormatted,
          featureType: feature.featureType,
          displayCategory: feature.poiCategory ?? formatMapboxPoiCategory(feature.featureType),
          coordinate: coord,
        });
      } catch {
        if (requestId !== inspectCoordinateRequestRef.current) return;
        showExternalPlaceDetail({
          mapboxId: `dropped-pin-${coord[0]}-${coord[1]}`,
          name: "Dropped pin",
          subtitle: null,
          fullAddress: null,
          address: null,
          featureType: "poi",
          displayCategory: "Dropped Pin",
          coordinate: coord,
        });
      }
    },
    [
      basePlaces,
      localeTag,
      mapZoom,
      moveCamera,
      nextCameraIntent,
      openPlace,
      showExternalPlaceDetail,
    ],
  );

  useEffect(() => {
    if (!selectedExternalPlace || !selectedSavedPlaceFromSearch) return;
    if (!searchSelection) return;
    if (selectedSavedPlaceFromSearch.id === selectedPlaceId) return;
    openPlace(selectedSavedPlaceFromSearch.id);
  }, [
    openPlace,
    searchSelection,
    selectedExternalPlace,
    selectedPlaceId,
    selectedSavedPlaceFromSearch,
  ]);

  useEffect(() => {
    if (!navigationDraft) {
      handledNavigationDraftRevisionRef.current = -1;
      return;
    }
    if (navigationDraftRevision <= handledNavigationDraftRevisionRef.current) return;
    handledNavigationDraftRevisionRef.current = navigationDraftRevision;
    requestAnimationFrame(() => {
      sheetRef.current?.snapToIndex(1);
    });
    if (!navigationDraft.autoOpenPlanner) return;
    updateNavigationDraft((draft) => (draft ? { ...draft, autoOpenPlanner: false } : draft));
  }, [navigationDraft, navigationDraftRevision, updateNavigationDraft]);

  useEffect(() => {
    if (!navigationPlannerVisible || !routePreview || routePreviewCoordinates.length < 2) return;
    const fitKey = `${navigationDraftRevision}:${navigationDraft?.mode ?? "driving"}:${routePreviewKey}`;
    if (lastFittedRouteKeyRef.current === fitKey) return;
    lastFittedRouteKeyRef.current = fitKey;

    const lngs = routePreviewCoordinates.map((point) => point[0]);
    const lats = routePreviewCoordinates.map((point) => point[1]);
    const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
    const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
    const topPadding = navigationPlannerVisible ? 164 : 220;
    const bottomPadding = tabBarHeight + (navigationPlannerVisible ? 280 : 260);

    requestAnimationFrame(() => {
      cameraRef.current?.fitBounds(ne, sw, [topPadding, 36, bottomPadding, 36], 420);
    });
  }, [
    navigationDraft?.mode,
    navigationDraftRevision,
    navigationPlannerVisible,
    routePreview,
    routePreviewCoordinates,
    routePreviewKey,
    tabBarHeight,
  ]);

  const closeDetail = useCallback(() => {
    showPlaceList(2);
  }, [showPlaceList]);

  const closeNavigationPlanner = useCallback(() => {
    setEditingNavigationField(null);
    setNavigationFieldQuery("");
    setResolvingNavigationFieldId(null);
    clearNavigationDraft();
  }, [clearNavigationDraft]);

  const openNavigationPlanner = useCallback(
    (destinationOverride?: MapNavigationPoint | null) => {
      const destination = destinationOverride ?? activeNavigationDestination;
      const nextDraft: MapNavigationDraft = {
        origin: navigationDraft?.origin ?? createCurrentLocationNavigationPoint(),
        destination: destination ?? navigationDraft?.destination ?? null,
        waypoints: navigationDraft?.waypoints ?? [],
        mode: navigationDraft?.mode ?? "driving",
        autoOpenPlanner: true,
      };
      setNavigationDraft(nextDraft);
    },
    [activeNavigationDestination, navigationDraft, setNavigationDraft],
  );

  const openNavigationFieldPicker = useCallback((target: NavigationFieldTarget) => {
    setEditingNavigationField(target);
    setNavigationFieldQuery("");
    setResolvingNavigationFieldId(null);
    navigationFieldSessionRef.current = createMapboxSearchSessionToken();
  }, []);

  const applyNavigationFieldPoint = useCallback(
    (target: NavigationFieldTarget, point: MapNavigationPoint) => {
      updateNavigationDraft((draft) => {
        if (!draft) return draft;
        if (target.kind === "origin") return { ...draft, origin: point };
        if (target.kind === "destination") return { ...draft, destination: point };
        const nextWaypoints = [...draft.waypoints];
        nextWaypoints[target.index] = point;
        return { ...draft, waypoints: nextWaypoints };
      });
    },
    [updateNavigationDraft],
  );

  const removeNavigationWaypoint = useCallback(
    (index: number) => {
      updateNavigationDraft((draft) => {
        if (!draft) return draft;
        return {
          ...draft,
          waypoints: draft.waypoints.filter((_, waypointIndex) => waypointIndex !== index),
        };
      });
    },
    [updateNavigationDraft],
  );

  const addNavigationWaypoint = useCallback(() => {
    updateNavigationDraft((draft) => {
      if (!draft || draft.waypoints.length >= MAX_MAP_NAVIGATION_WAYPOINTS) return draft;
      return {
        ...draft,
        waypoints: [
          ...draft.waypoints,
          {
            id: `waypoint-${draft.waypoints.length + 1}`,
            label: "Choose a stop",
            subtitle: null,
            coordinate: null,
            kind: "waypoint",
          },
        ],
      };
    });
  }, [updateNavigationDraft]);

  const swapNavigationEndpoints = useCallback(() => {
    updateNavigationDraft((draft) => {
      if (!draft) return draft;
      return {
        ...draft,
        origin: draft.destination,
        destination: draft.origin,
      };
    });
  }, [updateNavigationDraft]);

  const setNavigationRouteMode = useCallback(
    (mode: MapNavigationRouteMode) => {
      updateNavigationDraft((draft) => (draft ? { ...draft, mode } : draft));
    },
    [updateNavigationDraft],
  );

  const useCurrentLocationForOrigin = useCallback(() => {
    applyNavigationFieldPoint({ kind: "origin" }, createCurrentLocationNavigationPoint());
    setEditingNavigationField(null);
    setNavigationFieldQuery("");
  }, [applyNavigationFieldPoint]);

  const selectNavigationSuggestion = useCallback(
    async (suggestion: MapboxSearchBoxSuggestion) => {
      if (!editingNavigationField) return;
      setResolvingNavigationFieldId(suggestion.mapboxId);
      try {
        const feature = await retrieveMapboxSearchFeature({
          mapboxId: suggestion.mapboxId,
          sessionToken: navigationFieldSessionRef.current,
          language: localeTag,
        });
        if (!feature) {
          throw new Error("Could not load that location");
        }
        applyNavigationFieldPoint(editingNavigationField, {
          id: `search-${feature.mapboxId}`,
          label: feature.name,
          subtitle: feature.fullAddress ?? feature.address ?? feature.placeFormatted,
          coordinate: feature.coordinate,
          kind: "search",
        });
        setEditingNavigationField(null);
        setNavigationFieldQuery("");
        navigationFieldSessionRef.current = createMapboxSearchSessionToken();
      } catch {
        showAppToast({
          variant: "error",
          title: "Could not use that stop",
          message: "Please try another search result.",
        });
      } finally {
        setResolvingNavigationFieldId(null);
      }
    },
    [applyNavigationFieldPoint, editingNavigationField, localeTag],
  );

  const startTurnByTurnNavigation = useCallback(() => {
    if (!routePreview || routePreviewCoordinates.length < 2) return;
    setActiveTurnByTurn(true);
  }, [routePreview, routePreviewCoordinates.length]);

  const previewNavigationToSavedPlace = useCallback(
    (place: PlaceDetail | MapSessionPlace) => {
      openNavigationPlanner({
        id: `place-${place.id}`,
        label: place.name,
        subtitle: "address" in place ? place.address?.trim() || null : place.description,
        coordinate: [place.longitude, place.latitude],
        kind: "place",
      });
    },
    [openNavigationPlanner],
  );

  const previewNavigationToExternalPlace = useCallback(
    (place: ExternalSearchPlaceDetail) => {
      openNavigationPlanner(toNavigationPointFromExternalPlace(place));
    },
    [openNavigationPlanner],
  );

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
    showPlaceList(2);
    flyToUserRef.current({ forceNearbyAnchor: true });
  }, [showPlaceList]);

  const onCameraChanged = useCallback((state: MapState) => {
    pendingLiveZoomRef.current = state.properties.zoom;
    if (liveZoomFrameRef.current != null) return;
    liveZoomFrameRef.current = requestAnimationFrame(() => {
      liveZoomFrameRef.current = null;
      const zoom = pendingLiveZoomRef.current;
      setLivePinZoom((prev) => (Math.abs(prev - zoom) < 0.04 ? prev : zoom));
    });
  }, []);

  const onMapIdle = useCallback((state: MapState) => {
    setMapZoom(state.properties.zoom);
    setLivePinZoom(state.properties.zoom);
    const c = state.properties.center;
    const coord: [number, number] = [c[0], c[1]];
    setPinStableCenter(coord);
  }, []);

  const pinZoomScale = useMemo(() => pinZoomScaleFromZoom(livePinZoom), [livePinZoom]);

  const labelForeground = colorScheme === "dark" ? THEME.dark.foreground : THEME.light.foreground;
  const pinHaloOpacity = colorScheme === "dark" ? 0.12 : 0.16;
  const pinHaloBlur = colorScheme === "dark" ? 0.5 : 0.55;
  const pinStrokeColor = colorScheme === "dark" ? "rgba(255,255,255,0.98)" : "#FFFFFF";

  const openAddToItinerary = useCallback(() => {
    if (!eligibleTrip || !selectedPlaceId) return;
    const title = placeDetail?.name ?? selectedPlace?.name ?? "Place";
    setAddModalPrefill({ title, placeId: selectedPlaceId });
    setShowAddItineraryModal(true);
  }, [eligibleTrip, selectedPlaceId, placeDetail?.name, selectedPlace?.name]);

  const addPlaceToItinerary = useCallback(
    (placeId: string, title: string) => {
      if (!eligibleTrip) return;
      setAddModalPrefill({ title, placeId });
      setShowAddItineraryModal(true);
    },
    [eligibleTrip],
  );

  const mapboxSuggestions = useMemo(
    () => (mapboxSuggestQuery.data ?? []) as MapboxSearchBoxSuggestion[],
    [mapboxSuggestQuery.data],
  );

  const leaveMapSession = useCallback(() => {
    const href = session?.returnHref?.trim() ?? null;
    suppressSessionClearEffectsRef.current = true;
    clearSession();
    clearNavigationDraft();
    setSelectedCategories(new Set());
    goToExploreOnNextBackRef.current = false;
    if (!href) return;
    allowNextBeforeRemoveRef.current = true;
    router.dismissTo(href as never);
  }, [session?.returnHref, clearNavigationDraft, clearSession, router]);

  const clearPickedDestination = useCallback(() => {
    centeredPickedDestinationRef.current = null;
    setPickedDestination(null);
    setSearch("");
    showPlaceList(2);
    flyToUserRef.current({ forceNearbyAnchor: true });
  }, [showPlaceList]);

  const clearSearchSelection = useCallback(() => {
    mapboxSearchSessionRef.current = createMapboxSearchSessionToken();
    setSearchSelection(null);
    setSearch("");
    showPlaceList(2);
    flyToUserRef.current({ forceNearbyAnchor: true });
  }, [showPlaceList]);

  const activeScope = useMemo(() => {
    if (searchSelection) {
      return {
        title: searchSelection.name,
        subtitle: searchSelection.subtitle || "Showing saved places around this search",
        onClear: clearSearchSelection,
      };
    }
    if (!pickedDestination) return null;
    const destination = destinationQuery.data?.destination as { country?: string } | undefined;
    return {
      title: pickedDestination.name,
      subtitle: destination?.country?.trim() || "Destination guide loaded",
      onClear: clearPickedDestination,
    };
  }, [
    clearPickedDestination,
    clearSearchSelection,
    destinationQuery.data,
    pickedDestination,
    searchSelection,
  ]);

  const handleMapBack = useCallback(() => {
    if (navigationPlannerVisible) {
      closeNavigationPlanner();
      return true;
    }
    if (sheetMode === "detail") {
      closeDetail();
      return true;
    }
    if (session) {
      leaveMapSession();
      return true;
    }
    if (pickedDestination) {
      clearPickedDestination();
      return true;
    }
    if (searchSelection) {
      clearSearchSelection();
      return true;
    }
    if (goToExploreOnNextBackRef.current) {
      goToExploreOnNextBackRef.current = false;
      allowNextBeforeRemoveRef.current = true;
      router.dismissTo("/(tabs)/explore" as never);
      return true;
    }
    return false;
  }, [
    sheetMode,
    closeDetail,
    session,
    navigationPlannerVisible,
    closeNavigationPlanner,
    leaveMapSession,
    pickedDestination,
    clearPickedDestination,
    searchSelection,
    clearSearchSelection,
    router,
  ]);

  const handleBeforeRemove = useCallback(
    (event: { preventDefault: () => void; data: { action: object } }) => {
      if (allowNextBeforeRemoveRef.current) {
        allowNextBeforeRemoveRef.current = false;
        return;
      }
      if (navigationPlannerVisible) {
        event.preventDefault();
        closeNavigationPlanner();
        return;
      }
      if (sheetMode === "detail") {
        event.preventDefault();
        closeDetail();
        return;
      }
      if (session) {
        event.preventDefault();
        leaveMapSession();
        return;
      }
      if (searchSelection) {
        event.preventDefault();
        clearSearchSelection();
        return;
      }
      if (!pickedDestination) return;
      event.preventDefault();
      clearPickedDestination();
    },
    [
      closeNavigationPlanner,
      clearPickedDestination,
      clearSearchSelection,
      closeDetail,
      leaveMapSession,
      navigationPlannerVisible,
      pickedDestination,
      searchSelection,
      session,
      sheetMode,
    ],
  );

  useEffect(() => {
    const parentNavigation = navigation.getParent?.();
    const rootNavigation = parentNavigation?.getParent?.();
    const listeners = [navigation, parentNavigation, rootNavigation]
      .filter((nav, index, list) => Boolean(nav) && list.indexOf(nav) === index)
      .map((nav) => nav?.addListener?.("beforeRemove", handleBeforeRemove))
      .filter(Boolean) as Array<() => void>;

    return () => {
      for (const unsubscribe of listeners) unsubscribe();
    };
  }, [handleBeforeRemove, navigation]);

  /** Leave map session / destination pick on the tab: remove pins & list, collapse sheet, pan freely (no back navigation). */
  const clearMapPlacesOverlay = useCallback(() => {
    centeredPickedDestinationRef.current = null;
    suppressSessionClearEffectsRef.current = true;
    goToExploreOnNextBackRef.current = true;
    mapboxSearchSessionRef.current = createMapboxSearchSessionToken();
    clearSession();
    clearNavigationDraft();
    setPickedDestination(null);
    setSearchSelection(null);
    setSelectedCategories(new Set());
    setMinRating(null);
    setOpenNowOnly(false);
    setItineraryOnly(false);
    setSearch("");
    setFiltersExpanded(false);
    setCuratedOnly(false);
    showPlaceList(0);
  }, [clearNavigationDraft, clearSession, showPlaceList]);

  const handleSearchChange = useCallback(
    (next: string) => {
      setSearch(next);
      if (searchSelection && normalizeSearchQuery(next) !== normalizedSelectedSearch) {
        setSearchSelection(null);
        setSelectedExternalPlace(null);
        mapboxSearchSessionRef.current = createMapboxSearchSessionToken();
      }
      if (!next.trim()) {
        mapboxSearchSessionRef.current = createMapboxSearchSessionToken();
      }
    },
    [normalizedSelectedSearch, searchSelection],
  );

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => handleMapBack());
      return () => sub.remove();
    }, [handleMapBack]),
  );

  const pickMapboxSuggestion = useCallback(
    async (suggestion: MapboxSearchBoxSuggestion) => {
      setRetrievingSuggestionId(suggestion.mapboxId);
      try {
        const feature = await retrieveMapboxSearchFeature({
          mapboxId: suggestion.mapboxId,
          sessionToken: mapboxSearchSessionRef.current,
          language: localeTag,
        });
        if (!feature) return;

        centeredPickedDestinationRef.current = null;
        setSearchSelection({
          mapboxId: feature.mapboxId,
          name: feature.name,
          subtitle: formatMapboxSearchSubtitle(feature),
          coordinate: feature.coordinate,
          featureType: feature.featureType,
        });
        setSearch(feature.name);
        setCuratedOnly(false);
        setSelectedCategories(new Set());
        setMinRating(null);
        setOpenNowOnly(false);
        setItineraryOnly(false);
        setNearbyAnchorCoord(feature.coordinate);
        nextCameraIntent();
        moveCamera(feature.coordinate, mapboxFeatureZoom(feature.featureType), 420);

        if (isSearchDetailFeatureType(feature.featureType)) {
          const matchedPlace = findMatchingSavedPlace(basePlaces, {
            name: feature.name,
            coordinate: feature.coordinate,
          });

          if (matchedPlace) {
            openPlace(matchedPlace.id);
          } else {
            showExternalPlaceDetail({
              mapboxId: feature.mapboxId,
              name: feature.name,
              subtitle: formatMapboxSearchSubtitle(feature),
              fullAddress: feature.fullAddress,
              address: feature.address ?? feature.placeFormatted,
              featureType: feature.featureType,
              displayCategory: feature.poiCategory ?? formatMapboxPoiCategory(feature.featureType),
              coordinate: feature.coordinate,
            });
          }
          return;
        }

        showPlaceList(2);
      } finally {
        setRetrievingSuggestionId(null);
        mapboxSearchSessionRef.current = createMapboxSearchSessionToken();
      }
    },
    [
      basePlaces,
      localeTag,
      moveCamera,
      nextCameraIntent,
      openPlace,
      showExternalPlaceDetail,
      showPlaceList,
    ],
  );

  useEffect(() => {
    if (!mapReady || !pickedDestination) {
      if (!pickedDestination) centeredPickedDestinationRef.current = null;
      return;
    }
    const d = destinationQuery.data?.destination as
      | { latitude: number; longitude: number }
      | undefined;
    if (!d) return;
    if (centeredPickedDestinationRef.current === pickedDestination.id) return;
    centeredPickedDestinationRef.current = pickedDestination.id;
    nextCameraIntent();
    moveCamera([d.longitude, d.latitude], 12, 420);
    showPlaceList(2);
  }, [
    destinationQuery.data,
    mapReady,
    moveCamera,
    nextCameraIntent,
    pickedDestination,
    showPlaceList,
  ]);

  const offlineMapStyle = !(isConnected && hasInternetReachability)
    ? offlineScopePackQuery.data?.maps.baseMapRegion?.styleUrl
    : null;
  const mapStyle = offlineMapStyle ?? (colorScheme === "dark" ? DARK_MAP_STYLE : LIGHT_MAP_STYLE);

  if (!tokenOk) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-center text-base text-muted-foreground">
          Add <Text className="font-mono text-foreground">EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN</Text> to
          your environment to use the map.
        </Text>
      </View>
    );
  }

  if (activeTurnByTurn) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={{ flex: 1, backgroundColor: routeSummaryBackgroundColor }}
      >
        <MapboxNavigationView
          style={{ flex: 1 }}
          coordinates={turnByTurnCoordinates}
          routeProfile={nativeNavigationProfileForMode(navigationDraft?.mode ?? "driving")}
          locale={localeTag}
          mapStyle={mapStyle}
          followingZoom={15.5}
          mute={true}
          disableAlternativeRoutes
          tripProgressBarBackgroundColor={routeSummaryBackgroundColor}
          tripProgressBarTextColor={navigationTripProgressTextColor}
          tripProgressBarSecondaryTextColor={navigationTripProgressSecondaryTextColor}
          onCancelNavigation={() => setActiveTurnByTurn(false)}
          onFinalDestinationArrival={() => setActiveTurnByTurn(false)}
          onRouteFailedToLoad={() => {
            setActiveTurnByTurn(false);
            showAppToast({
              variant: "error",
              title: "Navigation could not start",
              message: "Please check the route preview and try again.",
            });
          }}
        />
      </SafeAreaView>
    );
  }

  if (locPermission === null) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (locPermission !== "granted") {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-center text-lg font-semibold text-foreground">Location access</Text>
        <Text className="mt-2 text-center text-sm text-muted-foreground">
          Allow location to see places near you on the map, or open a destination and tap See map.
        </Text>
        <Pressable
          onPress={() => router.push("/(tabs)/explore" as never)}
          className="mt-6 rounded-xl bg-primary px-5 py-3 active:opacity-90"
        >
          <Text className="font-semibold text-primary-foreground">Go to Explore</Text>
        </Pressable>
      </View>
    );
  }

  const resolvedMapCenter = mapCoreCenter ?? MAP_BOOTSTRAP_CENTER;

  const loadingPlaces =
    (Boolean(mapsPlacesSourceId) &&
      (!session || session.places.length === 0) &&
      placesQuery.isPending &&
      basePlaces.length === 0) ||
    (!mapsPlacesSourceId &&
      !session &&
      locPermission === "granted" &&
      Boolean(nearbyAnchorCoord) &&
      nearbyPlacesQuery.isPending &&
      basePlaces.length === 0);

  const nearbyNoResults =
    browseNearbyMode &&
    nearbyPlacesQuery.isSuccess &&
    !nearbyPlacesQuery.isPending &&
    basePlaces.length === 0;
  const nearbyFailed = browseNearbyMode && nearbyPlacesQuery.isError;
  const mapboxSuggestionsFetching =
    mapboxSuggestQuery.fetchStatus === "fetching" &&
    searchDebounced.trim().length >= 2 &&
    normalizeSearchQuery(searchDebounced) !== normalizedSelectedSearch;
  const searchResultsVisible =
    normalizedSearch.length >= 2 && (mapboxSuggestions.length > 0 || mapboxSuggestionsFetching);
  const placesSectionTitle = searchSelection
    ? `Places around ${searchSelection.name}`
    : browseNearbyMode
      ? "Nearby places"
      : "Places";
  const nearbyEmptyMessage = searchSelection
    ? `No saved places near ${searchSelection.name} in our database yet. Try another search or jump back to your location.`
    : "No saved places near you in our database yet. Try searching for a destination above, or zoom and pan the map and use My location to refresh your position.";

  return (
    <View className="flex-1 bg-background">
      <MapView
        style={{ flex: 1 }}
        styleURL={mapStyle}
        scaleBarEnabled={false}
        logoEnabled={false}
        compassEnabled={true}
        compassFadeWhenNorth={true}
        compassViewPosition={1}
        compassViewMargins={{ x: 10, y: 200 }}
        attributionEnabled={true}
        onDidFinishLoadingMap={() => setMapReady(true)}
        onCameraChanged={onCameraChanged}
        onMapIdle={onMapIdle}
        onLongPress={(event) => {
          const coords = event.geometry?.coordinates;
          if (!Array.isArray(coords) || coords.length < 2) return;
          const lng = coords[0];
          const lat = coords[1];
          if (typeof lng !== "number" || typeof lat !== "number") return;
          void inspectCoordinate([lng, lat]);
        }}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [resolvedMapCenter.lng, resolvedMapCenter.lat],
            zoomLevel: 12,
          }}
        />
        {locPermission === "granted" && isFocused ? (
          <UserLocation
            visible={false}
            androidRenderMode="normal"
            showsUserHeadingIndicator={false}
            onUpdate={(loc) => {
              if (!loc.coords) return;
              const next: [number, number] = [loc.coords.longitude, loc.coords.latitude];
              setUserCoord((prev) => {
                if (!prev) return next;
                const moved = distanceKm(prev[1], prev[0], next[1], next[0]);
                return moved >= 0.03 ? next : prev;
              });
            }}
          />
        ) : null}
        {mapReady ? (
          <>
            {routePreviewShape ? (
              <ShapeSource id="map-navigation-route" shape={routePreviewShape}>
                <LineLayer
                  id="map-navigation-route-outline"
                  style={{
                    lineCap: "round",
                    lineJoin: "round",
                    lineColor: colorScheme === "dark" ? "#0b1731" : "#FFFFFF",
                    lineWidth: 8,
                    lineOpacity: 0.9,
                    lineEmissiveStrength: 1,
                  }}
                />
                <LineLayer
                  id="map-navigation-route-line"
                  style={{
                    lineCap: "round",
                    lineJoin: "round",
                    lineColor: primaryIconColor,
                    lineWidth: 5,
                    lineOpacity: 0.96,
                    lineEmissiveStrength: 1,
                  }}
                />
              </ShapeSource>
            ) : null}
            {userCoord ? (
              <MarkerView coordinate={userCoord} anchor={{ x: 0.5, y: 0.5 }} allowOverlap>
                <MyLocationMarker />
              </MarkerView>
            ) : null}
            <ShapeSource
              id={MAP_PINS_SOURCE_ID}
              shape={nativePinsShape}
              hitbox={{ width: 28, height: 28 }}
              onPress={(event) => {
                const pressed = event.features[0];
                const properties = pressed?.properties as { placeId?: unknown } | undefined;
                const placeId =
                  typeof properties?.placeId === "string"
                    ? properties.placeId
                    : typeof pressed?.id === "string"
                      ? pressed.id
                      : null;
                if (placeId) openPlace(placeId);
              }}
            >
              <CircleLayer
                id={MAP_PINS_HALO_LAYER_ID}
                style={{
                  circlePitchAlignment: "viewport",
                  circlePitchScale: "viewport",
                  circleColor: ["get", "color"],
                  circleRadius: [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    8,
                    7.5,
                    10,
                    10,
                    12,
                    13,
                    14,
                    16,
                    16,
                    20,
                  ],
                  circleOpacity: pinHaloOpacity,
                  circleBlur: pinHaloBlur,
                  circleEmissiveStrength: 1,
                }}
              />
              <CircleLayer
                id={MAP_PINS_LAYER_ID}
                style={{
                  circlePitchAlignment: "viewport",
                  circlePitchScale: "viewport",
                  circleColor: ["get", "color"],
                  circleRadius: [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    8,
                    4.5,
                    10,
                    6,
                    12,
                    8.5,
                    14,
                    11,
                    16,
                    13.5,
                  ],
                  circleStrokeColor: pinStrokeColor,
                  circleStrokeWidth: [
                    "case",
                    [">=", ["get", "priority"], 2],
                    2.4,
                    [">=", ["get", "priority"], 1],
                    1.8,
                    1.4,
                  ],
                  circleOpacity: 0.98,
                  circleSortKey: ["+", ["*", ["get", "priority"], 10], 1],
                  circleEmissiveStrength: 1,
                }}
              />
            </ShapeSource>

            {selectedPlace ? (
              <MarkerView
                key={selectedPlace.id}
                coordinate={[selectedPlace.longitude, selectedPlace.latitude]}
                anchor={{ x: 0.5, y: 1 }}
                allowOverlap
              >
                <MapPinMarker
                  name={selectedPlace.name}
                  category={selectedPlace.category}
                  selected
                  zoomScale={pinZoomScale}
                  onPress={() => openPlace(selectedPlace.id)}
                />
              </MarkerView>
            ) : null}
            {selectedExternalPlace && !selectedPlace ? (
              <MarkerView
                key={selectedExternalPlace.mapboxId}
                coordinate={selectedExternalPlace.coordinate}
                anchor={{ x: 0.5, y: 1 }}
                allowOverlap
              >
                <MapPinMarker
                  name={selectedExternalPlace.name}
                  category={
                    selectedExternalPlace.displayCategory ?? selectedExternalPlace.featureType
                  }
                  selected
                  zoomScale={pinZoomScale}
                  onPress={() => showExternalPlaceDetail(selectedExternalPlace)}
                />
              </MarkerView>
            ) : null}
            {inspectingLongPress &&
            pendingDropPinCoord &&
            !selectedPlace &&
            !selectedExternalPlace ? (
              <MarkerView coordinate={pendingDropPinCoord} anchor={{ x: 0.5, y: 1 }} allowOverlap>
                <MapPinMarker
                  name="Finding place..."
                  category="poi"
                  selected
                  zoomScale={pinZoomScale}
                  onPress={() => {}}
                />
              </MarkerView>
            ) : null}
          </>
        ) : null}
      </MapView>

      {loadingPlaces ? (
        <View className="absolute inset-0 items-center justify-center bg-background/40">
          <ActivityIndicator size="large" />
        </View>
      ) : null}

      {navigationPlannerVisible ? (
        <View
          className="absolute left-0 right-0 px-3"
          style={{ paddingTop: insets.top }}
          pointerEvents="box-none"
        >
          <View
            className="rounded-[28px] border border-border bg-card px-3 py-3 shadow-md"
            style={{ backgroundColor: colorScheme === "dark" ? THEME.dark.card : THEME.light.card }}
          >
            <View className="flex-row items-start gap-3">
              <View className="flex-1">
                <NavigationPlannerCompactField
                  icon={<LocateFixed size={15} color={primaryIconColor} />}
                  value={navigationDraft?.origin?.label ?? "Choose starting point"}
                  subtitle={navigationDraft?.origin?.subtitle ?? null}
                  onPress={() => openNavigationFieldPicker({ kind: "origin" })}
                />
                {navigationDraft?.waypoints.length ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="mt-2"
                    contentContainerStyle={{ gap: 8, paddingRight: 8 }}
                  >
                    {navigationDraft.waypoints.map((waypoint, index) => (
                      <NavigationWaypointChip
                        key={`${waypoint.id}-${index}`}
                        label={waypoint.coordinate ? waypoint.label : `Stop ${index + 1}`}
                        onPress={() => openNavigationFieldPicker({ kind: "waypoint", index })}
                        onRemove={() => removeNavigationWaypoint(index)}
                      />
                    ))}
                  </ScrollView>
                ) : null}
                <View className="ml-[18px] mt-1 h-3 border-l border-dashed border-border/80" />
                <NavigationPlannerCompactField
                  icon={<Navigation size={15} color="#E25547" />}
                  value={navigationDraft?.destination?.label ?? "Choose destination"}
                  subtitle={navigationDraft?.destination?.subtitle ?? null}
                  onPress={() => openNavigationFieldPicker({ kind: "destination" })}
                />
              </View>
              <View className="gap-2">
                <Pressable
                  onPress={closeNavigationPlanner}
                  hitSlop={8}
                  accessibilityLabel="Close route planner"
                  className="h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background active:opacity-80"
                >
                  <X size={18} color={labelForeground} />
                </Pressable>
                <Pressable
                  onPress={swapNavigationEndpoints}
                  hitSlop={8}
                  accessibilityLabel="Swap route endpoints"
                  className="h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background active:opacity-80"
                >
                  <ArrowUpDown size={16} color={labelForeground} />
                </Pressable>
              </View>
            </View>

            <View
              className="mt-3 flex-row items-center justify-between rounded-2xl border border-border/70 px-3 py-2"
              style={{ backgroundColor: routeSummaryBackgroundColor }}
            >
              <View className="min-w-0 flex-1">
                <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {plannerModeLabel}
                </Text>
                {navigationDraft?.origin?.usesLiveLocation && !userCoord ? (
                  <Text className="mt-0.5 text-sm text-muted-foreground">
                    Waiting for your live location…
                  </Text>
                ) : routePreviewQuery.isPending ? (
                  <Text className="mt-0.5 text-sm text-muted-foreground">Loading route…</Text>
                ) : routePreview ? (
                  <Text className="mt-0.5 text-base font-semibold text-foreground">
                    {formatRouteDuration(routePreview.durationSeconds)} ·{" "}
                    {formatDistanceFromKm(routePreview.distanceMeters / 1000, unitSystem)}
                  </Text>
                ) : routePreviewQuery.isError ? (
                  <Text className="mt-0.5 text-sm text-destructive" numberOfLines={1}>
                    {(routePreviewQuery.error as Error | undefined)?.message ??
                      "Could not preview route."}
                  </Text>
                ) : (
                  <Text className="mt-0.5 text-sm text-muted-foreground">
                    Pick both endpoints to preview the route.
                  </Text>
                )}
              </View>
              <Pressable
                onPress={startTurnByTurnNavigation}
                disabled={
                  !routePreview || routePreviewQuery.isPending || routePreviewCoordinates.length < 2
                }
                className="ml-3 rounded-full bg-primary px-4 py-2 active:opacity-90 disabled:opacity-50"
              >
                <Text className="text-sm font-semibold text-primary-foreground">Start</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <View
          className="absolute left-0 right-0 px-3"
          style={{ paddingTop: insets.top }}
          pointerEvents="box-none"
        >
          <View
            className="overflow-hidden rounded-2xl border border-border bg-card px-2.5 py-2 shadow-md"
            style={{ backgroundColor: colorScheme === "dark" ? THEME.dark.card : THEME.light.card }}
          >
            <View className="flex-row items-center gap-2">
              {sheetMode === "detail" || session || pickedDestination || searchSelection ? (
                <Pressable
                  onPress={() => {
                    handleMapBack();
                  }}
                  className="h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background/60 active:opacity-80"
                >
                  <ChevronLeft size={20} color={labelForeground} />
                </Pressable>
              ) : null}
              <View className="min-w-0 h-11 flex-1 flex-row items-center rounded-2xl border border-border/70 bg-background/70 px-3">
                <Search size={18} color="#9CA3AF" />
                <TextInput
                  value={search}
                  onChangeText={handleSearchChange}
                  placeholder="Search cities, landmarks, or neighborhoods"
                  placeholderTextColor="#9CA3AF"
                  className="ml-2 flex-1 py-0 text-[15px] text-foreground"
                  returnKeyType="search"
                />
                {retrievingSuggestionId || mapboxSuggestionsFetching ? (
                  <ActivityIndicator size="small" />
                ) : search.trim().length > 0 ? (
                  <Pressable
                    onPress={() => {
                      if (searchSelection) {
                        clearSearchSelection();
                        return;
                      }
                      setSearch("");
                      mapboxSearchSessionRef.current = createMapboxSearchSessionToken();
                    }}
                    accessibilityLabel="Clear search"
                    className="ml-2 h-7 w-7 items-center justify-center rounded-full bg-muted/70 active:opacity-80"
                  >
                    <X size={14} color={labelForeground} />
                  </Pressable>
                ) : null}
              </View>
              {session ? (
                <Pressable
                  onPress={clearMapPlacesOverlay}
                  accessibilityLabel="Clear places and pins from map"
                  className="h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background/60 active:opacity-80"
                >
                  <X size={18} color={labelForeground} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => setFiltersExpanded((v) => !v)}
                accessibilityLabel={filtersExpanded ? "Hide filters" : "Show filters"}
                className="h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background/60 active:opacity-80"
              >
                {filtersExpanded ? (
                  <ChevronUp size={18} color={labelForeground} />
                ) : (
                  <ChevronDown size={18} color={labelForeground} />
                )}
              </Pressable>
            </View>

            {activeScope ? (
              <View className="mt-2 flex-row items-center gap-2 rounded-2xl border border-primary/25 bg-primary/10 px-3 py-2">
                <View className="h-8 w-8 items-center justify-center rounded-xl bg-background/70">
                  <Navigation size={15} color={primaryIconColor} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                    {activeScope.title}
                  </Text>
                  <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                    {activeScope.subtitle}
                  </Text>
                </View>
                <Pressable
                  onPress={activeScope.onClear}
                  accessibilityLabel="Clear search scope"
                  className="h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-background/70 active:opacity-80"
                >
                  <X size={16} color={labelForeground} />
                </Pressable>
              </View>
            ) : null}

            {searchResultsVisible ? (
              <View className="mt-2 overflow-hidden rounded-2xl border border-border/70 bg-background/95">
                {mapboxSuggestions.length > 0 ? (
                  <View className="border-b border-border/60 px-3 pb-1 pt-2">
                    <Text className="text-[10px] font-bold uppercase tracking-[1px] text-muted-foreground">
                      Search suggestions
                    </Text>
                  </View>
                ) : null}
                {mapboxSuggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion.mapboxId}
                    onPress={() => {
                      void pickMapboxSuggestion(suggestion);
                    }}
                    className="flex-row items-center gap-3 px-3 py-3 active:bg-muted/50"
                  >
                    <View className="h-9 w-9 items-center justify-center rounded-xl bg-muted/70">
                      {retrievingSuggestionId === suggestion.mapboxId ? (
                        <ActivityIndicator size="small" />
                      ) : (
                        <Navigation size={15} color={primaryIconColor} />
                      )}
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                        {suggestion.name}
                      </Text>
                      <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                        {formatMapboxSearchSubtitle(suggestion)}
                      </Text>
                    </View>
                    <Text className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {suggestion.featureType}
                    </Text>
                  </Pressable>
                ))}

                {mapboxSuggestionsFetching && mapboxSuggestions.length === 0 ? (
                  <View className="flex-row items-center gap-3 px-3 py-3">
                    <ActivityIndicator size="small" />
                    <Text className="text-sm text-muted-foreground">Searching Mapbox…</Text>
                  </View>
                ) : null}

                {mapboxSuggestions.length > 0 ? (
                  <Text className="px-3 pb-2 pt-1 text-[10px] text-muted-foreground">
                    Powered by Mapbox Search Box
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View className="mt-2">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, paddingRight: 8, alignItems: "center" }}
              >
                <Pressable
                  onPress={clearCategoryFilter}
                  className={`rounded-full border px-2.5 py-1 ${
                    selectedCategories.size === 0
                      ? "border-primary bg-primary/15"
                      : "border-border bg-muted/70"
                  }`}
                >
                  <Text
                    className={`text-[11px] font-semibold ${
                      selectedCategories.size === 0 ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    All
                  </Text>
                </Pressable>
                {allCategories.map((cat) => {
                  const inFilter = selectedCategories.has(cat);
                  const active = selectedCategories.size === 0 ? false : inFilter;
                  const accent = pinColorForCategory(cat);
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => toggleCategory(cat)}
                      className="rounded-full border px-2.5 py-1"
                      style={{
                        borderColor: accent,
                        backgroundColor: active ? withOpacity(accent, 0.16) : "transparent",
                      }}
                    >
                      <Text
                        className={`text-[11px] font-semibold ${active ? "" : "text-muted-foreground"}`}
                        style={active ? { color: accent } : undefined}
                        numberOfLines={1}
                      >
                        {formatCategoryLabel(cat)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {filtersExpanded ? (
              <View className="mt-1.5 gap-1.5 border-t border-border/60 pt-2 flex-row">
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, alignItems: "center" }}
                >
                  <FilterChip
                    label="⭐ 4+"
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
                <View className="flex-row items-center justify-between rounded-xl border border-border/70 bg-muted/40 px-2.5 py-1">
                  <Text className="text-[10px] font-bold text-foreground">Itinerary only</Text>
                  <Switch value={itineraryOnly} onValueChange={setItineraryOnly} />
                </View>
              </View>
            ) : null}
          </View>
        </View>
      )}

      {/* Direction (area) + my location — bottom right */}
      <View
        className="absolute right-2 gap-3"
        style={{ bottom: insets.bottom + tabBarHeight + 50 }}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={recenterUser}
          accessibilityLabel="My location"
          className="h-12 w-12 items-center justify-center rounded-2xl border border-border bg-background shadow-md active:opacity-90"
        >
          <LocateFixed size={20} color={primaryIconColor} />
        </Pressable>
      </View>

      {/* no bottom insets required */}
      <BottomSheet
        ref={sheetRef}
        index={sheetIndex}
        onChange={onSheetChange}
        snapPoints={snapPoints}
        topInset={insets.top}
        enableOverDrag={false}
        enablePanDownToClose={false}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={{
          backgroundColor: colorScheme === "dark" ? THEME.dark.card : THEME.light.card,
        }}
        handleIndicatorStyle={{
          backgroundColor:
            colorScheme === "dark" ? THEME.dark.mutedForeground : THEME.light.mutedForeground,
        }}
      >
        {navigationPlannerVisible ? (
          <BottomSheetScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: 16,
              gap: 16,
            }}
          >
            <View className="gap-4">
              <View className="flex-row items-start justify-between gap-3">
                <View className="min-w-0 flex-1">
                  <Text className="text-2xl font-bold text-foreground">{plannerModeLabel}</Text>
                  <Text className="mt-1 text-sm text-muted-foreground">
                    Tap the route fields above to change your start, destination, or stops.
                  </Text>
                </View>
                <Pressable
                  onPress={closeNavigationPlanner}
                  hitSlop={8}
                  accessibilityLabel="Close route planner"
                  className="h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background active:opacity-80"
                >
                  <X size={20} color={labelForeground} />
                </Pressable>
              </View>

              <View className="flex-row gap-2">
                <NavigationModeChip
                  label="Drive"
                  icon={
                    <CarFront
                      size={15}
                      color={navigationDraft?.mode === "driving" ? "#fff" : labelForeground}
                    />
                  }
                  active={navigationDraft?.mode === "driving"}
                  onPress={() => setNavigationRouteMode("driving")}
                />
                <NavigationModeChip
                  label="Walk"
                  icon={
                    <Footprints
                      size={15}
                      color={navigationDraft?.mode === "walking" ? "#fff" : labelForeground}
                    />
                  }
                  active={navigationDraft?.mode === "walking"}
                  onPress={() => setNavigationRouteMode("walking")}
                />
                <NavigationModeChip
                  label="Cycle"
                  icon={
                    <Bike
                      size={15}
                      color={navigationDraft?.mode === "cycling" ? "#fff" : labelForeground}
                    />
                  }
                  active={navigationDraft?.mode === "cycling"}
                  onPress={() => setNavigationRouteMode("cycling")}
                />
              </View>

              <View
                className="rounded-3xl border border-border/70 px-4 py-4"
                style={{ backgroundColor: routeSummaryBackgroundColor }}
              >
                {navigationDraft?.origin?.usesLiveLocation && !userCoord ? (
                  <Text className="text-sm text-muted-foreground">
                    Waiting for your live location to preview the route.
                  </Text>
                ) : routePreviewQuery.isPending ? (
                  <View className="flex-row items-center gap-3">
                    <ActivityIndicator size="small" />
                    <Text className="text-sm text-muted-foreground">Loading route overview…</Text>
                  </View>
                ) : routePreview ? (
                  <>
                    <Text className="text-3xl font-bold text-foreground">
                      {formatRouteDuration(routePreview.durationSeconds)}
                    </Text>
                    <Text className="mt-2 text-base font-semibold text-foreground">
                      {formatDistanceFromKm(routePreview.distanceMeters / 1000, unitSystem)}
                    </Text>
                    <Text className="mt-2 text-sm text-muted-foreground">
                      Route overview loaded. Press Start when you’re ready for turn-by-turn
                      guidance.
                    </Text>
                  </>
                ) : routePreviewQuery.isError ? (
                  <Text className="text-sm text-destructive">
                    {(routePreviewQuery.error as Error | undefined)?.message ??
                      "Could not preview this route right now."}
                  </Text>
                ) : (
                  <Text className="text-sm text-muted-foreground">
                    Pick both a starting point and destination to preview the route.
                  </Text>
                )}
              </View>

              <View className="gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-semibold text-foreground">Stops</Text>
                  <Text className="text-xs text-muted-foreground">
                    {navigationDraft?.waypoints.length ?? 0}/{MAX_MAP_NAVIGATION_WAYPOINTS}
                  </Text>
                </View>
                {navigationDraft?.waypoints.length ? (
                  <View className="flex-row flex-wrap gap-2">
                    {navigationDraft.waypoints.map((waypoint, index) => (
                      <NavigationWaypointChip
                        key={`${waypoint.id}-${index}`}
                        label={waypoint.coordinate ? waypoint.label : `Stop ${index + 1}`}
                        onPress={() => openNavigationFieldPicker({ kind: "waypoint", index })}
                        onRemove={() => removeNavigationWaypoint(index)}
                      />
                    ))}
                  </View>
                ) : (
                  <Text className="text-sm text-muted-foreground">
                    No stops yet. Add up to three waypoints.
                  </Text>
                )}
              </View>

              <View className="flex-row gap-2">
                <Pressable
                  onPress={addNavigationWaypoint}
                  disabled={
                    (navigationDraft?.waypoints.length ?? 0) >= MAX_MAP_NAVIGATION_WAYPOINTS
                  }
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 active:opacity-80 disabled:opacity-50"
                >
                  <Plus size={16} color={labelForeground} />
                  <Text className="text-sm font-semibold text-foreground">Add stop</Text>
                </Pressable>
                <Pressable
                  onPress={swapNavigationEndpoints}
                  className="flex-row items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 active:opacity-80"
                >
                  <ArrowUpDown size={16} color={labelForeground} />
                  <Text className="text-sm font-semibold text-foreground">Swap</Text>
                </Pressable>
              </View>

              <Button
                label="Start"
                onPress={startTurnByTurnNavigation}
                disabled={
                  !routePreview || routePreviewQuery.isPending || routePreviewCoordinates.length < 2
                }
                className="w-full"
              />
            </View>
          </BottomSheetScrollView>
        ) : sheetMode === "list" ? (
          <BottomSheetFlatList
            data={orderedPlaces}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}
            ListHeaderComponent={
              <View className="pb-2">
                <Text className="text-lg font-bold text-foreground">{placesSectionTitle}</Text>
                {nearbyFailed ? (
                  <Text className="mt-1 text-sm text-destructive">
                    Could not load nearby places. Check your connection and try opening the map
                    again.
                  </Text>
                ) : nearbyNoResults ? (
                  <Text className="mt-1 text-sm text-muted-foreground">{nearbyEmptyMessage}</Text>
                ) : (
                  <Text className="text-xs text-muted-foreground">
                    {orderedPlaces.length} shown · tap a row or a pin for details
                  </Text>
                )}
              </View>
            }
            renderItem={({ item }) => (
              <PlaceCard
                title={item.name}
                subtitle={item.description}
                rating={item.rating}
                imageUrl={item.imageUrl}
                metaRight={
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: pinColorForCategory(item.category) }}
                  >
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
              {/* <Pressable onPress={closeDetail} hitSlop={12} accessibilityLabel="Close">
                <X size={22} color="#A1A1AA" />
              </Pressable> */}
            </View>
            {inspectingLongPress ? (
              <View className="items-center py-10">
                <ActivityIndicator />
                <Text className="mt-3 text-sm text-muted-foreground">Looking up this spot…</Text>
              </View>
            ) : selectedPlaceId && placeDetailQuery.fetchStatus === "fetching" ? (
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
                        transition={150}
                      />
                    ) : (
                      <View className="h-full w-full bg-muted" />
                    )}
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-xl font-bold text-foreground" numberOfLines={1}>
                      {placeDetail.name}
                    </Text>
                    <Text className="mt-1 text-xs font-semibold text-primary">
                      {formatCategoryLabel(placeDetail.category)}
                    </Text>
                    <View className="mt-2 flex-row flex-wrap items-center gap-2">
                      {placeDetail.rating != null ? (
                        <View className="flex-row items-center gap-1">
                          <Star size={14} color="#FBBF24" fill="#FBBF24" />
                          <Text className="text-sm text-foreground">
                            {placeDetail.rating.toFixed(1)}
                          </Text>
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
                          {formatDistanceFromKm(
                            distanceKm(
                              userCoord[1],
                              userCoord[0],
                              placeDetail.latitude,
                              placeDetail.longitude,
                            ),
                            unitSystem,
                          )}
                        </Text>
                      ) : null}
                    </View>
                    <View className="flex-row">
                      <Pressable
                        onPress={() => {
                          if (selectedPlaceId) router.push(`/place/${selectedPlaceId}` as never);
                        }}
                      >
                        <Text
                          className="text-sm font-light text-muted-foreground m-0 p-0 underline"
                          style={{ textDecorationLine: "underline" }}
                        >
                          Details
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
                {placeDetail.description ? (
                  <Text className="text-sm leading-6 text-muted-foreground">
                    {placeDetail.description}
                  </Text>
                ) : null}
                {placeDetail.address ? (
                  <View className="flex-row items-center gap-3 rounded-2xl border border-border/70 bg-background/70 px-3 py-3">
                    <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                      <Navigation size={16} color={primaryIconColor} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Address
                      </Text>
                      <Text className="mt-1 text-sm text-foreground">{placeDetail.address}</Text>
                    </View>
                    <Pressable
                      onPress={() => previewNavigationToSavedPlace(placeDetail)}
                      hitSlop={8}
                      accessibilityLabel="Navigate to this place"
                      className="h-10 w-10 items-center justify-center rounded-xl bg-primary/15 active:opacity-80"
                    >
                      <Route size={18} color={primaryIconColor} />
                    </Pressable>
                  </View>
                ) : null}
                <View className="gap-3 pb-1">
                  {eligibleTrip && !placeInItinerary ? (
                    <Button
                      label="Add to itinerary"
                      onPress={openAddToItinerary}
                      className="w-full"
                    />
                  ) : placeInItinerary ? (
                    <Text className="text-sm text-muted-foreground">
                      Already in your itinerary.
                    </Text>
                  ) : tripsQuery.isPending && tripDestinationScopeId ? (
                    <View className="items-center py-2">
                      <ActivityIndicator />
                    </View>
                  ) : createTripPrefill ? (
                    <Button
                      label="Create trip to this destination"
                      onPress={() =>
                        router.push({
                          pathname: "/trip/new",
                          params: {
                            destinationId: createTripPrefill.destinationId,
                            destinationName: createTripPrefill.destinationName,
                            destinationCountry: createTripPrefill.destinationCountry ?? "",
                          },
                        } as never)
                      }
                      className="w-full"
                    />
                  ) : destinationQuery.isFetching || detailOwnerDestinationQuery.isFetching ? (
                    <View className="items-center py-2">
                      <ActivityIndicator />
                    </View>
                  ) : (
                    <Text className="text-sm text-muted-foreground">
                      Could not load trip options for this destination. Try opening it from Explore.
                    </Text>
                  )}
                </View>
              </View>
            ) : selectedExternalPlace ? (
              <View className="w-full gap-3">
                <View className="flex-row gap-3">
                  <View className="h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                    <Navigation size={30} color={primaryIconColor} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-xl font-bold text-foreground" numberOfLines={2}>
                      {selectedExternalPlace.name}
                    </Text>
                    <Text className="mt-1 text-xs font-semibold text-primary">
                      {selectedExternalPlace.displayCategory ??
                        formatCategoryLabel(selectedExternalPlace.featureType)}
                    </Text>
                    <View className="mt-2 flex-row flex-wrap items-center gap-2">
                      {userCoord ? (
                        <Text className="text-sm text-muted-foreground">
                          {formatDistanceFromKm(
                            distanceKm(
                              userCoord[1],
                              userCoord[0],
                              selectedExternalPlace.coordinate[1],
                              selectedExternalPlace.coordinate[0],
                            ),
                            unitSystem,
                          )}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
                {selectedExternalPlace.fullAddress ? (
                  <View className="flex-row items-center gap-3 rounded-2xl border border-border/70 bg-background/70 px-3 py-3">
                    <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                      <Navigation size={16} color={primaryIconColor} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Address
                      </Text>
                      <Text className="mt-1 text-sm text-foreground">
                        {selectedExternalPlace.fullAddress}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => previewNavigationToExternalPlace(selectedExternalPlace)}
                      hitSlop={8}
                      accessibilityLabel="Navigate to this place"
                      className="h-10 w-10 items-center justify-center rounded-xl bg-primary/15 active:opacity-80"
                    >
                      <Route size={18} color={primaryIconColor} />
                    </Pressable>
                  </View>
                ) : selectedExternalPlace.address ? (
                  <View className="flex-row items-center gap-3 rounded-2xl border border-border/70 bg-background/70 px-3 py-3">
                    <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                      <Navigation size={16} color={primaryIconColor} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Address
                      </Text>
                      <Text className="mt-1 text-sm text-foreground">
                        {selectedExternalPlace.address}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => previewNavigationToExternalPlace(selectedExternalPlace)}
                      hitSlop={8}
                      accessibilityLabel="Navigate to this place"
                      className="h-10 w-10 items-center justify-center rounded-xl bg-primary/15 active:opacity-80"
                    >
                      <Route size={18} color={primaryIconColor} />
                    </Pressable>
                  </View>
                ) : selectedExternalPlace.subtitle ? (
                  <Text className="text-sm leading-6 text-muted-foreground">
                    {selectedExternalPlace.subtitle}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text className="text-muted-foreground">Could not load this place.</Text>
            )}
          </BottomSheetScrollView>
        )}
      </BottomSheet>
      {eligibleTrip ? (
        <AddItineraryItemModal
          visible={showAddItineraryModal}
          tripId={eligibleTrip.id}
          defaultDate={new Date(eligibleTrip.startDate)}
          tripStartDate={new Date(eligibleTrip.startDate)}
          tripEndDate={new Date(eligibleTrip.endDate)}
          offlineDestinationId={eligibleTrip.destination.id}
          initialTitle={addModalPrefill?.title}
          initialPlaceId={addModalPrefill?.placeId ?? null}
          onClose={() => {
            setShowAddItineraryModal(false);
            setAddModalPrefill(null);
          }}
          onSuccess={() => {
            setShowAddItineraryModal(false);
            const justAddedPlaceId = addModalPrefill?.placeId;
            setAddModalPrefill(null);
            void queryClient.invalidateQueries({ queryKey: ["itinerary", eligibleTrip.id] });
            if (justAddedPlaceId) {
              setSelectedPlaceId(justAddedPlaceId);
            }
          }}
          onSuccessMessage={(title) => {
            showAppToast({
              variant: "success",
              title: "Added to itinerary",
              message: `${title} added to ${eligibleTrip.title}.`,
            });
          }}
        />
      ) : null}
      <KeyboardSheetModal
        visible={editingNavigationField != null}
        title={
          editingNavigationField?.kind === "origin"
            ? "Choose starting point"
            : editingNavigationField?.kind === "destination"
              ? "Choose destination"
              : `Choose stop ${(editingNavigationField?.index ?? 0) + 1}`
        }
        onClose={() => {
          setEditingNavigationField(null);
          setNavigationFieldQuery("");
          setResolvingNavigationFieldId(null);
        }}
        minHeight={340}
        maxHeight={560}
        footer={
          editingNavigationField?.kind === "origin" ? (
            <Button
              label="Use my live location"
              variant="secondary"
              onPress={useCurrentLocationForOrigin}
            />
          ) : undefined
        }
      >
        <View className="gap-3">
          <View className="flex-row items-center rounded-2xl border border-border bg-background/80 px-3 py-2">
            <Search size={16} color={labelForeground} />
            <TextInput
              value={navigationFieldQuery}
              onChangeText={setNavigationFieldQuery}
              placeholder="Search for a place or address"
              placeholderTextColor={
                colorScheme === "dark" ? THEME.dark.mutedForeground : THEME.light.mutedForeground
              }
              className="ml-2 flex-1 py-0 text-sm text-foreground"
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="search"
            />
            {navigationFieldQuery.length > 0 ? (
              <Pressable
                onPress={() => setNavigationFieldQuery("")}
                hitSlop={6}
                className="ml-2 h-7 w-7 items-center justify-center rounded-full bg-muted/80 active:opacity-80"
              >
                <X size={14} color={labelForeground} />
              </Pressable>
            ) : null}
          </View>

          {navigationFieldQueryDebounced.trim().length < 2 ? (
            <Text className="text-sm text-muted-foreground">
              Type at least 2 characters to search Mapbox for a stop.
            </Text>
          ) : navigationFieldSuggestionsQuery.isPending ? (
            <View className="flex-row items-center gap-3 py-2">
              <ActivityIndicator size="small" />
              <Text className="text-sm text-muted-foreground">Searching Mapbox…</Text>
            </View>
          ) : navigationFieldSuggestions.length > 0 ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-2 pb-2">
                {navigationFieldSuggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion.mapboxId}
                    onPress={() => {
                      void selectNavigationSuggestion(suggestion);
                    }}
                    className="flex-row items-center gap-3 rounded-2xl border border-border/70 bg-background/70 px-3 py-3 active:opacity-80"
                  >
                    <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                      {resolvingNavigationFieldId === suggestion.mapboxId ? (
                        <ActivityIndicator size="small" />
                      ) : (
                        <Navigation size={15} color={primaryIconColor} />
                      )}
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                        {suggestion.name}
                      </Text>
                      <Text className="text-[11px] text-muted-foreground" numberOfLines={2}>
                        {formatMapboxSearchSubtitle(suggestion)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          ) : navigationFieldSuggestionsQuery.isError ? (
            <Text className="text-sm text-destructive">
              {(navigationFieldSuggestionsQuery.error as Error | undefined)?.message ??
                "Could not load search suggestions."}
            </Text>
          ) : (
            <Text className="text-sm text-muted-foreground">No matching locations found.</Text>
          )}
        </View>
      </KeyboardSheetModal>
    </View>
  );
}

function NavigationPlannerCompactField({
  icon,
  value,
  subtitle,
  onPress,
}: {
  icon: ReactNode;
  value: string;
  subtitle: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl px-1.5 py-1.5 active:opacity-80"
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/10">{icon}</View>
      <View className="min-w-0 flex-1">
        <Text className="text-xl font-medium text-foreground" numberOfLines={1}>
          {value}
        </Text>
        {subtitle ? (
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function NavigationWaypointChip({
  label,
  onPress,
  onRemove,
}: {
  label: string;
  onPress: () => void;
  onRemove: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-2 rounded-full border border-border bg-background px-3 py-2 active:opacity-80"
    >
      <Route size={14} color="#E25547" />
      <Text className="max-w-[140px] text-sm font-medium text-foreground" numberOfLines={1}>
        {label}
      </Text>
      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          onRemove();
        }}
        hitSlop={6}
        accessibilityLabel={`Remove ${label}`}
        className="h-5 w-5 items-center justify-center rounded-full bg-muted"
      >
        <X size={11} color="#71717A" />
      </Pressable>
    </Pressable>
  );
}

function NavigationModeChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl px-3 py-2.5 ${
        active ? "bg-primary" : "border border-border bg-background/70"
      }`}
    >
      {icon}
      <Text
        className={`text-sm font-semibold ${active ? "text-primary-foreground" : "text-foreground"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MyLocationMarker() {
  return (
    <View
      pointerEvents="none"
      style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}
    >
      <View
        style={{
          position: "absolute",
          width: 30,
          height: 30,
          borderRadius: 999,
          backgroundColor: "rgba(59,130,246,0.24)",
        }}
      />
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 999,
          backgroundColor: "#3B82F6",
          borderWidth: 3,
          borderColor: "#FFFFFF",
          shadowColor: "#2563EB",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 8,
        }}
      />
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
      className={`rounded-full border px-2.5 py-1 ${
        active ? "border-primary bg-primary/15" : "border-border bg-muted/70"
      }`}
    >
      <Text className={`text-[11px] font-semibold ${active ? "text-primary" : "text-foreground"}`}>
        {label}
      </Text>
    </Pressable>
  );
}
