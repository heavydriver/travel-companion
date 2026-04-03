import Elysia from "elysia";
import { AppError } from "./errorHandler";

const windowMs = 60_000;
const maxRequests = 10;

const hits = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of hits) {
    if (val.resetAt <= now) hits.delete(key);
  }
}, 60_000);

export const rateLimiter = new Elysia({ name: "rateLimiter" }).onBeforeHandle(
  ({ request, set }) => {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
    const key = `${ip}:${new URL(request.url).pathname}`;
    const now = Date.now();

    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    entry.count++;
    if (entry.count > maxRequests) {
      set.headers["retry-after"] = String(
        Math.ceil((entry.resetAt - now) / 1000)
      );
      throw new AppError(429, "RATE_LIMITED", "Too many requests. Try again later.");
    }
  }
);
