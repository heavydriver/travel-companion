import { t } from "elysia";

export const TripListQuery = t.Object({
  destinationId: t.Optional(t.String()),
});

export const CreateTripBody = t.Object({
  destinationId: t.String(),
  title: t.String({ minLength: 1, maxLength: 100 }),
  startDate: t.String({ format: "date-time" }),
  endDate: t.String({ format: "date-time" }),
  description: t.Optional(t.String({ maxLength: 1000 })),
  budget: t.Optional(t.Number({ minimum: 0 })),
  currencyCode: t.Optional(t.String({ minLength: 3, maxLength: 3 })),
});

export const UpdateTripBody = t.Partial(
  t.Object({
    title: t.String({ minLength: 1, maxLength: 100 }),
    startDate: t.String({ format: "date-time" }),
    endDate: t.String({ format: "date-time" }),
    description: t.Nullable(t.String({ maxLength: 1000 })),
    budget: t.Nullable(t.Number({ minimum: 0 })),
    currencyCode: t.Nullable(t.String({ minLength: 3, maxLength: 3 })),
    coverImageUrl: t.Nullable(t.String()),
  })
);

const TripShape = t.Object({
  id: t.String(),
  title: t.String(),
  startDate: t.String(),
  endDate: t.String(),
  description: t.Nullable(t.String()),
  budget: t.Nullable(t.Number()),
  currencyCode: t.Nullable(t.String()),
  coverImageUrl: t.Nullable(t.String()),
  createdAt: t.String(),
  destination: t.Object({
    id: t.String(),
    name: t.String(),
    countryCode: t.String(),
  }),
});

export const TripListResponse = t.Object({
  trips: t.Array(TripShape),
});

export const TripResponse = t.Object({
  trip: TripShape,
});

export const MessageResponse = t.Object({
  message: t.String(),
});
