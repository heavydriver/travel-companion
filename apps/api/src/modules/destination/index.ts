import Elysia, { t } from "elysia";
import { authGuard } from "../../middleware/auth";
import {
  DestinationSearchQuery,
  DestinationListResponse,
  PackVersionResponse,
} from "./model";
import { destinationService } from "./service";

export const destinationModule = new Elysia({ prefix: "/destinations" })
  .use(authGuard)
  .get(
    "/",
    async ({ query }) => {
      const destinations = await destinationService.search(query.q);
      return { destinations };
    },
    { query: DestinationSearchQuery, response: DestinationListResponse }
  )
  .get(
    "/:id/pack-version",
    async ({ params }) => {
      return destinationService.getPackVersion(params.id);
    },
    {
      params: t.Object({ id: t.String() }),
      response: PackVersionResponse,
    }
  );
