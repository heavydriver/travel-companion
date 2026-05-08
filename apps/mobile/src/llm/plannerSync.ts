import { client } from "@/api/client";
import {
  insertOptimisticPlannerTrip,
  replaceOptimisticPlannerTrip,
  type LocalItineraryItem,
} from "@/lib/assistantLocalSync";
import type { PlannerProposal } from "@/llm/plannerSchema";
import { useAssistantStore, type PendingPlannerOperation } from "@/store/assistantStore";
import type { Trip } from "@/store/tripStore";

let activeSyncPromise: Promise<void> | null = null;

async function resolveDestinationId(operation: PendingPlannerOperation) {
  if (operation.proposal.destinationId) {
    return operation.proposal.destinationId;
  }

  if (operation.destinationId) {
    return operation.destinationId;
  }

  const response = await client.api.v1.destinations.resolve.post({
    query: operation.proposal.destinationName,
    country: operation.proposal.country ?? undefined,
    countryCode: operation.proposal.countryCode ?? undefined,
    currencyCode: operation.proposal.currencyCode ?? undefined,
  });

  if (response.error || !response.data?.destination?.id) {
    throw new Error("Could not resolve destination for planner trip");
  }

  return response.data.destination.id;
}

async function createTripFromProposal(destinationId: string, proposal: PlannerProposal) {
  const response = await client.api.v1.trips.post({
    destinationId,
    title: proposal.title,
    description: proposal.summary,
    startDate: proposal.startDate ?? new Date().toISOString(),
    endDate: proposal.endDate ?? proposal.startDate ?? new Date().toISOString(),
    budget: proposal.budget ?? undefined,
    currencyCode: proposal.currencyCode ?? undefined,
  });

  if (response.error || !response.data?.trip) {
    throw new Error("Could not create trip from planner proposal");
  }

  return response.data.trip as Trip;
}

async function createItineraryItems(tripId: string, proposal: PlannerProposal) {
  const createdItems: LocalItineraryItem[] = [];

  for (const item of proposal.itineraryItems) {
    const response = await client.api.v1.trips({ tripId })["itinerary-items"].post({
      title: item.title,
      date: item.date,
      placeId: item.placeId ?? undefined,
      startTime: item.startTime ?? undefined,
      endTime: item.endTime ?? undefined,
      notes: item.notes ?? undefined,
    });

    if (response.error || !response.data?.item) {
      throw new Error(`Could not create itinerary item "${item.title}"`);
    }

    createdItems.push(response.data.item as LocalItineraryItem);
  }

  return createdItems;
}

export function queuePlannerProposal(operation: PendingPlannerOperation) {
  return insertOptimisticPlannerTrip(operation.tempTripId, operation.proposal);
}

export async function syncPendingPlannerOperations() {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    const store = useAssistantStore.getState();
    const operations = store.pendingPlannerOperations.filter(
      (operation) => operation.status === "pending" || operation.status === "failed",
    );

    for (const operation of operations) {
      try {
        await useAssistantStore.getState().markPlannerOperationSyncing(operation.id);
        const destinationId = await resolveDestinationId(operation);
        const trip = await createTripFromProposal(destinationId, operation.proposal);
        const items = await createItineraryItems(trip.id, operation.proposal);
        replaceOptimisticPlannerTrip(operation.tempTripId, trip, items);
        await useAssistantStore.getState().removePlannerOperation(operation.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Planner sync failed";
        await useAssistantStore.getState().markPlannerOperationFailed(operation.id, message);
      }
    }
  })();

  try {
    await activeSyncPromise;
  } finally {
    activeSyncPromise = null;
  }
}
