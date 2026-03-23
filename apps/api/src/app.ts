import Elysia from "elysia";
import { errorHandler } from "./middleware/errorHandler";
import { authModule } from "./modules/auth";
import { destinationModule } from "./modules/destination";
import { itineraryModule } from "./modules/itinerary";
import { languageModule } from "./modules/language";
import { offlineModule } from "./modules/offline";
import { placeModule } from "./modules/place";
import { tripModule } from "./modules/trip";

export const app = new Elysia({ prefix: "/api/v1" })
  // .use(cors({ origin: config.frontendUrl, credentials: true }))
  .use(errorHandler)
  .get("/health", () => ({ status: "ok" }))
  .use(authModule)
  .use(destinationModule)
  .use(tripModule)
  .use(itineraryModule)
  .use(placeModule)
  .use(offlineModule)
  .use(languageModule);

export type App = typeof app;
