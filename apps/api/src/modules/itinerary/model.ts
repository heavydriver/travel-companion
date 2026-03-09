import { t } from "elysia";

export const CreateItemBody = t.Object({
  title: t.String({ minLength: 1, maxLength: 100 }),
  date: t.String({ format: "date-time" }),
  placeId: t.Optional(t.String()),
  startTime: t.Optional(t.String({ pattern: "^\\d{2}:\\d{2}$" })),
  endTime: t.Optional(t.String({ pattern: "^\\d{2}:\\d{2}$" })),
  notes: t.Optional(t.String({ maxLength: 500 })),
});

export const UpdateItemBody = t.Partial(
  t.Object({
    title: t.String({ minLength: 1, maxLength: 100 }),
    date: t.String({ format: "date-time" }),
    placeId: t.Nullable(t.String()),
    startTime: t.Nullable(t.String({ pattern: "^\\d{2}:\\d{2}$" })),
    endTime: t.Nullable(t.String({ pattern: "^\\d{2}:\\d{2}$" })),
    notes: t.Nullable(t.String({ maxLength: 500 })),
    isDone: t.Boolean(),
  })
);

export const ReorderBody = t.Object({
  items: t.Array(
    t.Object({
      id: t.String(),
      order: t.Number({ minimum: 0 }),
      date: t.Optional(t.String({ format: "date-time" })),
    })
  ),
});

const ItemShape = t.Object({
  id: t.String(),
  tripId: t.String(),
  placeId: t.Nullable(t.String()),
  title: t.String(),
  notes: t.Nullable(t.String()),
  date: t.String(),
  startTime: t.Nullable(t.String()),
  endTime: t.Nullable(t.String()),
  order: t.Number(),
  isDone: t.Boolean(),
});

export const ItemListResponse = t.Object({
  items: t.Array(ItemShape),
});

export const ItemResponse = t.Object({
  item: ItemShape,
});

export const ReorderResponse = t.Object({
  updated: t.Number(),
});

export const MessageResponse = t.Object({
  message: t.String(),
});
