const WEEK_MINUTES = 7 * 24 * 60;

type OpeningEndpoint = { day: number; hour: number; minute: number };
type OpeningPeriod = { open: OpeningEndpoint; close: OpeningEndpoint };

const WEEKDAY_LONG_TO_API: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

function toMinutes(day: number, hour: number, minute: number) {
  return day * 24 * 60 + hour * 60 + minute;
}

function apiDayAndWeekMinutesInTimeZone(
  timeZone: string,
  at: Date,
): { apiDay: number; minutesFromWeekStart: number } | null {
  const tz = timeZone.trim();
  if (!tz) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23",
    }).formatToParts(at);
    const wdRaw = parts.find((p) => p.type === "weekday")?.value?.toLowerCase() ?? "";
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    const minute = Number(parts.find((p) => p.type === "minute")?.value);
    const apiDay = WEEKDAY_LONG_TO_API[wdRaw];
    if (apiDay === undefined || Number.isNaN(hour) || Number.isNaN(minute)) return null;
    return { apiDay, minutesFromWeekStart: apiDay * 24 * 60 + hour * 60 + minute };
  } catch {
    return null;
  }
}

function parseOpeningHours(raw: unknown): { periods: OpeningPeriod[]; openNow?: boolean } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const periodsRaw = o.periods;
  if (!Array.isArray(periodsRaw)) return null;
  const periods: OpeningPeriod[] = [];
  for (const p of periodsRaw) {
    if (!p || typeof p !== "object") continue;
    const pr = p as Record<string, unknown>;
    const open = pr.open as Record<string, unknown> | undefined;
    const close = pr.close as Record<string, unknown> | undefined;
    if (!open || !close) continue;
    const od = Number(open.day);
    const oh = Number(open.hour);
    const om = Number(open.minute);
    const cd = Number(close.day);
    const ch = Number(close.hour);
    const cm = Number(close.minute);
    if (
      [od, oh, om, cd, ch, cm].some((n) => Number.isNaN(n)) ||
      od < 0 ||
      od > 6 ||
      cd < 0 ||
      cd > 6
    ) {
      continue;
    }
    periods.push({
      open: { day: od, hour: oh, minute: om },
      close: { day: cd, hour: ch, minute: cm },
    });
  }
  if (periods.length === 0) return null;
  return {
    periods,
    openNow: typeof o.openNow === "boolean" ? o.openNow : undefined,
  };
}

function isOpenFromPeriodsAt(
  periods: OpeningPeriod[],
  pos: { minutesFromWeekStart: number },
): boolean {
  const cur = pos.minutesFromWeekStart;
  for (const p of periods) {
    const start = toMinutes(p.open.day, p.open.hour, p.open.minute);
    let end = toMinutes(p.close.day, p.close.hour, p.close.minute);
    if (end <= start) end += WEEK_MINUTES;
    if (cur >= start && cur < end) return true;
    if (cur + WEEK_MINUTES >= start && cur + WEEK_MINUTES < end) return true;
  }
  return false;
}

/** `null` = cannot determine (missing hours or timezone). */
export function computeIsOpenNow(
  openingHours: unknown,
  destinationTimeZone: string | null,
  at: Date,
): boolean | null {
  const tz = destinationTimeZone?.trim();
  if (!tz) return null;
  const parsed = parseOpeningHours(openingHours);
  if (!parsed?.periods?.length) return null;
  const pos = apiDayAndWeekMinutesInTimeZone(tz, at);
  if (!pos) return null;
  return isOpenFromPeriodsAt(parsed.periods, pos);
}
