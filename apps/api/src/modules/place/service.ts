import { prisma } from "@repo/db";
import { AppError } from "../../middleware/errorHandler";

const listSelect = {
  id: true,
  name: true,
  slug: true,
  category: true,
  description: true,
  latitude: true,
  longitude: true,
  address: true,
  imageUrl: true,
  rating: true,
  isCurated: true,
} as const;

export const placeService = {
  async listByDestination(
    destinationId: string,
    filters: { category?: string; isCurated?: string }
  ) {
    const where: Record<string, unknown> = { destinationId };

    if (filters.category) {
      where.category = filters.category;
    }
    if (filters.isCurated === "true") {
      where.isCurated = true;
    }

    return prisma.place.findMany({
      where,
      select: listSelect,
      orderBy: [{ isCurated: "desc" }, { rating: "desc" }],
    });
  },

  async getById(placeId: string) {
    const place = await prisma.place.findUnique({
      where: { id: placeId },
      select: {
        ...listSelect,
        websiteUrl: true,
        phoneNumber: true,
        priceLevel: true,
        reviewCount: true,
        isFeatured: true,
      },
    });

    if (!place) {
      throw new AppError(404, "NOT_FOUND", "Place not found");
    }

    return place;
  },
};
