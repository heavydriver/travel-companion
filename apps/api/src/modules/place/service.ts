import { prisma } from "@repo/db";
import { AppError } from "../../middleware/errorHandler";
import { config } from "../../utils/config";

const listSelect = {
  id: true,
  destinationId: true,
  googlePlaceId: true,
  name: true,
  slug: true,
  category: true,
  description: true,
  latitude: true,
  longitude: true,
  address: true,
  city: true,
  imageUrl: true,
  rating: true,
  reviewCount: true,
  isCurated: true,
  isFeatured: true,
  openingHours: true,
} as const;

const cdnBaseUrl = config.cdnBaseUrl.endsWith("/")
  ? config.cdnBaseUrl.slice(0, -1)
  : config.cdnBaseUrl;

function withCdnImageUrl<
  T extends {
    destinationId: string;
    imageUrl: string | null;
  },
>(place: T): T {
  if (!place.imageUrl || !cdnBaseUrl) {
    return place;
  }
  if (/^https?:\/\//i.test(place.imageUrl)) {
    return place;
  }

  const normalizedPath = place.imageUrl.startsWith("/")
    ? place.imageUrl
    : `/${place.imageUrl}`;
  const prefix = `/${place.destinationId}/`;
  const relativePath = normalizedPath.startsWith(prefix)
    ? normalizedPath
    : `/${place.destinationId}${normalizedPath}`;

  return {
    ...place,
    imageUrl: `${cdnBaseUrl}${relativePath}`,
  };
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function radiusToBoundingBox(lat: number, lng: number, radiusKm: number) {
  const earthRadiusKm = 6371;
  const latDelta = (radiusKm / earthRadiusKm) * (180 / Math.PI);
  const lngDelta =
    ((radiusKm / earthRadiusKm) * (180 / Math.PI)) / Math.max(Math.cos(toRadians(lat)), 0.01);
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

export const placeService = {
  async listByDestination(
    destinationId: string,
    filters: { category?: string; isCurated?: string },
  ) {
    const where: Record<string, unknown> = { destinationId };

    if (filters.category) {
      where.category = filters.category;
    }
    if (filters.isCurated === "true") {
      where.isCurated = true;
    }
    if (filters.isCurated === "false") {
      where.isCurated = false;
    }

    const places = await prisma.place.findMany({
      where,
      select: listSelect,
      orderBy: [{ isCurated: "desc" }, { rating: "desc" }],
    });

    return places.map(withCdnImageUrl);
  },

  async nearby(filters: {
    lat: number;
    lng: number;
    radiusKm?: number;
    limit?: number;
    category?: string;
    isCurated?: string;
  }) {
    const radiusKm = Math.min(Math.max(Number(filters.radiusKm ?? 25), 0.1), 200);
    const limit = Math.min(Math.max(Number(filters.limit ?? 20), 1), 100);
    const bounds = radiusToBoundingBox(filters.lat, filters.lng, radiusKm);
    const where: Record<string, unknown> = {
      latitude: { gte: bounds.minLat, lte: bounds.maxLat },
      longitude: { gte: bounds.minLng, lte: bounds.maxLng },
    };

    if (filters.category) {
      where.category = filters.category;
    }
    if (filters.isCurated === "true") {
      where.isCurated = true;
    }
    if (filters.isCurated === "false") {
      where.isCurated = false;
    }

    const candidates = await prisma.place.findMany({
      where,
      select: listSelect,
      take: limit * 5,
      orderBy: [{ isCurated: "desc" }, { rating: "desc" }],
    });

    return candidates
      .map((place) => {
        const distanceKm = haversineDistanceKm(
          filters.lat,
          filters.lng,
          place.latitude,
          place.longitude,
        );
        return {
          ...withCdnImageUrl(place),
          distanceKm,
        };
      })
      .filter((place) => place.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);
  },

  async getById(placeId: string) {
    const place = await prisma.place.findUnique({
      where: { id: placeId },
    });

    if (!place) {
      throw new AppError(404, "NOT_FOUND", "Place not found");
    }

    return withCdnImageUrl({
      ...place,
      createdAt: place.createdAt.toISOString(),
      updatedAt: place.updatedAt.toISOString(),
    });
  },
};
