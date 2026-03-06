import Elysia, { t } from "elysia";
import { authGuard } from "../../middleware/auth";
import {
  CreateItemBody,
  UpdateItemBody,
  ReorderBody,
  ItemListResponse,
  ItemResponse,
  ReorderResponse,
  MessageResponse,
} from "./model";
import { itineraryService } from "./service";

export const itineraryModule = new Elysia()
  .use(authGuard)
  .get(
    "/trips/:tripId/itinerary-items",
    async ({ userId, params }) => {
      const items = await itineraryService.listByTrip(params.tripId, userId);
      return { items };
    },
    {
      params: t.Object({ tripId: t.String() }),
      response: ItemListResponse,
    }
  )
  .post(
    "/trips/:tripId/itinerary-items",
    async ({ userId, params, body, set }) => {
      const item = await itineraryService.create(params.tripId, userId, body);
      set.status = 201;
      return { item };
    },
    {
      params: t.Object({ tripId: t.String() }),
      body: CreateItemBody,
      response: { 201: ItemResponse },
    }
  )
  .patch(
    "/trips/:tripId/itinerary-items/reorder",
    async ({ userId, params, body }) => {
      const updated = await itineraryService.reorder(
        params.tripId,
        userId,
        body.items
      );
      return { updated };
    },
    {
      params: t.Object({ tripId: t.String() }),
      body: ReorderBody,
      response: ReorderResponse,
    }
  )
  .patch(
    "/itinerary-items/:id",
    async ({ userId, params, body }) => {
      const item = await itineraryService.update(params.id, userId, body);
      return { item };
    },
    {
      params: t.Object({ id: t.String() }),
      body: UpdateItemBody,
      response: ItemResponse,
    }
  )
  .delete(
    "/itinerary-items/:id",
    async ({ userId, params }) => {
      await itineraryService.remove(params.id, userId);
      return { message: "Item deleted" };
    },
    {
      params: t.Object({ id: t.String() }),
      response: MessageResponse,
    }
  );
