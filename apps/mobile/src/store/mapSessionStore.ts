import { create } from "zustand";

/** Snapshot passed from destination “See map” or hydrated from API list. */
export type MapSessionPlace = {
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

export type MapSession = {
  destinationId: string;
  destinationName: string;
  latitude: number;
  longitude: number;
  timezone: string | null;
  places: MapSessionPlace[];
  /** When set, the map opens centered on this point (e.g. place detail → map). */
  focusLatitude?: number | null;
  focusLongitude?: number | null;
  focusZoomLevel?: number | null;
  /** When set, the map also opens the place detail sheet for this place id. */
  focusPlaceId?: string | null;
  /** Expo route to return to when leaving the session (e.g. `/destination/abc`). */
  returnHref?: string | null;
  /** When true, map applies “curated only” once for this session (must-visit map entry). */
  startWithCuratedPlacesOnly?: boolean;
};

type MapSessionState = {
  session: MapSession | null;
  /** Increments on each `setSession` so the map can run a one-shot camera to context. */
  sessionRevision: number;
  setSession: (session: MapSession) => void;
  clearSession: () => void;
};

export const useMapSessionStore = create<MapSessionState>((set) => ({
  session: null,
  sessionRevision: 0,
  setSession: (session) => set((s) => ({ session, sessionRevision: s.sessionRevision + 1 })),
  clearSession: () => set({ session: null }),
}));
