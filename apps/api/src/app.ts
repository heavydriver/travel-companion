import Elysia from "elysia";
import { prisma } from "@repo/db";
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
import { apiCache } from "./utils/cache";
import { getHealthSnapshot, observabilityPlugin } from "./observability";

export const app = new Elysia({ prefix: "/api/v1" })
  // .use(cors({ origin: config.frontendUrl, credentials: true }))
  .use(observabilityPlugin)
  .use(errorHandler)
  .get("/health", () => ({
    ...getHealthSnapshot(),
    status: "ok",
    cacheEntries: apiCache.size
  }))
  .get("/health/live", () => ({
    ...getHealthSnapshot(),
    status: "ok",
  }))
  .get("/health/ready", async ({ set }) => {
    try {
      await prisma.$queryRaw`SELECT 1`;

      return {
        ...getHealthSnapshot(),
        checks: {
          database: "ok",
        },
        status: "ok",
      };
    } catch (error) {
      set.status = 503;

      return {
        ...getHealthSnapshot(),
        checks: {
          database: "error",
        },
        error: error instanceof Error ? error.message : "Database check failed",
        status: "degraded",
      };
    }
  })
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
