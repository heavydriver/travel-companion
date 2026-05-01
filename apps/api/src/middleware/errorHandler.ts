import Elysia from "elysia";
import { getRequestMetadata } from "../observability";
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
  ({ code, error, request, set }) => {
    const requestMetadata = getRequestMetadata(request);
    const requestMeta = {
      method: request.method,
      requestId: requestMetadata?.requestId,
      route: requestMetadata?.route,
      url: request.url,
    };

    if (error instanceof AppError) {
      logger.warn("Application error", {
        ...requestMeta,
        code: error.code,
        details: error.details,
        message: error.message,
        statusCode: error.statusCode,
      });

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
      logger.warn("Validation error", {
        ...requestMeta,
        details: error instanceof Error ? error.message : String(error),
      });

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
      logger.warn("Route not found", requestMeta);

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
    logger.error("Unhandled error", {
      ...requestMeta,
      message: msg,
      stack,
    });

    set.status = 500;
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
      },
    };
  }
);
