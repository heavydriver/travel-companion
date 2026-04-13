import Elysia, { t } from "elysia";
import { authGuard } from "../../middleware/auth";
import { userService } from "./service";

const UserResponse = t.Object({
  user: t.Object({
    id: t.String(),
    email: t.String(),
    name: t.String(),
    username: t.Nullable(t.String()),
  }),
});

const UpdateProfileBody = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  username: t.Optional(t.String({ minLength: 3, maxLength: 30 })),
});

export const userModule = new Elysia({ prefix: "/users" })
  .use(authGuard)
  .get(
    "/me",
    async ({ userId }) => {
      const user = await userService.getProfile(userId);
      return { user };
    },
    { response: UserResponse }
  )
  .patch(
    "/me",
    async ({ userId, body }) => {
      const user = await userService.updateProfile(userId, body);
      return { user };
    },
    { body: UpdateProfileBody, response: UserResponse }
  );
