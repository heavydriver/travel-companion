import { t } from "elysia";

export const TripListQuery = t.Object({
  destinationId: t.Optional(t.String()),
});

export const CreateTripBody = t.Object({
  destinationId: t.String(),
  title: t.String({ minLength: 1, maxLength: 100 }),
  startDate: t.String({ format: "date-time" }),
  endDate: t.String({ format: "date-time" }),
});

export const UpdateTripBody = t.Partial(
  t.Object({
    title: t.String({ minLength: 1, maxLength: 100 }),
    startDate: t.String({ format: "date-time" }),
    endDate: t.String({ format: "date-time" }),
    coverImageUrl: t.Nullable(t.String()),
  })
);

const TripShape = t.Object({
  id: t.String(),
  title: t.String(),
  startDate: t.String(),
  endDate: t.String(),
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
