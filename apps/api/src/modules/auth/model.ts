import { t } from "elysia";

export const RegisterBody = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 8 }),
  name: t.String({ minLength: 1, maxLength: 100 }),
  username: t.String({ minLength: 3, maxLength: 30 }),
});

export const LoginBody = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 1 }),
});

export const GoogleBody = t.Object({
  idToken: t.String({ minLength: 1 }),
});

export const AppleBody = t.Object({
  identityToken: t.String({ minLength: 1 }),
  name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
});

export const AuthResponse = t.Object({
  user: t.Object({
    id: t.String(),
    email: t.String(),
    name: t.String(),
    username: t.String(),
    avatarUrl: t.Union([t.String(), t.Null()]),
    bio: t.Union([t.String(), t.Null()]),
    socialOptIn: t.Boolean(),
  }),
  accessToken: t.String(),
  /** Also set as HttpOnly cookie for web; required in JSON for React Native (no cookie jar). */
  refreshToken: t.String(),
});

export const RefreshRequest = t.Object({
  refreshToken: t.Optional(t.String()),
});

export const RefreshResponse = t.Object({
  accessToken: t.String(),
});

export const MessageResponse = t.Object({
  message: t.String(),
});
