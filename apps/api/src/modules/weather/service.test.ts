import { describe, expect, test } from "bun:test";

process.env.NODE_ENV = "development";
process.env.JWT_ACCESS_SECRET ??= "test_access_secret_1234567890";
process.env.JWT_REFRESH_SECRET ??= "test_refresh_secret_1234567890";

const { weatherService } = await import("./service");

describe("weatherService", () => {
  test("forecast returns current and daily data for valid coords", async () => {
    const result = await weatherService.forecast({
      latitude: 35.6762,
      longitude: 139.6503,
      forecastDays: 3,
    });

    expect(result).toBeDefined();
    expect(result).toHaveProperty("current");
    expect(result).toHaveProperty("daily");
  });

  test("forecast clamps days to max 16", async () => {
    const result = await weatherService.forecast({
      latitude: 48.8566,
      longitude: 2.3522,
      forecastDays: 30,
    });

    expect(result).toBeDefined();
    expect(result).toHaveProperty("current");
  });

  test("forecast clamps days to min 1", async () => {
    const result = await weatherService.forecast({
      latitude: 40.7128,
      longitude: -74.006,
      forecastDays: -5,
    });

    expect(result).toBeDefined();
    expect(result).toHaveProperty("current");
  });

  test("forecast defaults to 7 days when not specified", async () => {
    const result = await weatherService.forecast({
      latitude: 51.5074,
      longitude: -0.1278,
    });

    expect(result).toBeDefined();
    expect(result).toHaveProperty("daily");
    const daily = result.daily as Record<string, unknown[]>;
    expect(daily.time?.length).toBe(7);
  });

  test("forecast accepts custom timezone", async () => {
    const result = await weatherService.forecast({
      latitude: 35.6762,
      longitude: 139.6503,
      timezone: "Asia/Tokyo",
    });

    expect(result).toBeDefined();
    expect(result).toHaveProperty("timezone");
    expect(result.timezone).toBe("Asia/Tokyo");
  });
});
