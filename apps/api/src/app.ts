import Elysia from "elysia";
import cors from "@elysiajs/cors";
import { config } from "./utils/config";
import { errorHandler } from "./middleware/errorHandler";
import { authModule } from "./modules/auth";
import { tripModule } from "./modules/trip";
import { destinationModule } from "./modules/destination";
import { itineraryModule } from "./modules/itinerary";
import { placeModule } from "./modules/place";
import { offlineModule } from "./modules/offline";

export const app = new Elysia({ prefix: "/api/v1" })
  .use(cors({ origin: config.frontendUrl, credentials: true }))
  .use(errorHandler)
  .get("/health", () => ({ status: "ok" }))
  .use(authModule)
  .use(destinationModule)
  .use(tripModule)
  .use(itineraryModule)
  .use(placeModule)
  .use(offlineModule);

export type App = typeof app;
