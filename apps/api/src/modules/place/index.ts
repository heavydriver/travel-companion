import Elysia, { t } from "elysia";
import { authGuard } from "../../middleware/auth";
import { PlaceQueryParams, PlaceListResponse, PlaceDetailResponse } from "./model";
import { placeService } from "./service";

export const placeModule = new Elysia()
  .use(authGuard)
  .get(
    "/destinations/:destId/places",
    async ({ params, query }) => {
      const places = await placeService.listByDestination(params.destId, query);
      return { places };
    },
    {
      params: t.Object({ destId: t.String() }),
      query: PlaceQueryParams,
      response: PlaceListResponse,
    }
  )
  .get(
    "/places/:id",
    async ({ params }) => {
      const place = await placeService.getById(params.id);
      return { place };
    },
    {
      params: t.Object({ id: t.String() }),
      response: PlaceDetailResponse,
    }
  );
