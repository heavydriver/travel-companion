import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DAY_IN_MS = 1000 * 60 * 60 * 24;

/** Safely convert a Date or ISO string to an ISO string. */
export function toISO(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  return value;
}

/** Extract the YYYY-MM-DD portion from a Date or ISO string. */
export function toDateOnly(value: string | Date): string {
  return toISO(value).split("T")[0];
}

export function startOfLocalDay(value: string | Date): Date {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function differenceInCalendarDays(later: string | Date, earlier: string | Date): number {
  return Math.round(
    (startOfLocalDay(later).getTime() - startOfLocalDay(earlier).getTime()) / DAY_IN_MS,
  );
}

export function isTripActiveToday(
  startDate: string | Date,
  endDate: string | Date,
  now: string | Date = new Date(),
): boolean {
  return differenceInCalendarDays(now, startDate) >= 0 && differenceInCalendarDays(endDate, now) >= 0;
}

export function isTripUpcoming(
  startDate: string | Date,
  now: string | Date = new Date(),
): boolean {
  return differenceInCalendarDays(startDate, now) > 0;
}

export function isTripPast(
  endDate: string | Date,
  now: string | Date = new Date(),
): boolean {
  return differenceInCalendarDays(endDate, now) < 0;
}

export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDateRange(start: string | Date, end: string | Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${new Date(start).toLocaleDateString("en-US", opts)} – ${new Date(end).toLocaleDateString("en-US", opts)}`;
}

export function daysUntil(date: string | Date): number {
  return differenceInCalendarDays(date, new Date());
}

export function formatItineraryTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const match = /^(\d{1,2}):(\d{2})/.exec(trimmed);
  if (!match) return trimmed;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

export function formatItineraryTimeRange(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): string | null {
  const start = formatItineraryTime(startTime);
  const end = formatItineraryTime(endTime);
  if (start && end) return `${start} - ${end}`;
  return start ?? end;
}
