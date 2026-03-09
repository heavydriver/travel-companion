import Elysia, { t } from "elysia";
import { authGuard } from "../../middleware/auth";
import {
  CreateTripBody,
  UpdateTripBody,
  TripListResponse,
  TripResponse,
  MessageResponse,
} from "./model";
import { tripService } from "./service";

export const tripModule = new Elysia({ prefix: "/trips" })
  .use(authGuard)
  .get(
    "/",
    async ({ userId }) => {
      const trips = await tripService.list(userId);
      return { trips };
    },
    { response: TripListResponse }
  )
  .post(
    "/",
    async ({ userId, body, set }) => {
      const trip = await tripService.create(userId, body);
      set.status = 201;
      return { trip };
    },
    { body: CreateTripBody, response: { 201: TripResponse } }
  )
  .get(
    "/:id",
    async ({ userId, params }) => {
      const trip = await tripService.getById(params.id, userId);
      return { trip };
    },
    {
      params: t.Object({ id: t.String() }),
      response: TripResponse,
    }
  )
  .patch(
    "/:id",
    async ({ userId, params, body }) => {
      const trip = await tripService.update(params.id, userId, body);
      return { trip };
    },
    {
      params: t.Object({ id: t.String() }),
      body: UpdateTripBody,
      response: TripResponse,
    }
  )
  .delete(
    "/:id",
    async ({ userId, params }) => {
      await tripService.remove(params.id, userId);
      return { message: "Trip deleted" };
    },
    {
      params: t.Object({ id: t.String() }),
      response: MessageResponse,
    }
  );
