import { t } from "elysia";

const travelerPublic = t.Object({
  id: t.String(),
  name: t.String(),
  username: t.String(),
  avatarUrl: t.Union([t.String(), t.Null()]),
  bio: t.Union([t.String(), t.Null()]),
  daysRemaining: t.Integer({ minimum: 0 }),
  destinationId: t.String(),
  connection: t.Union([
    t.Null(),
    t.Object({
      id: t.String(),
      status: t.Union([t.Literal("PENDING"), t.Literal("ACCEPTED"), t.Literal("REJECTED")]),
      direction: t.Union([t.Literal("outgoing"), t.Literal("incoming")]),
    }),
  ]),
});

export const NearbyTravelersResponse = t.Object({
  travelers: t.Array(travelerPublic),
});

const userPreview = t.Object({
  id: t.String(),
  name: t.String(),
  username: t.String(),
  avatarUrl: t.Union([t.String(), t.Null()]),
  bio: t.Union([t.String(), t.Null()]),
});

export const ConnectionRow = t.Object({
  id: t.String(),
  status: t.Union([t.Literal("PENDING"), t.Literal("ACCEPTED"), t.Literal("REJECTED")]),
  createdAt: t.String(),
  peer: userPreview,
});

const connectionUserPreview = t.Object({
  id: t.String(),
  name: t.String(),
  username: t.String(),
  avatarUrl: t.Union([t.String(), t.Null()]),
});

const lastMessagePreview = t.Object({
  content: t.String(),
  createdAt: t.String(),
  senderId: t.String(),
});

export const ConnectionsListResponse = t.Object({
  connections: t.Array(
    t.Object({
      id: t.String(),
      user: connectionUserPreview,
      lastMessage: t.Union([lastMessagePreview, t.Null()]),
      unreadCount: t.Integer({ minimum: 0 }),
    }),
  ),
});

export const PendingConnectionsResponse = t.Object({
  incoming: t.Array(ConnectionRow),
  outgoing: t.Array(ConnectionRow),
});

export const CreateConnectionBody = t.Object({
  receiverId: t.String(),
});

export const ConnectionResponse = t.Object({
  connection: t.Object({
    id: t.String(),
    status: t.Union([t.Literal("PENDING"), t.Literal("ACCEPTED"), t.Literal("REJECTED")]),
    requesterId: t.String(),
    receiverId: t.String(),
    createdAt: t.String(),
    updatedAt: t.String(),
  }),
});

export const PatchConnectionBody = t.Object({
  status: t.Union([t.Literal("ACCEPTED"), t.Literal("REJECTED")]),
});
