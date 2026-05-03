import Elysia, { t } from "elysia";
import { authGuard } from "../../middleware/auth";
import {
  DestinationDetailResponse,
  DestinationListResponse,
  DestinationSearchQuery,
  PackVersionResponse,
  PopularDestinationsResponse,
  ResolveDestinationBody,
  ResolveDestinationResponse,
} from "./model";
import { destinationService } from "./service";

export const destinationModule = new Elysia({ prefix: "/destinations" })
  .use(authGuard)
  .get(
    "/",
    async ({ query }) => {
      const destinations = await destinationService.search(query);
      return { destinations };
    },
    { query: DestinationSearchQuery, response: DestinationListResponse },
  )
  .get(
    "/popular",
    async () => {
      const destinations = await destinationService.getPopular();
      return { destinations };
    },
    { response: PopularDestinationsResponse },
  )
  .post(
    "/resolve",
    async ({ body, set }) => {
      const resolved = await destinationService.resolve(body);
      set.status = resolved.resolvedBy === "existing" ? 200 : 201;
      return resolved;
    },
    {
      body: ResolveDestinationBody,
      response: {
        200: ResolveDestinationResponse,
        201: ResolveDestinationResponse,
      },
    },
  )
  .get(
    "/:destId",
    async ({ params }) => {
      return destinationService.getById(params.destId);
    },
    {
      params: t.Object({ destId: t.String() }),
      response: DestinationDetailResponse,
    },
  )
  .get(
    "/:destId/pack-version",
    async ({ params }) => {
      return destinationService.getPackVersion(params.destId);
    },
    {
      params: t.Object({ destId: t.String() }),
      response: PackVersionResponse,
    },
  );
