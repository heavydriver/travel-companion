import { queryClient } from "@/lib/queryClient";
import type { PlannerProposal } from "@/llm/plannerSchema";
import { useTripStore, type Trip } from "@/store/tripStore";

export type LocalItineraryItem = {
  id: string;
  tripId: string;
  placeId: string | null;
  title: string;
  notes: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  order: number;
  isDone: boolean;
};

function makeNowIso() {
  return new Date().toISOString();
}

export function createOptimisticTrip(tempTripId: string, proposal: PlannerProposal): Trip {
  return {
    id: tempTripId,
    title: proposal.title,
    description: proposal.summary,
    startDate: proposal.startDate ?? makeNowIso(),
    endDate: proposal.endDate ?? proposal.startDate ?? makeNowIso(),
    budget: proposal.budget ?? null,
    currencyCode: proposal.currencyCode?.toUpperCase() ?? null,
    coverImageUrl: null,
    createdAt: makeNowIso(),
    isLocalOnly: true,
    destination: {
      id: `local-destination:${tempTripId}`,
      name: proposal.destinationName,
      countryCode: proposal.countryCode?.toUpperCase() ?? "XX",
    },
  };
}

export function createOptimisticItineraryItems(
  tempTripId: string,
  proposal: PlannerProposal,
): LocalItineraryItem[] {
  return proposal.itineraryItems.map((item, index) => ({
    id: `local-item:${tempTripId}:${index}`,
    tripId: tempTripId,
    placeId: null,
    title: item.title,
    notes: item.notes ?? null,
    date: item.date,
    startTime: item.startTime ?? null,
    endTime: item.endTime ?? null,
    order: index,
    isDone: false,
  }));
}

export function insertOptimisticPlannerTrip(
  tempTripId: string,
  proposal: PlannerProposal,
) {
  const trip = createOptimisticTrip(tempTripId, proposal);
  const items = createOptimisticItineraryItems(tempTripId, proposal);

  const currentTrips = (queryClient.getQueryData<{ trips: Trip[] }>(["trips"])?.trips ?? [])
    .filter((entry) => entry.id !== tempTripId);
  queryClient.setQueryData(["trips"], { trips: [trip, ...currentTrips] });
  queryClient.setQueryData(["trip", tempTripId], { trip });
  queryClient.setQueryData(["itinerary", tempTripId], { items });

  const existingStoreTrips = useTripStore.getState().trips.filter((entry) => entry.id !== tempTripId);
  useTripStore.getState().setTrips([trip, ...existingStoreTrips]);
  useTripStore.getState().setActiveTripId(tempTripId);

  return { trip, items };
}

export function replaceOptimisticPlannerTrip(
  tempTripId: string,
  trip: Trip,
  items: LocalItineraryItem[],
) {
  const currentTrips = (queryClient.getQueryData<{ trips: Trip[] }>(["trips"])?.trips ?? [])
    .filter((entry) => entry.id !== tempTripId && entry.id !== trip.id);
  queryClient.setQueryData(["trips"], { trips: [trip, ...currentTrips] });
  queryClient.removeQueries({ queryKey: ["trip", tempTripId], exact: true });
  queryClient.removeQueries({ queryKey: ["itinerary", tempTripId], exact: true });
  queryClient.setQueryData(["trip", trip.id], { trip });
  queryClient.setQueryData(["itinerary", trip.id], { items });

  const nextStoreTrips = useTripStore
    .getState()
    .trips.filter((entry) => entry.id !== tempTripId && entry.id !== trip.id);
  useTripStore.getState().setTrips([trip, ...nextStoreTrips]);
  useTripStore.getState().setActiveTripId(trip.id);
}
