import { prisma } from "@repo/db";
import { AppError } from "../../middleware/errorHandler";

async function friendCount(userId: string): Promise<number> {
  return prisma.connection.count({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { receiverId: userId }],
    },
  });
}

export const userService = {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        avatarUrl: true,
        bio: true,
        socialOptIn: true,
        _count: {
          select: {
            trips: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    const friends = await friendCount(userId);

    const { _count, ...rest } = user;
    return {
      ...rest,
      friendCount: friends,
      tripCount: _count.trips,
    };
  },

  /**
   * Public profile for another member (or yourself). Omits email. Includes relationship to viewer.
   */
  async getPublicProfileForViewer(viewerId: string, targetUserId: string) {
    if (viewerId === targetUserId) {
      const full = await this.getProfile(viewerId);
      const { email: _e, socialOptIn: _so, ...user } = full;
      return { user, connection: null };
    }

    const row = await prisma.user.findFirst({
      where: { id: targetUserId, deletedAt: null },
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
        bio: true,
        _count: {
          select: {
            trips: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!row) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    const friends = await friendCount(targetUserId);
    const { _count, ...rest } = row;

    const conn = await prisma.connection.findFirst({
      where: {
        OR: [
          { requesterId: viewerId, receiverId: targetUserId },
          { requesterId: targetUserId, receiverId: viewerId },
        ],
      },
    });

    const connection = conn
      ? {
          id: conn.id,
          status: conn.status as "PENDING" | "ACCEPTED" | "REJECTED",
          direction: (conn.requesterId === viewerId ? "outgoing" : "incoming") as
            | "outgoing"
            | "incoming",
        }
      : null;

    return {
      user: {
        ...rest,
        friendCount: friends,
        tripCount: _count.trips,
      },
      connection,
    };
  },

  async updateProfile(
    userId: string,
    data: { name?: string; username?: string; bio?: string | null; socialOptIn?: boolean; avatarUrl?: string | null }
  ) {
    if (data.username) {
      const existing = await prisma.user.findUnique({
        where: { username: data.username },
        select: { id: true },
      });
      if (existing && existing.id !== userId) {
        throw new AppError(409, "CONFLICT", "Username already taken");
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.username !== undefined && { username: data.username }),
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.socialOptIn !== undefined && { socialOptIn: data.socialOptIn }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        avatarUrl: true,
        bio: true,
        socialOptIn: true,
        _count: {
          select: {
            trips: { where: { deletedAt: null } },
          },
        },
      },
    });

    const friends = await friendCount(userId);
    const { _count, ...rest } = user;
    return {
      ...rest,
      friendCount: friends,
      tripCount: _count.trips,
    };
  },

  async registerPushToken(userId: string, expoToken: string) {
    if (!expoToken.trim()) {
      throw new AppError(400, "VALIDATION_ERROR", "Missing push token");
    }

    await prisma.pushDevice.upsert({
      where: { expoToken },
      create: { userId, expoToken },
      update: { userId, updatedAt: new Date() },
    });

    return { ok: true as const };
  },
};
