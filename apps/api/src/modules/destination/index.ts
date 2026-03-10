import Elysia, { t } from "elysia";
import { authGuard } from "../../middleware/auth";
import { DestinationListResponse, DestinationSearchQuery, PackVersionResponse } from "./model";
import { destinationService } from "./service";

export const destinationModule = new Elysia({ prefix: "/destinations" })
  .use(authGuard)
  .get(
    "/",
    async ({ query }) => {
      const destinations = await destinationService.search(query.q);
      return { destinations };
    },
    { query: DestinationSearchQuery, response: DestinationListResponse },
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
