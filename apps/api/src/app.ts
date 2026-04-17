import Elysia from "elysia";
import { errorHandler } from "./middleware/errorHandler";
import { authModule } from "./modules/auth";
import { currencyModule } from "./modules/currency";
import { destinationModule } from "./modules/destination";
import { itineraryModule } from "./modules/itinerary";
import { languageModule } from "./modules/language";
import { messageModule } from "./modules/message";
import { offlineModule } from "./modules/offline";
import { placeModule } from "./modules/place";
import { connectionModule, socialModule } from "./modules/social";
import { tripModule } from "./modules/trip";
import { userModule } from "./modules/user";
import { weatherModule } from "./modules/weather";

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
  .use(weatherModule)
  .use(currencyModule)
  .use(socialModule)
  .use(connectionModule)
  .use(messageModule);

export type App = typeof app;
