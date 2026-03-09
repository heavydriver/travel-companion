import Elysia from "elysia";
import { jwtVerify } from "jose";
import { config } from "../utils/config";
import { AppError } from "./errorHandler";

const accessSecret = new TextEncoder().encode(config.jwtAccessSecret);

export const authGuard = new Elysia({ name: "authGuard" }).derive(
  { as: "scoped" },
  async ({ headers }) => {
    const authHeader = headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new AppError(401, "UNAUTHORIZED", "Missing or invalid token");
    }

    const token = authHeader.slice(7);
    try {
      const { payload } = await jwtVerify(token, accessSecret);
      if (!payload.sub) {
        throw new AppError(401, "UNAUTHORIZED", "Invalid token payload");
      }
      return { userId: payload.sub as string };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(401, "UNAUTHORIZED", "Token expired or invalid");
    }
  }
);
