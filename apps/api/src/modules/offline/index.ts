import Elysia, { t } from "elysia";
import { authGuard } from "../../middleware/auth";
import { OfflinePackResponse } from "./model";
import { offlineService } from "./service";

export const offlineModule = new Elysia()
  .use(authGuard)
  .get(
    "/offline-pack/:destinationId",
    async ({ params }) => {
      return offlineService.getCityPack(params.destinationId);
    },
    {
      params: t.Object({ destinationId: t.String() }),
      response: OfflinePackResponse,
    }
  );
