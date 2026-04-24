import Elysia, { t } from "elysia";
import { authGuard } from "../../middleware/auth";
import { userService } from "./service";

const MeUser = t.Object({
  id: t.String(),
  email: t.String(),
  name: t.String(),
  username: t.String(),
  avatarUrl: t.Union([t.String(), t.Null()]),
  bio: t.Union([t.String(), t.Null()]),
  socialOptIn: t.Boolean(),
  notifyMessages: t.Boolean(),
  notifyConnections: t.Boolean(),
  friendCount: t.Integer({ minimum: 0 }),
  tripCount: t.Integer({ minimum: 0 }),
});

const MeResponse = t.Object({
  user: MeUser,
});

const UpdateProfileBody = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  username: t.Optional(t.String({ minLength: 3, maxLength: 30 })),
  bio: t.Optional(t.Union([t.String({ maxLength: 300 }), t.Null()])),
  socialOptIn: t.Optional(t.Boolean()),
  avatarUrl: t.Optional(t.Union([t.String({ maxLength: 2000 }), t.Null()])),
  notifyMessages: t.Optional(t.Boolean()),
  notifyConnections: t.Optional(t.Boolean()),
});

const PushTokenBody = t.Object({
  expoToken: t.String({ minLength: 10, maxLength: 512 }),
});

const PushTokenResponse = t.Object({
  ok: t.Literal(true),
});

export const userModule = new Elysia({ prefix: "/users" })
  .use(authGuard)
  .get(
    "/me",
    async ({ userId }) => {
      const user = await userService.getProfile(userId);
      return { user };
    },
    { response: MeResponse }
  )
  .patch(
    "/me",
    async ({ userId, body }) => {
      const user = await userService.updateProfile(userId, body);
      return { user };
    },
    { body: UpdateProfileBody, response: MeResponse }
  )
  .post(
    "/me/push-token",
    async ({ userId, body }) => {
      return userService.registerPushToken(userId, body.expoToken.trim());
    },
    { body: PushTokenBody, response: PushTokenResponse }
  );
