import { describe, expect, test } from "bun:test";
import type { AppError } from "../../middleware/errorHandler";

process.env.NODE_ENV = "development";
process.env.JWT_ACCESS_SECRET ??= "test_access_secret_1234567890";
process.env.JWT_REFRESH_SECRET ??= "test_refresh_secret_1234567890";

const { currencyService } = await import("./service");

describe("currencyService", () => {
  test("listSupported returns a non-empty array", () => {
    const list = currencyService.listSupported();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  test("each supported entry has code, name, and country", () => {
    const list = currencyService.listSupported();
    for (const entry of list.slice(0, 5)) {
      expect(typeof entry.code).toBe("string");
      expect(typeof entry.name).toBe("string");
      expect(typeof entry.country).toBe("string");
    }
  });

  test("isSupportedCode returns true for USD", () => {
    expect(currencyService.isSupportedCode("USD")).toBe(true);
  });

  test("isSupportedCode returns true case-insensitively", () => {
    expect(currencyService.isSupportedCode("usd")).toBe(true);
    expect(currencyService.isSupportedCode("Eur")).toBe(true);
  });

  test("isSupportedCode returns false for made-up code", () => {
    expect(currencyService.isSupportedCode("XYZ123")).toBe(false);
  });

  test("ratesForBase returns data for USD", async () => {
    const result = await currencyService.ratesForBase("USD");
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });

  test("ratesForBase throws 404 for unsupported code", async () => {
    await expect(currencyService.ratesForBase("ZZZZZ")).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    } satisfies Partial<AppError>);
  });
});
