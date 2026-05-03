import { prisma } from "@repo/db";
import { AppError } from "../../middleware/errorHandler";

const tripSelect = {
  id: true,
  title: true,
  description: true,
  startDate: true,
  endDate: true,
  budget: true,
  currencyCode: true,
  coverImageUrl: true,
  createdAt: true,
  destination: {
    select: { id: true, name: true, countryCode: true },
  },
} as const;

function formatTrip(trip: {
  id: string;
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  budget: number | null;
  currencyCode: string | null;
  coverImageUrl: string | null;
  createdAt: Date;
  destination: { id: string; name: string; countryCode: string };
}) {
  return {
    ...trip,
    startDate: trip.startDate.toISOString(),
    endDate: trip.endDate.toISOString(),
    createdAt: trip.createdAt.toISOString(),
  };
}

export const tripService = {
  async list(userId: string, filters?: { destinationId?: string }) {
    const trips = await prisma.trip.findMany({
      where: {
        ownerId: userId,
        deletedAt: null,
        ...(filters?.destinationId
          ? { destinationId: filters.destinationId }
          : {}),
      },
      select: tripSelect,
      orderBy: { startDate: "desc" },
    });

    return trips.map(formatTrip);
  },

  async getById(tripId: string, userId: string) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { ...tripSelect, ownerId: true },
    });

    if (!trip || trip.ownerId !== userId) {
      throw new AppError(403, "FORBIDDEN", "Trip not found or access denied");
    }

    const { ownerId: _, ...rest } = trip;
    return formatTrip(rest);
  },

  async create(
    userId: string,
    data: {
      destinationId: string;
      title: string;
      startDate: string;
      endDate: string;
      description?: string;
      budget?: number;
      currencyCode?: string;
    }
  ) {
    if (new Date(data.endDate) < new Date(data.startDate)) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "endDate must be >= startDate"
      );
    }

    const destination = await prisma.destination.findUnique({
      where: { id: data.destinationId },
    });
    if (!destination) {
      throw new AppError(404, "NOT_FOUND", "Destination not found");
    }

    const trip = await prisma.trip.create({
      data: {
        ownerId: userId,
        destinationId: data.destinationId,
        title: data.title,
        description: data.description?.trim() || null,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        budget: data.budget ?? null,
        currencyCode: data.currencyCode?.trim().toUpperCase() || destination.currencyCode,
      },
      select: tripSelect,
    });

    return formatTrip(trip);
  },

  async update(
    tripId: string,
    userId: string,
    data: {
      title?: string;
      startDate?: string;
      endDate?: string;
      description?: string | null;
      budget?: number | null;
      currencyCode?: string | null;
      coverImageUrl?: string | null;
    }
  ) {
    const existing = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { ownerId: true, startDate: true, endDate: true },
    });

    if (!existing || existing.ownerId !== userId) {
      throw new AppError(403, "FORBIDDEN", "Trip not found or access denied");
    }

    const startDate = data.startDate
      ? new Date(data.startDate)
      : existing.startDate;
    const endDate = data.endDate ? new Date(data.endDate) : existing.endDate;

    if (endDate < startDate) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "endDate must be >= startDate"
      );
    }

    const trip = await prisma.trip.update({
      where: { id: tripId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description?.trim() || null }),
        ...(data.startDate !== undefined && { startDate }),
        ...(data.endDate !== undefined && { endDate }),
        ...(data.budget !== undefined && { budget: data.budget }),
        ...(data.currencyCode !== undefined && {
          currencyCode: data.currencyCode?.trim().toUpperCase() || null,
        }),
        ...(data.coverImageUrl !== undefined && {
          coverImageUrl: data.coverImageUrl,
        }),
      },
      select: tripSelect,
    });

    return formatTrip(trip);
  },

  async remove(tripId: string, userId: string) {
    const existing = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { ownerId: true },
    });

    if (!existing || existing.ownerId !== userId) {
      throw new AppError(403, "FORBIDDEN", "Trip not found or access denied");
    }

    await prisma.trip.delete({ where: { id: tripId } });
  },
};
