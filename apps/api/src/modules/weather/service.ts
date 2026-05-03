import { apiCache } from "../../utils/cache";
import { AppError } from "../../middleware/errorHandler";

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

const CURRENT =
  "temperature_2m,precipitation,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m";
const DAILY =
  "sunrise,sunset,weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant";

export const weatherService = {
  async forecast(input: {
    latitude: number;
    longitude: number;
    forecastDays?: number;
    timezone?: string;
  }) {
    const days = Math.min(
      16,
      Math.max(1, Math.round(Number(input.forecastDays ?? 7))),
    );
    const tz = input.timezone?.trim() || "auto";

    const url = new URL(OPEN_METEO);
    url.searchParams.set("latitude", String(input.latitude));
    url.searchParams.set("longitude", String(input.longitude));
    url.searchParams.set("forecast_days", String(days));
    url.searchParams.set("timezone", tz);
    url.searchParams.set("current", CURRENT);
    url.searchParams.set("daily", DAILY);

    const cacheKey = `weather:${input.latitude}:${input.longitude}:${days}:${tz}`;
    return apiCache.getOrSet(cacheKey, async () => {
      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new AppError(502, "UPSTREAM_ERROR", "Weather provider request failed");
      }
      return res.json() as Promise<Record<string, unknown>>;
    }, 15 * 60 * 1000);
  },
};
