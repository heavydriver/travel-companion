import Elysia, { t } from "elysia";
import { authGuard } from "../../middleware/auth";
import {
  DestinationDetailResponse,
  DestinationListResponse,
  DestinationSearchQuery,
  PackVersionResponse,
  PopularDestinationsResponse,
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
