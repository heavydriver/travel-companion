import { t } from "elysia";

export const PostMessageBody = t.Object({
  connectionId: t.String(),
  content: t.String({ minLength: 1, maxLength: 2000 }),
});

export const MessageItem = t.Object({
  id: t.String(),
  senderId: t.String(),
  receiverId: t.String(),
  content: t.String(),
  readAt: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
});

export const MessagesListResponse = t.Object({
  messages: t.Array(MessageItem),
});

export const MarkMessagesReadBody = t.Object({
  connectionId: t.String(),
});

export const MarkMessagesReadResponse = t.Object({
  updated: t.Integer(),
});

export const PostMessageResponse = t.Object({
  message: MessageItem,
});
