import Elysia, { t } from "elysia";
import { authGuard } from "../../middleware/auth";
import {
  MarkMessagesReadBody,
  MarkMessagesReadResponse,
  MessagesListResponse,
  PostMessageBody,
  PostMessageResponse,
} from "./model";
import { messageService } from "./service";

export const messageModule = new Elysia({ prefix: "/messages" })
  .use(authGuard)
  .post(
    "/",
    async ({ userId, body, set }) => {
      const message = await messageService.send(userId, body.connectionId, body.content);
      set.status = 201;
      return { message };
    },
    { body: PostMessageBody, response: { 201: PostMessageResponse } },
  )
  .get(
    "/",
    async ({ userId, query }) => {
      const messages = await messageService.list(userId, query.connectionId);
      return { messages };
    },
    {
      query: t.Object({
        connectionId: t.String(),
      }),
      response: MessagesListResponse,
    },
  )
  .patch(
    "/mark-read",
    async ({ userId, body }) => {
      return messageService.markRead(userId, body.connectionId);
    },
    { body: MarkMessagesReadBody, response: MarkMessagesReadResponse },
  );
