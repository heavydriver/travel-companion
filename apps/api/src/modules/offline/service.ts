import { prisma } from "@repo/db";
import { AppError } from "../../middleware/errorHandler";

export const offlineService = {
  async getCityPack(destinationId: string) {
    const destination = await prisma.destination.findUnique({
      where: { id: destinationId },
      select: {
        id: true,
        name: true,
        country: true,
        countryCode: true,
        latitude: true,
        longitude: true,
        timezone: true,
        packVersion: true,
      },
    });

    if (!destination) {
      throw new AppError(404, "NOT_FOUND", "Destination not found");
    }

    const places = await prisma.place.findMany({
      where: { destinationId },
      select: {
        id: true,
        name: true,
        category: true,
        description: true,
        latitude: true,
        longitude: true,
        address: true,
        imageUrl: true,
        rating: true,
        isCurated: true,
      },
    });

    const phrases = await prisma.phrase.findMany({
      where: { destinationId },
      select: {
        id: true,
        category: true,
        originalText: true,
        latinSpelling: true,
        englishText: true,
      },
    });

    const { packVersion, ...destData } = destination;

    return {
      destination: destData,
      places,
      phrases,
      mapTileUrl: null, // Mapbox tile URL generation added in Phase 5 CDN setup
      packVersion,
    };
  },
};
