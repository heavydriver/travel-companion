import { t } from "elysia";

export const PlaceQueryParams = t.Object({
  category: t.Optional(t.String()),
  isCurated: t.Optional(t.String()),
});

export const PlaceListItemShape = t.Object({
  id: t.String(),
  destinationId: t.String(),
  googlePlaceId: t.Nullable(t.String()),
  name: t.String(),
  slug: t.String(),
  category: t.String(),
  description: t.Nullable(t.String()),
  latitude: t.Number(),
  longitude: t.Number(),
  address: t.Nullable(t.String()),
  city: t.Nullable(t.String()),
  imageUrl: t.Nullable(t.String()),
  rating: t.Nullable(t.Number()),
  reviewCount: t.Nullable(t.Number()),
  isCurated: t.Boolean(),
  isFeatured: t.Boolean(),
  openingHours: t.Nullable(t.Any()),
});

export const NearbyPlaceQueryParams = t.Object({
  lat: t.Number({ minimum: -90, maximum: 90 }),
  lng: t.Number({ minimum: -180, maximum: 180 }),
  radiusKm: t.Optional(t.Numeric({ minimum: 0.1, maximum: 200 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
  category: t.Optional(t.String()),
  isCurated: t.Optional(t.String()),
});

export const PlaceListResponse = t.Object({
  places: t.Array(PlaceListItemShape),
});

export const NearbyPlaceListResponse = t.Object({
  places: t.Array(
    t.Composite([
      PlaceListItemShape,
      t.Object({
        distanceKm: t.Number(),
      }),
    ])
  ),
});

export const PlaceDetailResponse = t.Object({
  place: t.Object({
    id: t.String(),
    destinationId: t.String(),
    googlePlaceId: t.Nullable(t.String()),
    name: t.String(),
    slug: t.String(),
    category: t.String(),
    description: t.Nullable(t.String()),
    latitude: t.Number(),
    longitude: t.Number(),
    address: t.Nullable(t.String()),
    city: t.Nullable(t.String()),
    imageUrl: t.Nullable(t.String()),
    websiteUrl: t.Nullable(t.String()),
    phoneNumber: t.Nullable(t.String()),
    priceLevel: t.Nullable(t.Number()),
    rating: t.Nullable(t.Number()),
    reviewCount: t.Nullable(t.Number()),
    openingHours: t.Nullable(t.Any()),
    isCurated: t.Boolean(),
    isFeatured: t.Boolean(),
    createdAt: t.String(),
    updatedAt: t.String(),
  }),
});
