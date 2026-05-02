import { daysUntil, formatDateRange, toDateOnly, toISO } from "@/lib/utils";

describe("utils", () => {
  it("converts Date values to ISO strings", () => {
    const date = new Date("2026-05-01T10:30:00.000Z");
    expect(toISO(date)).toBe("2026-05-01T10:30:00.000Z");
    expect(toISO("2026-05-02T00:00:00.000Z")).toBe("2026-05-02T00:00:00.000Z");
  });

  it("extracts date-only values", () => {
    expect(toDateOnly("2026-06-03T12:00:00.000Z")).toBe("2026-06-03");
  });

  it("formats a readable date range", () => {
    const label = formatDateRange("2026-08-01T00:00:00.000Z", "2026-08-10T00:00:00.000Z");
    expect(typeof label).toBe("string");
    expect(label).toContain("–");
  });

  it("computes day deltas from today", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    expect(daysUntil(tomorrow)).toBe(1);
  });
});
