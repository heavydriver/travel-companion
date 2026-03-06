import { prisma } from "@repo/db";
import { AppError } from "../../middleware/errorHandler";

export const destinationService = {
  async search(query: string) {
    const destinations = await prisma.destination.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { country: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        country: true,
        countryCode: true,
        slug: true,
      },
      take: 10,
      orderBy: { name: "asc" },
    });

    return destinations;
  },

  async getPackVersion(destinationId: string) {
    const destination = await prisma.destination.findUnique({
      where: { id: destinationId },
      select: { packVersion: true, updatedAt: true },
    });

    if (!destination) {
      throw new AppError(404, "NOT_FOUND", "Destination not found");
    }

    return {
      packVersion: destination.packVersion,
      updatedAt: destination.updatedAt.toISOString(),
    };
  },
};
