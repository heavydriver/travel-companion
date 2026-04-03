import { prisma } from "@repo/db";
import { AppError } from "../../middleware/errorHandler";

export const userService = {
  async patchMe(
    userId: string,
    data: {
      socialOptIn?: boolean;
      name?: string;
      bio?: string | null;
      avatarUrl?: string | null;
    },
  ) {
    const patch: Record<string, unknown> = {};
    if (data.socialOptIn !== undefined) patch.socialOptIn = data.socialOptIn;
    if (data.name !== undefined) patch.name = data.name;
    if (data.bio !== undefined) patch.bio = data.bio;
    if (data.avatarUrl !== undefined) patch.avatarUrl = data.avatarUrl;

    const select = {
      id: true,
      email: true,
      name: true,
      username: true,
      avatarUrl: true,
      bio: true,
      socialOptIn: true,
    } as const;

    if (Object.keys(patch).length === 0) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select,
      });
      if (!user) {
        throw new AppError(404, "NOT_FOUND", "User not found");
      }
      return user;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: patch,
      select,
    });

    return user;
  },

  async getPublicProfile(userId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
        bio: true,
      },
    });
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }
    return user;
  },
};
