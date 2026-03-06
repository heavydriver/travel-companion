import { t } from "elysia";

export const OfflinePackResponse = t.Object({
  destination: t.Object({
    id: t.String(),
    name: t.String(),
    country: t.String(),
    countryCode: t.String(),
    latitude: t.Number(),
    longitude: t.Number(),
    timezone: t.String(),
  }),
  places: t.Array(
    t.Object({
      id: t.String(),
      name: t.String(),
      category: t.String(),
      description: t.Nullable(t.String()),
      latitude: t.Number(),
      longitude: t.Number(),
      address: t.Nullable(t.String()),
      imageUrl: t.Nullable(t.String()),
      rating: t.Nullable(t.Number()),
      isCurated: t.Boolean(),
    })
  ),
  phrases: t.Array(
    t.Object({
      id: t.String(),
      category: t.String(),
      originalText: t.String(),
      latinSpelling: t.Nullable(t.String()),
      englishText: t.String(),
    })
  ),
  mapTileUrl: t.Nullable(t.String()),
  packVersion: t.Number(),
});
