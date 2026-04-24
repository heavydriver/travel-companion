import { prisma } from "@repo/db";
import sharp from "sharp";
import { AppError } from "../../middleware/errorHandler";
import { resolvedAvatarUrl } from "../../utils/avatarUrl";
import { getObjectStorageClient, putProfilePictureJpeg } from "../../utils/profilePictureObjectStorage";

const PROFILE_PIC_MAX_BYTES = 10 * 1024 * 1024;

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
        profilePicUpdatedAt: true,
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

    const { _count, profilePicUpdatedAt, ...rest } = user;
    return {
      ...rest,
      avatarUrl: resolvedAvatarUrl({ id: user.id, profilePicUpdatedAt }),
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
        profilePicUpdatedAt: true,
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
    const { _count, profilePicUpdatedAt, ...rest } = row;

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
        avatarUrl: resolvedAvatarUrl({ id: row.id, profilePicUpdatedAt }),
        friendCount: friends,
        tripCount: _count.trips,
      },
      connection,
    };
  },

  async updateProfile(
    userId: string,
    data: { name?: string; username?: string; bio?: string | null; socialOptIn?: boolean }
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
      },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        profilePicUpdatedAt: true,
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
    const { _count, profilePicUpdatedAt, ...rest } = user;
    return {
      ...rest,
      avatarUrl: resolvedAvatarUrl({ id: user.id, profilePicUpdatedAt }),
      friendCount: friends,
      tripCount: _count.trips,
    };
  },

  async uploadProfilePicture(userId: string, file: Blob) {
    if (!(file instanceof Blob)) {
      throw new AppError(400, "VALIDATION_ERROR", "Missing image file");
    }
    if (file.size === 0) {
      throw new AppError(400, "VALIDATION_ERROR", "Choose an image to upload");
    }
    if (file.size > PROFILE_PIC_MAX_BYTES) {
      throw new AppError(400, "VALIDATION_ERROR", "Image must be 10 MB or smaller");
    }
    if (!getObjectStorageClient()) {
      throw new AppError(
        503,
        "SERVICE_UNAVAILABLE",
        "Profile picture upload is not configured on the server"
      );
    }

    const raw = Buffer.from(await file.arrayBuffer());
    let jpeg: Buffer;
    try {
      jpeg = await sharp(raw).rotate().jpeg({ quality: 88, mozjpeg: true }).toBuffer();
    } catch {
      throw new AppError(400, "VALIDATION_ERROR", "File must be a valid image");
    }

    await putProfilePictureJpeg(userId, jpeg);

    await prisma.user.update({
      where: { id: userId },
      data: { profilePicUpdatedAt: new Date() },
    });

    return this.getProfile(userId);
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
