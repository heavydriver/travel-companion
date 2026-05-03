import { prisma } from "@repo/db";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { withResolvedAvatar } from "../../utils/avatarUrl";
import { config } from "../../utils/config";
import { AppError } from "../../middleware/errorHandler";

const accessSecret = new TextEncoder().encode(config.jwtAccessSecret);
const refreshSecret = new TextEncoder().encode(config.jwtRefreshSecret);

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

const googleClient = new OAuth2Client();
const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

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

function normalizeUsernameBase(name: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
  const candidate = base.length >= 3 ? base : "user";
  return candidate;
}

async function generateUniqueUsernameTx(
  tx: { user: { findUnique: typeof prisma.user.findUnique } },
  displayName: string
): Promise<string> {
  const base = normalizeUsernameBase(displayName);
  const candidates: string[] = [base];
  for (let i = 0; i < 10; i++) {
    const suffix = Math.random().toString(36).slice(2, 6);
    candidates.push(`${base}${suffix}`.slice(0, 30));
  }

  for (const candidate of candidates) {
    const existing = await tx.user.findUnique({ where: { username: candidate } });
    if (!existing) return candidate;
  }

  throw new AppError(500, "INTERNAL_SERVER_ERROR", "Unable to generate username");
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
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        profilePicUpdatedAt: true,
        bio: true,
        socialOptIn: true,
      },
    });

    const accessToken = await generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);

    return { user: withResolvedAvatar(user), accessToken, refreshToken };
  },

  async googleLogin(idToken: string) {
    if (!config.googleClientId) {
      throw new AppError(
        500,
        "INTERNAL_SERVER_ERROR",
        "GOOGLE_CLIENT_ID is not configured"
      );
    }

    let payload: { sub?: string; email?: string; name?: string } | undefined;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: config.googleClientId,
      });
      payload = ticket.getPayload() ?? undefined;
    } catch {
      throw new AppError(401, "UNAUTHORIZED", "Invalid Google ID token");
    }

    const providerUserId = payload?.sub;
    const email = payload?.email;
    const name = payload?.name ?? "Traveler";

    if (!providerUserId || !email) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid Google ID token payload");
    }

    const existingAccount = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: "GOOGLE",
          providerUserId,
        },
      },
      select: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            username: true,
            profilePicUpdatedAt: true,
            bio: true,
            socialOptIn: true,
            isActive: true,
          },
        },
      },
    });

    if (existingAccount?.user) {
      if (!existingAccount.user.isActive) {
        throw new AppError(401, "UNAUTHORIZED", "Account is deactivated");
      }

      const accessToken = await generateAccessToken(existingAccount.user.id);
      const refreshToken = await generateRefreshToken(existingAccount.user.id);
      const { isActive: _, ...safeUser } = existingAccount.user;
      return { user: withResolvedAvatar(safeUser), accessToken, refreshToken };
    }

    const { user } = await prisma.$transaction(async (tx) => {
      const userByEmail = await tx.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          profilePicUpdatedAt: true,
          bio: true,
          socialOptIn: true,
          isActive: true,
        },
      });

      if (userByEmail) {
        if (!userByEmail.isActive) {
          throw new AppError(401, "UNAUTHORIZED", "Account is deactivated");
        }

        await tx.oAuthAccount.create({
          data: {
            userId: userByEmail.id,
            provider: "GOOGLE",
            providerUserId,
          },
        });

        return { user: userByEmail };
      }

      const username = await generateUniqueUsernameTx(tx, name);

      const created = await tx.user.create({
        data: {
          email,
          name,
          username,
        },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          profilePicUpdatedAt: true,
          bio: true,
          socialOptIn: true,
          isActive: true,
        },
      });

      await tx.oAuthAccount.create({
        data: {
          userId: created.id,
          provider: "GOOGLE",
          providerUserId,
        },
      });

      return { user: created };
    });

    const accessToken = await generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);
    const { isActive: _, ...safeUser } = user;
    return { user: withResolvedAvatar(safeUser), accessToken, refreshToken };
  },

  async appleLogin(identityToken: string, name?: string) {
    if (!config.appleClientId) {
      throw new AppError(
        500,
        "INTERNAL_SERVER_ERROR",
        "APPLE_CLIENT_ID is not configured"
      );
    }

    let payload: { sub?: string; email?: string; name?: string } | undefined;
    try {
      const verified = await jwtVerify(identityToken, appleJwks, {
        issuer: "https://appleid.apple.com",
        audience: config.appleClientId,
      });
      payload = verified.payload as typeof payload;
    } catch {
      throw new AppError(401, "UNAUTHORIZED", "Invalid Apple identity token");
    }

    const providerUserId = payload?.sub;
    const email = payload?.email;
    const displayName = payload?.name ?? name ?? "Traveler";

    if (!providerUserId || !email) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid Apple identity token payload");
    }

    const existingAccount = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: "APPLE",
          providerUserId,
        },
      },
      select: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            username: true,
            profilePicUpdatedAt: true,
            bio: true,
            socialOptIn: true,
            isActive: true,
          },
        },
      },
    });

    if (existingAccount?.user) {
      if (!existingAccount.user.isActive) {
        throw new AppError(401, "UNAUTHORIZED", "Account is deactivated");
      }

      const accessToken = await generateAccessToken(existingAccount.user.id);
      const refreshToken = await generateRefreshToken(existingAccount.user.id);
      const { isActive: _, ...safeUser } = existingAccount.user;
      return { user: withResolvedAvatar(safeUser), accessToken, refreshToken };
    }

    const { user } = await prisma.$transaction(async (tx) => {
      const userByEmail = await tx.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          profilePicUpdatedAt: true,
          bio: true,
          socialOptIn: true,
          isActive: true,
        },
      });

      if (userByEmail) {
        if (!userByEmail.isActive) {
          throw new AppError(401, "UNAUTHORIZED", "Account is deactivated");
        }

        await tx.oAuthAccount.create({
          data: {
            userId: userByEmail.id,
            provider: "APPLE",
            providerUserId,
          },
        });

        return { user: userByEmail };
      }

      const username = await generateUniqueUsernameTx(tx, displayName);

      const created = await tx.user.create({
        data: {
          email,
          name: displayName,
          username,
        },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          profilePicUpdatedAt: true,
          bio: true,
          socialOptIn: true,
          isActive: true,
        },
      });

      await tx.oAuthAccount.create({
        data: {
          userId: created.id,
          provider: "APPLE",
          providerUserId,
        },
      });

      return { user: created };
    });

    const accessToken = await generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);
    const { isActive: _, ...safeUser } = user;
    return { user: withResolvedAvatar(safeUser), accessToken, refreshToken };
  },

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        profilePicUpdatedAt: true,
        bio: true,
        socialOptIn: true,
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
    return { user: withResolvedAvatar(safeUser), accessToken, refreshToken };
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
