import Elysia, { t } from "elysia";
import { authGuard } from "../../middleware/auth";
import {
  ConnectionResponse,
  ConnectionsListResponse,
  CreateConnectionBody,
  NearbyTravelersResponse,
  PatchConnectionBody,
} from "./model";
import { connectionService, socialService } from "./service";

export const socialModule = new Elysia({ prefix: "/social" })
  .use(authGuard)
  .get("/nearby", async ({ userId }) => socialService.getNearby(userId), {
    response: NearbyTravelersResponse,
  });

export const connectionModule = new Elysia({ prefix: "/connections" })
  .use(authGuard)
  .get("/", async ({ userId }) => connectionService.list(userId), {
    response: ConnectionsListResponse,
  })
  .post(
    "/",
    async ({ userId, body, set }) => {
      const result = await connectionService.create(userId, body.receiverId);
      set.status = 201;
      return result;
    },
    { body: CreateConnectionBody, response: { 201: ConnectionResponse } },
  )
  .patch(
    "/:connectionId",
    async ({ userId, params, body }) =>
      connectionService.updateStatus(userId, params.connectionId, body.status),
    {
      params: t.Object({ connectionId: t.String() }),
      body: PatchConnectionBody,
      response: ConnectionResponse,
    },
  );
