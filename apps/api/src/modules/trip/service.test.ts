import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { prisma } from "@repo/db";

process.env.NODE_ENV = "development";
process.env.JWT_ACCESS_SECRET ??= "test_access_secret_1234567890";
process.env.JWT_REFRESH_SECRET ??= "test_refresh_secret_1234567890";

const { tripService } = await import("./service");
const { authService } = await import("../auth/service");

const runId = `trip_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const createdUserIds = new Set<string>();
const createdTripIds = new Set<string>();

let testUserId: string;
let testDestinationId: string;

async function setupUser() {
  const result = await authService.register(
    `${runId}@test.local`,
    "Password456!",
    "Trip Tester",
    `${runId}_user`
  );
  createdUserIds.add(result.user.id);
  testUserId = result.user.id;
}

async function getDestination() {
  const dest = await prisma.destination.findFirst({ select: { id: true } });
  if (!dest) throw new Error("No destinations seeded — run db:seed first");
  testDestinationId = dest.id;
}

afterEach(async () => {
  if (createdTripIds.size > 0) {
    await prisma.itineraryItem.deleteMany({
      where: { tripId: { in: [...createdTripIds] } },
    });
    await prisma.trip.deleteMany({
      where: { id: { in: [...createdTripIds] } },
    });
    createdTripIds.clear();
  }
});

afterAll(async () => {
  if (createdUserIds.size > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: [...createdUserIds] } },
    });
  }
  await prisma.$disconnect();
});

describe("tripService", () => {
  test("create trip and list it", async () => {
    await setupUser();
    await getDestination();

    const trip = await tripService.create(testUserId, {
      destinationId: testDestinationId,
      title: "Test Trip",
      startDate: "2026-06-01T00:00:00.000Z",
      endDate: "2026-06-07T00:00:00.000Z",
    });

    createdTripIds.add(trip.id);

    expect(trip.title).toBe("Test Trip");
    expect(trip.destination.id).toBe(testDestinationId);

    const trips = await tripService.list(testUserId);
    expect(trips.some((t) => t.id === trip.id)).toBe(true);
  });

  test("getById returns the correct trip", async () => {
    await setupUser();
    await getDestination();

    const trip = await tripService.create(testUserId, {
      destinationId: testDestinationId,
      title: "Getable Trip",
      startDate: "2026-07-01T00:00:00.000Z",
      endDate: "2026-07-05T00:00:00.000Z",
    });
    createdTripIds.add(trip.id);

    const fetched = await tripService.getById(trip.id, testUserId);
    expect(fetched.title).toBe("Getable Trip");
  });

  test("update changes the trip title", async () => {
    await setupUser();
    await getDestination();

    const trip = await tripService.create(testUserId, {
      destinationId: testDestinationId,
      title: "Old Title",
      startDate: "2026-08-01T00:00:00.000Z",
      endDate: "2026-08-05T00:00:00.000Z",
    });
    createdTripIds.add(trip.id);

    const updated = await tripService.update(trip.id, testUserId, {
      title: "New Title",
    });
    expect(updated.title).toBe("New Title");
  });

  test("delete removes the trip", async () => {
    await setupUser();
    await getDestination();

    const trip = await tripService.create(testUserId, {
      destinationId: testDestinationId,
      title: "Deletable Trip",
      startDate: "2026-09-01T00:00:00.000Z",
      endDate: "2026-09-05T00:00:00.000Z",
    });
    createdTripIds.add(trip.id);

    await tripService.remove(trip.id, testUserId);

    await expect(tripService.getById(trip.id, testUserId)).rejects.toMatchObject({
      statusCode: 403,
    });
    createdTripIds.delete(trip.id);
  });

  test("endDate before startDate throws validation error", async () => {
    await setupUser();
    await getDestination();

    await expect(
      tripService.create(testUserId, {
        destinationId: testDestinationId,
        title: "Bad Dates",
        startDate: "2026-06-10T00:00:00.000Z",
        endDate: "2026-06-05T00:00:00.000Z",
      })
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});
