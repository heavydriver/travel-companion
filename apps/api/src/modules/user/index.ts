import Elysia from "elysia";
import { authGuard } from "../../middleware/auth";
import { PatchUserMeBody, UserMeResponse } from "./model";
import { userService } from "./service";

export const userModule = new Elysia({ prefix: "/users" }).use(authGuard).patch(
  "/me",
  async ({ userId, body }) => {
    const user = await userService.patchMe(userId, body);
    return { user };
  },
  { body: PatchUserMeBody, response: UserMeResponse },
);
