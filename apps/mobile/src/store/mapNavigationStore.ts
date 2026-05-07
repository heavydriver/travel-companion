import { create } from "zustand";

export const MAX_MAP_NAVIGATION_WAYPOINTS = 3;

export type MapNavigationRouteMode = "driving" | "walking" | "cycling";

export type MapNavigationPointKind =
  | "current_location"
  | "place"
  | "search"
  | "waypoint"
  | "dropped_pin";

export type MapNavigationPoint = {
  id: string;
  label: string;
  subtitle: string | null;
  coordinate: [number, number] | null;
  kind: MapNavigationPointKind;
  usesLiveLocation?: boolean;
};

export type MapNavigationDraft = {
  origin: MapNavigationPoint | null;
  destination: MapNavigationPoint | null;
  waypoints: MapNavigationPoint[];
  mode: MapNavigationRouteMode;
  autoOpenPlanner?: boolean;
};

type MapNavigationState = {
  draft: MapNavigationDraft | null;
  draftRevision: number;
  setDraft: (draft: MapNavigationDraft) => void;
  updateDraft: (updater: (draft: MapNavigationDraft | null) => MapNavigationDraft | null) => void;
  clearDraft: () => void;
};

export function createCurrentLocationNavigationPoint(): MapNavigationPoint {
  return {
    id: "current-location",
    label: "My location",
    subtitle: "Using your live GPS position",
    coordinate: null,
    kind: "current_location",
    usesLiveLocation: true,
  };
}

export const useMapNavigationStore = create<MapNavigationState>((set) => ({
  draft: null,
  draftRevision: 0,
  setDraft: (draft) => set((state) => ({ draft, draftRevision: state.draftRevision + 1 })),
  updateDraft: (updater) =>
    set((state) => ({
      draft: updater(state.draft),
      draftRevision: state.draftRevision + 1,
    })),
  clearDraft: () => set({ draft: null }),
}));
