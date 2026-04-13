import { prisma } from "@repo/db";
import { AppError } from "../../middleware/errorHandler";

export const userService = {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, username: true },
    });

    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    return user;
  },

  async updateProfile(
    userId: string,
    data: { name?: string; username?: string }
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
      },
      select: { id: true, email: true, name: true, username: true },
    });

    return user;
  },
};
