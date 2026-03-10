import { t } from "elysia";

export const PlaceQueryParams = t.Object({
  category: t.Optional(t.String()),
  isCurated: t.Optional(t.String()),
});

const PlaceShape = t.Object({
  id: t.String(),
  name: t.String(),
  slug: t.String(),
  category: t.String(),
  description: t.Nullable(t.String()),
  latitude: t.Number(),
  longitude: t.Number(),
  address: t.Nullable(t.String()),
  imageUrl: t.Nullable(t.String()),
  rating: t.Nullable(t.Number()),
  isCurated: t.Boolean(),
});

export const PlaceListResponse = t.Object({
  places: t.Array(PlaceShape),
});

export const PlaceDetailResponse = t.Object({
  place: t.Intersect([
    PlaceShape,
    t.Object({
      websiteUrl: t.Nullable(t.String()),
      phoneNumber: t.Nullable(t.String()),
      priceLevel: t.Nullable(t.Number()),
      reviewCount: t.Nullable(t.Number()),
      isFeatured: t.Boolean(),
    }),
  ]),
});
