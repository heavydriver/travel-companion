import Elysia from "elysia";
import { authGuard } from "../../middleware/auth";
import { WeatherForecastQuery, WeatherForecastResponse } from "./model";
import { weatherService } from "./service";

export const weatherModule = new Elysia({ prefix: "/weather" })
  .use(authGuard)
  .get(
    "/forecast",
    async ({ query }) => {
      return weatherService.forecast({
        latitude: Number(query.latitude),
        longitude: Number(query.longitude),
        forecastDays: query.forecastDays !== undefined ? Number(query.forecastDays) : undefined,
        timezone: query.timezone,
      });
    },
    { query: WeatherForecastQuery, response: WeatherForecastResponse },
  );
