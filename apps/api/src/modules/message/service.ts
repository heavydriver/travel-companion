import { prisma } from "@repo/db";
import { AppError } from "../../middleware/errorHandler";

async function requireAcceptedParticipant(connectionId: string, userId: string) {
  const conn = await prisma.connection.findUnique({
    where: { id: connectionId },
  });
  if (!conn) {
    throw new AppError(404, "NOT_FOUND", "Connection not found");
  }
  if (conn.status !== "ACCEPTED") {
    throw new AppError(403, "FORBIDDEN", "Messaging requires an accepted connection");
  }
  if (conn.requesterId !== userId && conn.receiverId !== userId) {
    throw new AppError(403, "FORBIDDEN", "Not a participant in this connection");
  }
  const otherUserId = conn.requesterId === userId ? conn.receiverId : conn.requesterId;
  return { conn, otherUserId };
}

function formatMessage(m: {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  readAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: m.id,
    senderId: m.senderId,
    receiverId: m.receiverId,
    content: m.content,
    readAt: m.readAt ? m.readAt.toISOString() : null,
    createdAt: m.createdAt.toISOString(),
  };
}

export const messageService = {
  async send(userId: string, connectionId: string, content: string) {
    const { otherUserId } = await requireAcceptedParticipant(connectionId, userId);

    const message = await prisma.message.create({
      data: {
        senderId: userId,
        receiverId: otherUserId,
        content,
      },
    });

    return formatMessage(message);
  },

  async list(userId: string, connectionId: string) {
    const { otherUserId } = await requireAcceptedParticipant(connectionId, userId);

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    return messages.map(formatMessage);
  },

  async markRead(userId: string, connectionId: string) {
    const { otherUserId } = await requireAcceptedParticipant(connectionId, userId);

    const now = new Date();
    const result = await prisma.message.updateMany({
      where: {
        senderId: otherUserId,
        receiverId: userId,
        readAt: null,
      },
      data: { readAt: now },
    });

    return { updated: result.count };
  },
};
