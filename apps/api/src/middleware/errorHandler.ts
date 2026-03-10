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
