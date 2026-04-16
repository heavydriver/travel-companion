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
};

type MapSessionState = {
  session: MapSession | null;
  setSession: (session: MapSession) => void;
  clearSession: () => void;
};

export const useMapSessionStore = create<MapSessionState>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
  clearSession: () => set({ session: null }),
}));
