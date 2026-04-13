import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { prisma } from "@repo/db";

process.env.NODE_ENV = "development";
process.env.JWT_ACCESS_SECRET ??= "test_access_secret_1234567890";
process.env.JWT_REFRESH_SECRET ??= "test_refresh_secret_1234567890";

const { itineraryService } = await import("./service");
const { tripService } = await import("../trip/service");
const { authService } = await import("../auth/service");

const runId = `itin_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const createdUserIds = new Set<string>();
const createdTripIds = new Set<string>();

let testUserId: string;
let testTripId: string;

async function setup() {
  const user = await authService.register(
    `${runId}@test.local`,
    "Password456!",
    "Itinerary Tester",
    `${runId}_user`
  );
  createdUserIds.add(user.user.id);
  testUserId = user.user.id;

  const dest = await prisma.destination.findFirst({ select: { id: true } });
  if (!dest) throw new Error("No destinations seeded");

  const trip = await tripService.create(testUserId, {
    destinationId: dest.id,
    title: "Itinerary Test Trip",
    startDate: "2026-06-01T00:00:00.000Z",
    endDate: "2026-06-07T00:00:00.000Z",
  });
  createdTripIds.add(trip.id);
  testTripId = trip.id;
}

afterEach(async () => {
  for (const tripId of createdTripIds) {
    await prisma.itineraryItem.deleteMany({ where: { tripId } });
  }
  await prisma.trip.deleteMany({
    where: { id: { in: [...createdTripIds] } },
  });
  createdTripIds.clear();

  await prisma.user.deleteMany({
    where: { id: { in: [...createdUserIds] } },
  });
  createdUserIds.clear();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("itineraryService", () => {
  test("create and list items", async () => {
    await setup();

    const item = await itineraryService.create(testTripId, testUserId, {
      title: "Visit temple",
      date: "2026-06-02T00:00:00.000Z",
    });

    expect(item.title).toBe("Visit temple");
    expect(item.tripId).toBe(testTripId);

    const items = await itineraryService.listByTrip(testTripId, testUserId);
    expect(items.length).toBe(1);
    expect(items[0]!.title).toBe("Visit temple");
  });

  test("update item title and isDone", async () => {
    await setup();

    const item = await itineraryService.create(testTripId, testUserId, {
      title: "Original",
      date: "2026-06-03T00:00:00.000Z",
    });

    const updated = await itineraryService.update(item.id, testUserId, {
      title: "Updated",
      isDone: true,
    });

    expect(updated!.title).toBe("Updated");
    expect(updated!.isDone).toBe(true);
  });

  test("delete item removes it", async () => {
    await setup();

    const item = await itineraryService.create(testTripId, testUserId, {
      title: "Removable",
      date: "2026-06-04T00:00:00.000Z",
    });

    await itineraryService.remove(item.id, testUserId);

    const items = await itineraryService.listByTrip(testTripId, testUserId);
    expect(items.length).toBe(0);
  });

  test("auto-calculates order for new items on same date", async () => {
    await setup();

    const item1 = await itineraryService.create(testTripId, testUserId, {
      title: "First",
      date: "2026-06-05T00:00:00.000Z",
    });
    const item2 = await itineraryService.create(testTripId, testUserId, {
      title: "Second",
      date: "2026-06-05T00:00:00.000Z",
    });

    expect(item1.order).toBe(0);
    expect(item2.order).toBe(1);
  });

  test("reorder changes item order", async () => {
    await setup();

    const item1 = await itineraryService.create(testTripId, testUserId, {
      title: "A",
      date: "2026-06-06T00:00:00.000Z",
    });
    const item2 = await itineraryService.create(testTripId, testUserId, {
      title: "B",
      date: "2026-06-06T00:00:00.000Z",
    });

    await itineraryService.reorder(testTripId, testUserId, [
      { id: item1.id, order: 1 },
      { id: item2.id, order: 0 },
    ]);

    const items = await itineraryService.listByTrip(testTripId, testUserId);
    const a = items.find((i) => i.title === "A");
    const b = items.find((i) => i.title === "B");
    expect(b!.order).toBe(0);
    expect(a!.order).toBe(1);
  });
});
