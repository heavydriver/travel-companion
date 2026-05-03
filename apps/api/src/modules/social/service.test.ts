import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { prisma } from "@repo/db";

process.env.NODE_ENV = "development";
process.env.JWT_ACCESS_SECRET ??= "test_access_secret_1234567890";
process.env.JWT_REFRESH_SECRET ??= "test_refresh_secret_1234567890";

const { connectionService } = await import("./service");
const { authService } = await import("../auth/service");

const runId = `social_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const createdUserIds = new Set<string>();
const createdConnectionIds = new Set<string>();

async function createTestUser(suffix: string, opts?: { socialOptIn?: boolean }) {
  const result = await authService.register(
    `${runId}_${suffix}@test.local`,
    "Password456!",
    `Social User ${suffix}`,
    `${runId}_${suffix}`
  );
  createdUserIds.add(result.user.id);

  if (opts?.socialOptIn) {
    await prisma.user.update({
      where: { id: result.user.id },
      data: { socialOptIn: true },
    });
  }

  return result.user;
}

async function createOverlappingTrips(userId1: string, userId2: string, destId: string) {
  const now = new Date();
  const later = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const t1 = await prisma.trip.create({
    data: { ownerId: userId1, destinationId: destId, title: "Trip A", startDate: now, endDate: later },
  });
  const t2 = await prisma.trip.create({
    data: { ownerId: userId2, destinationId: destId, title: "Trip B", startDate: now, endDate: later },
  });
  return [t1.id, t2.id];
}

afterEach(async () => {
  if (createdConnectionIds.size > 0) {
    await prisma.connection.deleteMany({
      where: { id: { in: [...createdConnectionIds] } },
    });
    createdConnectionIds.clear();
  }
});

afterAll(async () => {
  if (createdUserIds.size > 0) {
    await prisma.itineraryItem.deleteMany({
      where: { trip: { ownerId: { in: [...createdUserIds] } } },
    });
    await prisma.trip.deleteMany({
      where: { ownerId: { in: [...createdUserIds] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [...createdUserIds] } },
    });
  }
  await prisma.$disconnect();
});

describe("connectionService", () => {
  test("cannot connect to yourself", async () => {
    const user = await createTestUser("self", { socialOptIn: true });
    await expect(connectionService.create(user.id, user.id)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  test("cannot connect to user without socialOptIn", async () => {
    const sender = await createTestUser("sender1", { socialOptIn: true });
    const receiver = await createTestUser("receiver1_nooption");

    const dest = await prisma.destination.findFirst({ select: { id: true } });
    if (!dest) return;
    await createOverlappingTrips(sender.id, receiver.id, dest.id);

    await expect(connectionService.create(sender.id, receiver.id)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  test("create connection and list it", async () => {
    const sender = await createTestUser("sender2", { socialOptIn: true });
    const receiver = await createTestUser("receiver2", { socialOptIn: true });

    const dest = await prisma.destination.findFirst({ select: { id: true } });
    if (!dest) return;
    await createOverlappingTrips(sender.id, receiver.id, dest.id);

    const result = await connectionService.create(sender.id, receiver.id);
    createdConnectionIds.add(result.connection.id);

    expect(result.connection.status).toBe("PENDING");
    expect(result.connection.requesterId).toBe(sender.id);
    expect(result.connection.receiverId).toBe(receiver.id);
  });

  test("duplicate connection throws conflict", async () => {
    const sender = await createTestUser("sender3", { socialOptIn: true });
    const receiver = await createTestUser("receiver3", { socialOptIn: true });

    const dest = await prisma.destination.findFirst({ select: { id: true } });
    if (!dest) return;
    await createOverlappingTrips(sender.id, receiver.id, dest.id);

    const result = await connectionService.create(sender.id, receiver.id);
    createdConnectionIds.add(result.connection.id);

    await expect(connectionService.create(sender.id, receiver.id)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  test("accept connection changes status", async () => {
    const sender = await createTestUser("sender4", { socialOptIn: true });
    const receiver = await createTestUser("receiver4", { socialOptIn: true });

    const dest = await prisma.destination.findFirst({ select: { id: true } });
    if (!dest) return;
    await createOverlappingTrips(sender.id, receiver.id, dest.id);

    const created = await connectionService.create(sender.id, receiver.id);
    createdConnectionIds.add(created.connection.id);

    const updated = await connectionService.updateStatus(
      receiver.id,
      created.connection.id,
      "ACCEPTED"
    );
    expect(updated.connection.status).toBe("ACCEPTED");
  });

  test("only receiver can accept/reject", async () => {
    const sender = await createTestUser("sender5", { socialOptIn: true });
    const receiver = await createTestUser("receiver5", { socialOptIn: true });

    const dest = await prisma.destination.findFirst({ select: { id: true } });
    if (!dest) return;
    await createOverlappingTrips(sender.id, receiver.id, dest.id);

    const created = await connectionService.create(sender.id, receiver.id);
    createdConnectionIds.add(created.connection.id);

    await expect(
      connectionService.updateStatus(sender.id, created.connection.id, "ACCEPTED")
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
