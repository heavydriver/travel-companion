import { t } from "elysia";

export const DestinationSearchQuery = t.Object({
  q: t.Optional(t.String({ minLength: 1 })),
  isFeatured: t.Optional(t.BooleanString()),
  countryCode: t.Optional(t.String({ minLength: 2, maxLength: 2 })),
  adminCode: t.Optional(t.String({ minLength: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
  offset: t.Optional(t.Numeric({ minimum: 0 })),
});

export const DestinationSummaryShape = t.Object({
  id: t.String(),
  name: t.String(),
  country: t.String(),
  countryCode: t.String(),
  slug: t.String(),
  region: t.Nullable(t.String()),
  imageUrl: t.Nullable(t.String()),
  isFeatured: t.Boolean(),
  kind: t.Nullable(t.String()),
  adminCode: t.Nullable(t.String()),
  m49Code: t.Nullable(t.String()),
  searchAliases: t.Nullable(t.Any()),
});

export const DestinationListResponse = t.Object({
  destinations: t.Array(DestinationSummaryShape),
});

export const PopularDestinationSummaryShape = t.Object({
  id: t.String(),
  name: t.String(),
  country: t.String(),
  slug: t.String(),
  imageUrl: t.Nullable(t.String()),
  description: t.Nullable(t.String()),
  isFeatured: t.Boolean(),
});

export const PopularDestinationsResponse = t.Object({
  destinations: t.Array(PopularDestinationSummaryShape),
});

export const DestinationLanguageLinkShape = t.Object({
  id: t.String(),
  isPrimary: t.Boolean(),
  language: t.Object({
    id: t.String(),
    name: t.String(),
    isoCode: t.String(),
    nativeName: t.String(),
  }),
});

export const DestinationDetailResponse = t.Object({
  destination: t.Object({
    id: t.String(),
    name: t.String(),
    slug: t.String(),
    country: t.String(),
    countryCode: t.String(),
    region: t.Nullable(t.String()),
    description: t.Nullable(t.String()),
    latitude: t.Number(),
    longitude: t.Number(),
    timezone: t.String(),
    currencyCode: t.String(),
    imageUrl: t.Nullable(t.String()),
    bestTimeToVisit: t.Nullable(t.String()),
    emergencyNumber: t.Nullable(t.String()),
    packVersion: t.Number(),
    isFeatured: t.Boolean(),
    kind: t.Nullable(t.String()),
    adminCode: t.Nullable(t.String()),
    m49Code: t.Nullable(t.String()),
    searchAliases: t.Nullable(t.Any()),
    languages: t.Array(DestinationLanguageLinkShape),
  }),
  curatedPlaces: t.Array(
    t.Object({
      id: t.String(),
      destinationId: t.String(),
      name: t.String(),
      slug: t.String(),
      category: t.String(),
      description: t.Nullable(t.String()),
      latitude: t.Number(),
      longitude: t.Number(),
      imageUrl: t.Nullable(t.String()),
      rating: t.Nullable(t.Number()),
      reviewCount: t.Nullable(t.Number()),
      isCurated: t.Boolean(),
      isFeatured: t.Boolean(),
      priceLevel: t.Nullable(t.Number()),
      address: t.Nullable(t.String()),
      city: t.Nullable(t.String()),
    })
  ),
  otherPlaces: t.Array(
    t.Object({
      id: t.String(),
      destinationId: t.String(),
      name: t.String(),
      slug: t.String(),
      category: t.String(),
      description: t.Nullable(t.String()),
      latitude: t.Number(),
      longitude: t.Number(),
      imageUrl: t.Nullable(t.String()),
      rating: t.Nullable(t.Number()),
      reviewCount: t.Nullable(t.Number()),
      isCurated: t.Boolean(),
      isFeatured: t.Boolean(),
      priceLevel: t.Nullable(t.Number()),
      address: t.Nullable(t.String()),
      city: t.Nullable(t.String()),
    })
  ),
});

export const PackVersionResponse = t.Object({
  packVersion: t.Number(),
  updatedAt: t.String(),
});
