import Elysia from "elysia";
import { errorHandler } from "./middleware/errorHandler";
import { authModule } from "./modules/auth";
import { destinationModule } from "./modules/destination";
import { itineraryModule } from "./modules/itinerary";
import { languageModule } from "./modules/language";
import { messageModule } from "./modules/message";
import { offlineModule } from "./modules/offline";
import { placeModule } from "./modules/place";
import { connectionModule, socialModule } from "./modules/social";
import { tripModule } from "./modules/trip";
import { userModule } from "./modules/user";

export const app = new Elysia({ prefix: "/api/v1" })
  // .use(cors({ origin: config.frontendUrl, credentials: true }))
  .use(errorHandler)
  .get("/health", () => ({ status: "ok" }))
  .use(authModule)
  .use(userModule)
  .use(destinationModule)
  .use(tripModule)
  .use(itineraryModule)
  .use(placeModule)
  .use(offlineModule)
  .use(languageModule)
  .use(socialModule)
  .use(connectionModule)
  .use(messageModule);

export type App = typeof app;
