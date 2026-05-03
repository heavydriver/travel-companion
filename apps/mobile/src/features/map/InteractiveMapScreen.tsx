import BottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFlatList,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
  Camera,
  CircleLayer,
  type MapState,
  MapView,
  MarkerView,
  ShapeSource,
  UserLocation,
} from "@rnmapbox/maps";
import { useQuery } from "@tanstack/react-query";
import { approximateNumber as approx } from "approximate-number";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  LocateFixed,
  Navigation,
  Plus,
  Search,
  Star,
  X,
} from "lucide-react-native";
import { useColorScheme, useUnstableNativeVariable } from "nativewind";
import {
  type ElementRef,
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
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { client } from "@/api/client";
import { Button } from "@/components/shared/Button";
import { PlaceCard } from "@/components/shared/PlaceCard";
import { useDebounce } from "@/hooks/useDebounce";
import { THEME } from "@/lib/theme";
import { formatDistanceFromKm } from "@/lib/units";
import { type MapSessionPlace, useMapSessionStore } from "@/store/mapSessionStore";
import { usePreferencesStore } from "@/store/preferencesStore";
import { getEligibleTripForDestination, type Trip, useTripStore } from "@/store/tripStore";
import { pinColorForCategory } from "./categoryPinColor";
import { ensureMapboxToken } from "./ensureMapboxToken";
import { applyMapFilters, deriveCategories, type MapFilterControls } from "./filterMapPlaces";
import { MapPinMarker } from "./MapPinMarker";

const DARK_MAP_STYLE = "mapbox://styles/varun-11/cmo7dh5kl001001qshs9chyef";
const LIGHT_MAP_STYLE = "mapbox://styles/varun-11/cmo7dnxyi003001ql58s51upl";
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

function buildMapPinShape(
  places: MapSessionPlace[],
  itineraryIds: Set<string>,
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
        color: pinColorForCategory(p.category),
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
  const unitSystem = usePreferencesStore((s) => s.unitSystem);
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

  const cameraRef = useRef<ElementRef<typeof Camera>>(null);
  const sheetRef = useRef<BottomSheet>(null);
  const appliedSessionRevisionRef = useRef(-1);
  const curatedSessionAppliedRef = useRef(-1);
  const autoOpenedForSearchKeyRef = useRef<string | null>(null);
  const centeredPickedDestinationRef = useRef<string | null>(null);
  const cameraIntentRef = useRef(0);
  const liveZoomFrameRef = useRef<number | null>(null);
  const pendingLiveZoomRef = useRef(12);

  const searchDebounced = useDebounce(search, 320);

  /** Destination whose places we load from the API (session or search pick). */
  const mapsPlacesSourceId = session?.destinationId ?? pickedDestination?.id ?? null;

  useEffect(() => {
    if (session) setPickedDestination(null);
  }, [session]);

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
      locPermission === "granted" && nearbyAnchorCoord && !mapsPlacesSourceId && !session,
    ),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  const destinationSearchQuery = useQuery({
    queryKey: ["map-destination-search", searchDebounced],
    queryFn: async () => {
      const q = searchDebounced.trim();
      const res = await client.api.v1.destinations.get({
        query: { q, limit: 10 },
      });
      if (res.error) throw new Error("Failed to search destinations");
      return res.data;
    },
    enabled: searchDebounced.trim().length >= 2,
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
    setSheetMode("list");
    requestAnimationFrame(() => {
      sheetRef.current?.snapToIndex(nextIndex);
    });
  }, []);

  const showPlaceDetail = useCallback((id: string, nextIndex = 1) => {
    setSelectedPlaceId(id);
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

  const filtersActive = useMemo(() => hasActiveMapFilters(filterPayload), [filterPayload]);

  const orderedPlaces = useMemo(() => {
    if (session || pickedDestination || !userCoord) return filteredPlaces;
    const [lng, lat] = userCoord;
    return [...filteredPlaces].sort(
      (a, b) =>
        distanceKm(lat, lng, a.latitude, a.longitude) -
        distanceKm(lat, lng, b.latitude, b.longitude),
    );
  }, [filteredPlaces, session, pickedDestination, userCoord]);

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
    return buildMapPinShape(unselectedPins, itineraryPlaceIds);
  }, [itineraryPlaceIds, pinsToRender, selectedPlaceId]);

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

  const placeDetail = placeDetailQuery.data?.place as PlaceDetail | undefined;
  const detailHeroImageUrl = placeDetail?.imageUrl ?? selectedPlace?.imageUrl ?? null;
  const placeInItinerary = Boolean(selectedPlaceId && itineraryPlaceIds.has(selectedPlaceId));

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

  const closeDetail = useCallback(() => {
    showPlaceList(2);
  }, [showPlaceList]);

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

  const recenterDestination = useCallback(() => {
    const c = destCenter ?? mapCoreCenter ?? MAP_BOOTSTRAP_CENTER;
    showPlaceList(2);
    nextCameraIntent();
    moveCamera([c.lng, c.lat], 12, 450);
  }, [destCenter, mapCoreCenter, moveCamera, nextCameraIntent, showPlaceList]);

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

  const destinationSearchHits = useMemo(
    () =>
      (destinationSearchQuery.data?.destinations ?? []) as Array<{
        id: string;
        name: string;
        country: string;
      }>,
    [destinationSearchQuery.data],
  );

  const leaveMapSession = useCallback(() => {
    const href = session?.returnHref?.trim() ?? null;
    clearSession();
    setSelectedCategories(new Set());
    if (href) {
      if (router.canGoBack()) router.back();
      else router.push(href as never);
    }
  }, [session?.returnHref, clearSession, router]);

  const clearPickedDestination = useCallback(() => {
    centeredPickedDestinationRef.current = null;
    setPickedDestination(null);
    showPlaceList(2);
    flyToUserRef.current({ forceNearbyAnchor: true });
  }, [showPlaceList]);

  /** Leave map session / destination pick on the tab: remove pins & list, collapse sheet, pan freely (no back navigation). */
  const clearMapPlacesOverlay = useCallback(() => {
    centeredPickedDestinationRef.current = null;
    clearSession();
    setPickedDestination(null);
    setSelectedCategories(new Set());
    setMinRating(null);
    setOpenNowOnly(false);
    setItineraryOnly(false);
    setSearch("");
    setFiltersExpanded(false);
    setCuratedOnly(false);
    showPlaceList(0);
  }, [clearSession, showPlaceList]);

  const pickSearchDestination = useCallback(
    (row: { id: string; name: string }) => {
      centeredPickedDestinationRef.current = null;
      setPickedDestination({ id: row.id, name: row.name });
      setSearch("");
      setCuratedOnly(false);
      showPlaceList(2);
    },
    [showPlaceList],
  );

  useFocusEffect(
    useCallback(() => {
      const href = session?.returnHref?.trim();
      if (!href) return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        leaveMapSession();
        return true;
      });
      return () => sub.remove();
    }, [session?.returnHref, leaveMapSession]),
  );

  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2 || pickedDestination) {
      autoOpenedForSearchKeyRef.current = null;
      return;
    }
    if (destinationSearchHits.length > 0) {
      autoOpenedForSearchKeyRef.current = null;
      return;
    }
    if (filteredPlaces.length !== 1) {
      autoOpenedForSearchKeyRef.current = null;
      return;
    }
    const key = `${q}::${filteredPlaces[0].id}`;
    if (autoOpenedForSearchKeyRef.current === key) return;
    autoOpenedForSearchKeyRef.current = key;
    openPlace(filteredPlaces[0].id);
  }, [search, pickedDestination, destinationSearchHits.length, filteredPlaces, openPlace]);

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

  const mapStyle = colorScheme === "dark" ? DARK_MAP_STYLE : LIGHT_MAP_STYLE;

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

  const browseNearbyMode = !mapsPlacesSourceId && !session;
  const nearbyNoResults =
    browseNearbyMode &&
    nearbyPlacesQuery.isSuccess &&
    !nearbyPlacesQuery.isPending &&
    basePlaces.length === 0;
  const nearbyFailed = browseNearbyMode && nearbyPlacesQuery.isError;

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
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [resolvedMapCenter.lng, resolvedMapCenter.lat],
            zoomLevel: 12,
          }}
        />
        {locPermission === "granted" ? (
          <UserLocation
            visible
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
                  circleOpacity: 0.16,
                  circleBlur: 0.55,
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
                  circleStrokeColor: "#FFFFFF",
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
          </>
        ) : null}
      </MapView>

      {loadingPlaces ? (
        <View className="absolute inset-0 items-center justify-center bg-background/40">
          <ActivityIndicator size="large" />
        </View>
      ) : null}

      {/* Search + filters (solid panel) */}
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
            {session ? (
              <Pressable
                onPress={() => {
                  leaveMapSession();
                }}
                className="h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background/60 active:opacity-80"
              >
                <ChevronLeft size={20} color={labelForeground} />
              </Pressable>
            ) : null}
            <View className="min-w-0 h-9 flex-1 flex-row items-center rounded-xl border border-border/80 bg-background/50 px-2.5 py-1.5">
              <Search size={16} color="#9CA3AF" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search places or destinations…"
                placeholderTextColor="#9CA3AF"
                className="ml-2 flex-1 py-0 text-[15px] text-foreground"
                returnKeyType="search"
              />
            </View>
            {session || pickedDestination ? (
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

          {pickedDestination ? (
            <View className="mt-2 flex-row items-center justify-between gap-2 rounded-xl border border-primary/35 bg-primary/12 px-2.5 py-2">
              <Text
                className="min-w-0 flex-1 text-xs font-semibold text-foreground"
                numberOfLines={1}
              >
                {pickedDestination.name}
              </Text>
              <Pressable
                onPress={clearPickedDestination}
                className="shrink-0 rounded-lg border border-border bg-background/70 px-2 py-1 active:opacity-80"
              >
                <Text className="text-[11px] font-semibold text-primary">Nearby</Text>
              </Pressable>
            </View>
          ) : null}

          {destinationSearchHits.length > 0 && search.trim().length >= 2 ? (
            <View className="mt-2">
              <Text className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Destinations
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingRight: 8, alignItems: "center" }}
              >
                {destinationSearchHits.map((d) => (
                  <Pressable
                    key={d.id}
                    onPress={() => pickSearchDestination(d)}
                    className="max-w-[200px] rounded-xl border border-border bg-muted/50 px-3 py-2 active:opacity-85"
                  >
                    <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                      {d.name}
                    </Text>
                    <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                      {d.country}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View className="mt-1.5">
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

      {/* Direction (area) + my location — bottom right */}
      <View
        className="absolute right-2 gap-3"
        style={{ bottom: insets.bottom + tabBarHeight + 50 }}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={recenterDestination}
          accessibilityLabel="Face destination area"
          className="h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary shadow-md active:opacity-90"
        >
          <Navigation size={20} color="#fff" />
        </Pressable>
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
        {sheetMode === "list" ? (
          <BottomSheetFlatList
            data={orderedPlaces}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}
            ListHeaderComponent={
              <View className="pb-2">
                <Text className="text-lg font-bold text-foreground">
                  {browseNearbyMode ? "Nearby places" : "Places"}
                </Text>
                {nearbyFailed ? (
                  <Text className="mt-1 text-sm text-destructive">
                    Could not load nearby places. Check your connection and try opening the map
                    again.
                  </Text>
                ) : nearbyNoResults ? (
                  <Text className="mt-1 text-sm text-muted-foreground">
                    No saved places near you in our database yet. Try searching for a destination
                    above, or zoom and pan the map and use My location to refresh your position.
                  </Text>
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
