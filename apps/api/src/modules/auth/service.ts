import { prisma } from "@repo/db";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { config } from "../../utils/config";
import { AppError } from "../../middleware/errorHandler";

const accessSecret = new TextEncoder().encode(config.jwtAccessSecret);
const refreshSecret = new TextEncoder().encode(config.jwtRefreshSecret);

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

async function generateAccessToken(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(accessSecret);
}

async function generateRefreshToken(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(refreshSecret);
}

export const authService = {
  async register(
    email: string,
    password: string,
    name: string,
    username: string
  ) {
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      throw new AppError(409, "CONFLICT", "Email already registered");
    }

    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });
    if (existingUsername) {
      throw new AppError(409, "CONFLICT", "Username already taken");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, passwordHash, name, username },
      select: { id: true, email: true, name: true, username: true },
    });

    const accessToken = await generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);

    return { user, accessToken, refreshToken };
  },

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        passwordHash: true,
        isActive: true,
      },
    });

    if (!user || !user.passwordHash) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid email or password");
    }

    if (!user.isActive) {
      throw new AppError(401, "UNAUTHORIZED", "Account is deactivated");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid email or password");
    }

    const accessToken = await generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);

    const { passwordHash: _, isActive: __, ...safeUser } = user;
    return { user: safeUser, accessToken, refreshToken };
  },

  async refresh(refreshToken: string) {
    try {
      const { payload } = await jwtVerify(refreshToken, refreshSecret);
      if (!payload.sub) {
        throw new AppError(401, "UNAUTHORIZED", "Invalid refresh token");
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, isActive: true },
      });

      if (!user || !user.isActive) {
        throw new AppError(401, "UNAUTHORIZED", "User not found or inactive");
      }

      const accessToken = await generateAccessToken(user.id);
      return { accessToken };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(401, "UNAUTHORIZED", "Invalid or expired refresh token");
    }
  },
};
