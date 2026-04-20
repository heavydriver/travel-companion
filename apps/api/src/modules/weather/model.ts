import { t } from "elysia";

export const WeatherForecastQuery = t.Object({
  latitude: t.Numeric({ minimum: -90, maximum: 90 }),
  longitude: t.Numeric({ minimum: -180, maximum: 180 }),
  forecastDays: t.Optional(t.Numeric({ minimum: 1, maximum: 16 })),
  timezone: t.Optional(t.String()),
});

export const WeatherForecastResponse = t.Any();
