import Elysia, { t } from "elysia";
import { authGuard } from "../../middleware/auth";
import {
  CreateTripBody,
  MessageResponse,
  TripListQuery,
  TripListResponse,
  TripResponse,
  UpdateTripBody,
} from "./model";
import { tripService } from "./service";

export const tripModule = new Elysia({ prefix: "/trips" })
  .use(authGuard)
  .get(
    "/",
    async ({ userId, query }) => {
      const trips = await tripService.list(userId, {
        destinationId: query.destinationId,
      });
      return { trips };
    },
    { query: TripListQuery, response: TripListResponse },
  )
  .post(
    "/",
    async ({ userId, body, set }) => {
      const trip = await tripService.create(userId, body);
      set.status = 201;
      return { trip };
    },
    { body: CreateTripBody, response: { 201: TripResponse } },
  )
  .get(
    "/:tripId",
    async ({ userId, params }) => {
      const trip = await tripService.getById(params.tripId, userId);
      return { trip };
    },
    {
      params: t.Object({ tripId: t.String() }),
      response: TripResponse,
    },
  )
  .patch(
    "/:tripId",
    async ({ userId, params, body }) => {
      const trip = await tripService.update(params.tripId, userId, body);
      return { trip };
    },
    {
      params: t.Object({ tripId: t.String() }),
      body: UpdateTripBody,
      response: TripResponse,
    },
  )
  .delete(
    "/:tripId",
    async ({ userId, params }) => {
      await tripService.remove(params.tripId, userId);
      return { message: "Trip deleted" };
    },
    {
      params: t.Object({ tripId: t.String() }),
      response: MessageResponse,
    },
  );
