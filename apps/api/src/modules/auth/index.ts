import Elysia from "elysia";
import {
  RegisterBody,
  LoginBody,
  GoogleBody,
  AppleBody,
  AuthResponse,
  RefreshRequest,
  RefreshResponse,
  MessageResponse,
} from "./model";
import { authService } from "./service";
import { AppError } from "../../middleware/errorHandler";
import { rateLimiter } from "../../middleware/rateLimit";

const REFRESH_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function setRefreshCookie(
  cookie: Record<string, { set: (opts: {
    value: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax";
    maxAge: number;
    path: string;
  }) => void } | undefined>,
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
  .use(rateLimiter)
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
      return { user, accessToken, refreshToken };
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
      return { user, accessToken, refreshToken };
    },
    { body: LoginBody, response: AuthResponse }
  )
  .post(
    "/google",
    async ({ body, cookie }) => {
      const { user, accessToken, refreshToken } = await authService.googleLogin(
        body.idToken
      );
      setRefreshCookie(cookie, refreshToken);
      return { user, accessToken, refreshToken };
    },
    { body: GoogleBody, response: AuthResponse }
  )
  .post(
    "/apple",
    async ({ body, cookie }) => {
      const { user, accessToken, refreshToken } = await authService.appleLogin(
        body.identityToken,
        body.name
      );
      setRefreshCookie(cookie, refreshToken);
      return { user, accessToken, refreshToken };
    },
    { body: AppleBody, response: AuthResponse }
  )
  .post(
    "/refresh",
    async ({ cookie, body }) => {
      const fromCookie = cookie.refreshToken?.value;
      const fromBody = body?.refreshToken;
      const token =
        typeof fromCookie === "string" && fromCookie.length > 0
          ? fromCookie
          : typeof fromBody === "string" && fromBody.length > 0
            ? fromBody
            : null;
      if (!token) {
        throw new AppError(401, "UNAUTHORIZED", "Missing refresh token");
      }
      return authService.refresh(token);
    },
    { body: RefreshRequest, response: RefreshResponse }
  )
  .post(
    "/logout",
    async ({ cookie }) => {
      setRefreshCookie(cookie, "", 0);
      return { message: "Logged out" };
    },
    { response: MessageResponse }
  );
