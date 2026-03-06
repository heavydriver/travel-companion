import { t } from "elysia";

export const DestinationSearchQuery = t.Object({
  q: t.String({ minLength: 2 }),
});

export const DestinationListResponse = t.Object({
  destinations: t.Array(
    t.Object({
      id: t.String(),
      name: t.String(),
      country: t.String(),
      countryCode: t.String(),
      slug: t.String(),
    })
  ),
});

export const PackVersionResponse = t.Object({
  packVersion: t.Number(),
  updatedAt: t.String(),
});
