import { create } from "zustand";

export type Trip = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  coverImageUrl: string | null;
  createdAt: string;
  destination: {
    id: string;
    name: string;
    countryCode: string;
  };
};

export function getEligibleTripForDestination(trips: Trip[], destinationId: string) {
  const today = new Date();
  return trips
    .filter(
      (trip) =>
        trip.destination.id === destinationId &&
        new Date(trip.endDate) >= today,
    )
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];
}

type TripState = {
  trips: Trip[];
  activeTripId: string | null;
  setTrips: (trips: Trip[]) => void;
  setActiveTripId: (id: string | null) => void;
  activeTrip: () => Trip | undefined;
};

export const useTripStore = create<TripState>((set, get) => ({
  trips: [],
  activeTripId: null,
  setTrips: (trips) => set({ trips }),
  setActiveTripId: (id) => set({ activeTripId: id }),
  activeTrip: () => {
    const { trips, activeTripId } = get();
    if (activeTripId) return trips.find((t) => t.id === activeTripId);
    return trips[0];
  },
}));
