import { prisma } from "@repo/db";
import { AppError } from "../../middleware/errorHandler";
import { serverAnalytics } from "../../utils/analytics/posthog";

function formatItem(item: {
  id: string;
  tripId: string;
  placeId: string | null;
  title: string;
  notes: string | null;
  date: Date;
  startTime: string | null;
  endTime: string | null;
  order: number;
  isDone: boolean;
}) {
  return { ...item, date: item.date.toISOString() };
}

const itemSelect = {
  id: true,
  tripId: true,
  placeId: true,
  title: true,
  notes: true,
  date: true,
  startTime: true,
  endTime: true,
  order: true,
  isDone: true,
} as const;

async function verifyTripOwner(tripId: string, userId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { ownerId: true },
  });

  if (!trip || trip.ownerId !== userId) {
    throw new AppError(403, "FORBIDDEN", "Trip not found or access denied");
  }
}

export const itineraryService = {
  async listByTrip(tripId: string, userId: string) {
    await verifyTripOwner(tripId, userId);

    const items = await prisma.itineraryItem.findMany({
      where: { tripId },
      select: itemSelect,
      orderBy: [{ date: "asc" }, { order: "asc" }],
    });

    return items.map(formatItem);
  },

  async create(
    tripId: string,
    userId: string,
    data: {
      title: string;
      date: string;
      placeId?: string;
      startTime?: string;
      endTime?: string;
      notes?: string;
    }
  ) {
    await verifyTripOwner(tripId, userId);

    const maxOrder = await prisma.itineraryItem.aggregate({
      where: { tripId, date: new Date(data.date) },
      _max: { order: true },
    });
    const nextOrder = (maxOrder._max.order ?? -1) + 1;

    const item = await prisma.itineraryItem.create({
      data: {
        tripId,
        title: data.title,
        date: new Date(data.date),
        placeId: data.placeId ?? null,
        startTime: data.startTime ?? null,
        endTime: data.endTime ?? null,
        notes: data.notes ?? null,
        order: nextOrder,
      },
      select: itemSelect,
    });

    return formatItem(item);
  },

  async update(
    itemId: string,
    userId: string,
    data: {
      title?: string;
      date?: string;
      placeId?: string | null;
      startTime?: string | null;
      endTime?: string | null;
      notes?: string | null;
      isDone?: boolean;
    }
  ) {
    const item = await prisma.itineraryItem.findUnique({
      where: { id: itemId },
      select: { tripId: true },
    });

    if (!item) {
      throw new AppError(404, "NOT_FOUND", "Itinerary item not found");
    }

    await verifyTripOwner(item.tripId, userId);

    const updated = await prisma.itineraryItem.update({
      where: { id: itemId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.date !== undefined && { date: new Date(data.date) }),
        ...(data.placeId !== undefined && { placeId: data.placeId }),
        ...(data.startTime !== undefined && { startTime: data.startTime }),
        ...(data.endTime !== undefined && { endTime: data.endTime }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.isDone !== undefined && { isDone: data.isDone }),
      },
      select: itemSelect,
    });

    return formatItem(updated);
  },

  async remove(itemId: string, userId: string) {
    const item = await prisma.itineraryItem.findUnique({
      where: { id: itemId },
      select: { tripId: true },
    });

    if (!item) {
      throw new AppError(404, "NOT_FOUND", "Itinerary item not found");
    }

    await verifyTripOwner(item.tripId, userId);
    await prisma.itineraryItem.delete({ where: { id: itemId } });
  },

  async reorder(
    tripId: string,
    userId: string,
    items: { id: string; order: number; date?: string }[]
  ) {
    await verifyTripOwner(tripId, userId);

    const ids = items.map((i) => i.id);
    const existing = await prisma.itineraryItem.findMany({
      where: { id: { in: ids }, tripId },
      select: { id: true },
    });

    if (existing.length !== ids.length) {
      serverAnalytics.syncConflictDetected(userId, "reorder_missing_items");
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Some items do not belong to this trip"
      );
    }

    await prisma.$transaction(
      items.map((item) =>
        prisma.itineraryItem.update({
          where: { id: item.id },
          data: {
            order: item.order,
            ...(item.date && { date: new Date(item.date) }),
          },
        })
      )
    );

    return items.length;
  },
};
