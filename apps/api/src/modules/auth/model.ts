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

export const AuthResponse = t.Object({
  user: t.Object({
    id: t.String(),
    email: t.String(),
    name: t.String(),
    username: t.String(),
  }),
  accessToken: t.String(),
});

export const RefreshResponse = t.Object({
  accessToken: t.String(),
});

export const MessageResponse = t.Object({
  message: t.String(),
});
