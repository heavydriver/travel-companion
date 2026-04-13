import { prisma } from "@repo/db";
import { AppError } from "../../middleware/errorHandler";

const publicUserSelect = {
  id: true,
  name: true,
  username: true,
  avatarUrl: true,
  bio: true,
} as const;

type PublicUser = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
};

type PublicUserAvatar = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

function daysRemaining(endDate: Date, now: Date): number {
  const ms = endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

async function getBlockedUserIds(userId: string): Promise<Set<string>> {
  const blocks = await prisma.block.findMany({
    where: {
      OR: [{ blockerId: userId }, { blockedId: userId }],
    },
    select: { blockerId: true, blockedId: true },
  });
  const ids = new Set<string>();
  for (const b of blocks) {
    ids.add(b.blockerId === userId ? b.blockedId : b.blockerId);
  }
  return ids;
}

export const socialService = {
  async getNearby(userId: string) {
    const now = new Date();

    const myTrips = await prisma.trip.findMany({
      where: {
        ownerId: userId,
        deletedAt: null,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      select: { destinationId: true, endDate: true },
    });

    if (myTrips.length === 0) {
      return { travelers: [] };
    }

    const destinationIds = [...new Set(myTrips.map((t) => t.destinationId))];
    const blockedIds = await getBlockedUserIds(userId);

    const theirTrips = await prisma.trip.findMany({
      where: {
        deletedAt: null,
        ownerId: { not: userId },
        destinationId: { in: destinationIds },
        startDate: { lte: now },
        endDate: { gte: now },
        owner: {
          deletedAt: null,
          socialOptIn: true,
        },
      },
      select: {
        destinationId: true,
        endDate: true,
        owner: { select: publicUserSelect },
      },
    });

    const candidateOwnerIds = [...new Set(theirTrips.map((t) => t.owner.id))].filter(
      (id) => !blockedIds.has(id),
    );

    if (candidateOwnerIds.length === 0) {
      return { travelers: [] };
    }

    const connections = await prisma.connection.findMany({
      where: {
        OR: [
          { requesterId: userId, receiverId: { in: candidateOwnerIds } },
          { receiverId: userId, requesterId: { in: candidateOwnerIds } },
        ],
      },
    });

    const connectionByPeer = new Map<
      string,
      {
        id: string;
        status: "PENDING" | "ACCEPTED" | "REJECTED";
        outgoing: boolean;
      }
    >();
    for (const c of connections) {
      const peerId = c.requesterId === userId ? c.receiverId : c.requesterId;
      const outgoing = c.requesterId === userId;
      connectionByPeer.set(peerId, {
        id: c.id,
        status: c.status as "PENDING" | "ACCEPTED" | "REJECTED",
        outgoing,
      });
    }

    const rejectedPeerIds = new Set<string>();
    for (const c of connections) {
      if (c.status !== "REJECTED") continue;
      const peerId = c.requesterId === userId ? c.receiverId : c.requesterId;
      rejectedPeerIds.add(peerId);
    }

    const seen = new Set<string>();
    const travelers: Array<{
      id: string;
      name: string;
      username: string;
      avatarUrl: string | null;
      bio: string | null;
      daysRemaining: number;
      destinationId: string;
      connection: {
        id: string;
        status: "PENDING" | "ACCEPTED" | "REJECTED";
        direction: "outgoing" | "incoming";
      } | null;
    }> = [];

    for (const row of theirTrips) {
      const peer = row.owner;
      if (rejectedPeerIds.has(peer.id)) continue;
      if (connectionByPeer.get(peer.id)?.status === "ACCEPTED") continue;
      if (seen.has(peer.id)) continue;
      seen.add(peer.id);

      const conn = connectionByPeer.get(peer.id);
      travelers.push({
        id: peer.id,
        name: peer.name,
        username: peer.username,
        avatarUrl: peer.avatarUrl,
        bio: peer.bio,
        daysRemaining: daysRemaining(row.endDate, now),
        destinationId: row.destinationId,
        connection: conn
          ? {
              id: conn.id,
              status: conn.status,
              direction: conn.outgoing ? "outgoing" : "incoming",
            }
          : null,
      });
    }

    return { travelers };
  },
};

export const connectionService = {
  async list(userId: string) {
    const acceptedConnections = await prisma.connection.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: userId }, { receiverId: userId }],
      },
      include: {
        requester: { select: publicUserSelect },
        receiver: { select: publicUserSelect },
      },
      orderBy: { updatedAt: "desc" },
    });

    const connections = acceptedConnections.map((c) => {
      const peer: PublicUser = c.requesterId === userId ? c.receiver : c.requester;
      const user: PublicUserAvatar = {
        id: peer.id,
        name: peer.name,
        avatarUrl: peer.avatarUrl,
      };

      return {
        id: c.id,
        user,
      };
    });

    return { connections };
  },

  async create(userId: string, receiverId: string) {
    if (receiverId === userId) {
      throw new AppError(400, "VALIDATION_ERROR", "Cannot connect to yourself");
    }

    const receiver = await prisma.user.findFirst({
      where: { id: receiverId, deletedAt: null },
      select: { id: true, socialOptIn: true },
    });
    if (!receiver) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }
    if (!receiver.socialOptIn) {
      throw new AppError(403, "FORBIDDEN", "User has not opted in to social discovery");
    }

    const now = new Date();
    const [myActive, theirActive] = await Promise.all([
      prisma.trip.findMany({
        where: {
          ownerId: userId,
          deletedAt: null,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        select: { destinationId: true },
      }),
      prisma.trip.findMany({
        where: {
          ownerId: receiverId,
          deletedAt: null,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        select: { destinationId: true },
      }),
    ]);
    const mine = new Set(myActive.map((t) => t.destinationId));
    const hasOverlap = theirActive.some((t) => mine.has(t.destinationId));
    if (!hasOverlap) {
      throw new AppError(403, "FORBIDDEN", "No overlapping active trip at the same destination");
    }

    const existing = await prisma.connection.findFirst({
      where: {
        OR: [
          { requesterId: userId, receiverId },
          { requesterId: receiverId, receiverId: userId },
        ],
      },
    });

    // Spec requires: any pre-existing connection between these users -> 409
    // (PENDING/ACCEPTED/REJECTED are all considered existing).
    if (existing) {
      throw new AppError(409, "CONFLICT", "Connection already exists");
    }

    const created = await prisma.connection.create({
      data: { requesterId: userId, receiverId },
    });
    return formatConnection(created);
  },

  async updateStatus(userId: string, connectionId: string, status: "ACCEPTED" | "REJECTED") {
    const conn = await prisma.connection.findUnique({
      where: { id: connectionId },
    });
    if (!conn) {
      throw new AppError(404, "NOT_FOUND", "Connection not found");
    }
    if (conn.receiverId !== userId) {
      throw new AppError(403, "FORBIDDEN", "Only the recipient can respond");
    }
    if (conn.status !== "PENDING") {
      throw new AppError(409, "CONFLICT", "Connection is not pending");
    }

    const updated = await prisma.connection.update({
      where: { id: connectionId },
      data: { status },
    });
    return formatConnection(updated);
  },
};

function formatConnection(c: {
  id: string;
  status: string;
  requesterId: string;
  receiverId: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    connection: {
      id: c.id,
      status: c.status as "PENDING" | "ACCEPTED" | "REJECTED",
      requesterId: c.requesterId,
      receiverId: c.receiverId,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    },
  };
}
