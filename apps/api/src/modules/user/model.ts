import { t } from "elysia";

export const PatchUserMeBody = t.Object({
  socialOptIn: t.Optional(t.Boolean()),
  name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  bio: t.Optional(t.Union([t.String({ maxLength: 300 }), t.Null()])),
  avatarUrl: t.Optional(t.Union([t.String(), t.Null()])),
});

export const UserMeResponse = t.Object({
  user: t.Object({
    id: t.String(),
    email: t.String(),
    name: t.String(),
    username: t.String(),
    avatarUrl: t.Union([t.String(), t.Null()]),
    bio: t.Union([t.String(), t.Null()]),
    socialOptIn: t.Boolean(),
  }),
});
