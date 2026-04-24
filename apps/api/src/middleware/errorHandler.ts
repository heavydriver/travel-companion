import Elysia from "elysia";
import { logger } from "../utils/logger";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export const errorHandler = new Elysia({ name: "errorHandler" }).onError(
  ({ code, error, set }) => {
    if (error instanceof AppError) {
      set.status = error.statusCode;
      return {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      };
    }

    if (code === "VALIDATION") {
      set.status = 422;
      return {
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: error instanceof Error ? error.message : String(error),
        },
      };
    }

    if (code === "NOT_FOUND") {
      set.status = 404;
      return {
        error: { code: "NOT_FOUND", message: "Resource not found" },
      };
    }

    /** Prisma: column/table does not exist — usually pending `prisma migrate deploy`. */
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      ((error as { code: string }).code === "P2022" ||
        (error as { code: string }).code === "P2021")
    ) {
      set.status = 503;
      return {
        error: {
          code: "DATABASE_SCHEMA_MISMATCH",
          message:
            "Database schema is out of date. From the repo root run: pnpm --filter @repo/db exec prisma migrate deploy",
        },
      };
    }

    const msg = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;
    logger.error("Unhandled error", { message: msg, stack });

    set.status = 500;
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
      },
    };
  }
);
