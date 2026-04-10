import Elysia, { t } from "elysia";
import { authGuard } from "../../middleware/auth";
import {
  NearbyPlaceListResponse,
  NearbyPlaceQueryParams,
  PlaceDetailResponse,
  PlaceListResponse,
  PlaceQueryParams,
} from "./model";
import { placeService } from "./service";

export const placeModule = new Elysia()
  .use(authGuard)
  .get(
    "/places/nearby",
    async ({ query }) => {
      const places = await placeService.nearby(query);
      return { places };
    },
    {
      query: NearbyPlaceQueryParams,
      response: NearbyPlaceListResponse,
    }
  )
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
