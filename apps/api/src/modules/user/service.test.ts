import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { prisma } from "@repo/db";

process.env.NODE_ENV = "development";
process.env.JWT_ACCESS_SECRET ??= "test_access_secret_1234567890";
process.env.JWT_REFRESH_SECRET ??= "test_refresh_secret_1234567890";

const { userService } = await import("./service");
const { authService } = await import("../auth/service");

const runId = `user_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const createdUserIds = new Set<string>();

afterEach(async () => {
  if (createdUserIds.size > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: [...createdUserIds] } },
    });
    createdUserIds.clear();
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("userService", () => {
  test("getProfile returns the user", async () => {
    const result = await authService.register(
      `${runId}_get@test.local`,
      "Password456!",
      "Profile User",
      `${runId}_get`
    );
    createdUserIds.add(result.user.id);

    const profile = await userService.getProfile(result.user.id);
    expect(profile.email).toBe(`${runId}_get@test.local`);
    expect(profile.name).toBe("Profile User");
    expect(profile.friendCount).toBe(0);
    expect(profile.tripCount).toBe(0);
    expect(profile.socialOptIn).toBe(false);
  });

  test("updateProfile changes name and username", async () => {
    const result = await authService.register(
      `${runId}_upd@test.local`,
      "Password456!",
      "Old Name",
      `${runId}_upd`
    );
    createdUserIds.add(result.user.id);

    const updated = await userService.updateProfile(result.user.id, {
      name: "New Name",
      username: `${runId}_upd_new`,
    });

    expect(updated.name).toBe("New Name");
    expect(updated.username).toBe(`${runId}_upd_new`);
  });

  test("updateProfile rejects duplicate username", async () => {
    const r1 = await authService.register(
      `${runId}_dup1@test.local`,
      "Password456!",
      "User One",
      `${runId}_dup1`
    );
    createdUserIds.add(r1.user.id);

    const r2 = await authService.register(
      `${runId}_dup2@test.local`,
      "Password456!",
      "User Two",
      `${runId}_dup2`
    );
    createdUserIds.add(r2.user.id);

    await expect(
      userService.updateProfile(r2.user.id, { username: `${runId}_dup1` })
    ).rejects.toMatchObject({ statusCode: 409, code: "CONFLICT" });
  });

  test("getProfile throws for non-existent user", async () => {
    await expect(
      userService.getProfile("00000000-0000-0000-0000-000000000000")
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test("getPublicProfileForViewer returns peer without email and no connection", async () => {
    const viewer = await authService.register(
      `${runId}_pv1@test.local`,
      "Password456!",
      "Viewer",
      `${runId}_pv1`
    );
    const target = await authService.register(
      `${runId}_pv2@test.local`,
      "Password456!",
      "Target",
      `${runId}_pv2`
    );
    createdUserIds.add(viewer.user.id);
    createdUserIds.add(target.user.id);

    const out = await userService.getPublicProfileForViewer(viewer.user.id, target.user.id);
    expect(out.user.name).toBe("Target");
    expect(out.user).not.toHaveProperty("email");
    expect(out.connection).toBeNull();
  });
});
