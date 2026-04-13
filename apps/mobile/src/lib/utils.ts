import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Safely convert a Date or ISO string to an ISO string. */
export function toISO(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  return value;
}

/** Extract the YYYY-MM-DD portion from a Date or ISO string. */
export function toDateOnly(value: string | Date): string {
  return toISO(value).split("T")[0];
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
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
