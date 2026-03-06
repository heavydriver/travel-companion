import Elysia from "elysia";
import {
  RegisterBody,
  LoginBody,
  AuthResponse,
  RefreshResponse,
  MessageResponse,
} from "./model";
import { authService } from "./service";
import { AppError } from "../../middleware/errorHandler";

const REFRESH_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function setRefreshCookie(
  cookie: Record<string, any>,
  value: string,
  maxAge = REFRESH_MAX_AGE
) {
  cookie.refreshToken?.set({
    value,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge,
    path: "/",
  });
}

export const authModule = new Elysia({ prefix: "/auth" })
  .post(
    "/register",
    async ({ body, cookie, set }) => {
      const { user, accessToken, refreshToken } = await authService.register(
        body.email,
        body.password,
        body.name,
        body.username
      );

      setRefreshCookie(cookie, refreshToken);
      set.status = 201;
      return { user, accessToken };
    },
    { body: RegisterBody, response: { 201: AuthResponse } }
  )
  .post(
    "/login",
    async ({ body, cookie }) => {
      const { user, accessToken, refreshToken } = await authService.login(
        body.email,
        body.password
      );

      setRefreshCookie(cookie, refreshToken);
      return { user, accessToken };
    },
    { body: LoginBody, response: AuthResponse }
  )
  .post(
    "/refresh",
    async ({ cookie }) => {
      const token = cookie.refreshToken?.value;
      if (!token || typeof token !== "string") {
        throw new AppError(401, "UNAUTHORIZED", "Missing refresh token");
      }
      return authService.refresh(token);
    },
    { response: RefreshResponse }
  )
  .post(
    "/logout",
    async ({ cookie }) => {
      setRefreshCookie(cookie, "", 0);
      return { message: "Logged out" };
    },
    { response: MessageResponse }
  );
