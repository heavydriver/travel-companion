import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { prisma } from "@repo/db";
import type { AppError } from "../../middleware/errorHandler";

process.env.NODE_ENV = "development";
process.env.JWT_ACCESS_SECRET ??= "test_access_secret_1234567890";
process.env.JWT_REFRESH_SECRET ??= "test_refresh_secret_1234567890";

const { authService } = await import("./service");

const runId = `auth_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const createdUserIds = new Set<string>();

function makeCredentials(suffix: string) {
  return {
    email: `${runId}_${suffix}@test.local`,
    username: `${runId}_${suffix}`,
    password: "Password456!",
    name: `Test User ${suffix}`,
  };
}

afterEach(async () => {
  if (createdUserIds.size === 0) return;

  await prisma.user.deleteMany({
    where: {
      id: { in: [...createdUserIds] },
    },
  });

  createdUserIds.clear();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("authService", () => {
  test("register creates a user and returns access/refresh tokens", async () => {
    const creds = makeCredentials("register");
    const result = await authService.register(
      creds.email,
      creds.password,
      creds.name,
      creds.username,
    );

    createdUserIds.add(result.user.id);

    expect(result.user.email).toBe(creds.email);
    expect(result.user.username).toBe(creds.username);
    expect(result.accessToken.length).toBeGreaterThan(10);
    expect(result.refreshToken.length).toBeGreaterThan(10);
  });

  test("login returns tokens for a valid registered user", async () => {
    const creds = makeCredentials("login_ok");
    const registered = await authService.register(
      creds.email,
      creds.password,
      creds.name,
      creds.username,
    );
    createdUserIds.add(registered.user.id);

    const loggedIn = await authService.login(creds.email, creds.password);

    expect(loggedIn.user.id).toBe(registered.user.id);
    expect(loggedIn.accessToken.length).toBeGreaterThan(10);
    expect(loggedIn.refreshToken.length).toBeGreaterThan(10);
  });

  test("login throws UNAUTHORIZED for wrong password", async () => {
    const creds = makeCredentials("login_bad_password");
    const registered = await authService.register(
      creds.email,
      creds.password,
      creds.name,
      creds.username,
    );
    createdUserIds.add(registered.user.id);

    await expect(authService.login(creds.email, "WrongPassword123!")).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
    } satisfies Partial<AppError>);
  });
});
