import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { client } from "@/api/client";
import { showAppToast } from "@/components/shared/AppToast";
import { useAuthStore } from "@/store/authStore";

type PendingSnapshot = { incomingIds: Set<string> };
type InboxSnapshot = Map<string, { unread: number; lastAt: string | null }>;

const POLL_MS = 14_000;

export function useInAppSocialMessageSignals() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const pendingSnap = useRef<PendingSnapshot | null>(null);
  const inboxSnap = useRef<InboxSnapshot | null>(null);
  const bootstrapped = useRef(false);
  const acceptedLenRef = useRef<number | null>(null);

  const pendingQuery = useQuery({
    queryKey: ["connections-pending"],
    queryFn: async () => {
      const res = await client.api.v1.connections.pending.get();
      if (res.error) throw new Error("pending");
      return res.data;
    },
    enabled: isAuthenticated,
    refetchInterval: POLL_MS,
  });

  const connectionsQuery = useQuery({
    queryKey: ["connections-accepted"],
    queryFn: async () => {
      const res = await client.api.v1.connections.get();
      if (res.error) throw new Error("connections");
      return res.data;
    },
    enabled: isAuthenticated,
    refetchInterval: POLL_MS,
  });

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const wasBackground = appState.current.match(/inactive|background/);
      appState.current = next;
      if (wasBackground && next === "active" && isAuthenticated) {
        void queryClient.invalidateQueries({ queryKey: ["connections-pending"] });
        void queryClient.invalidateQueries({ queryKey: ["connections-accepted"] });
      }
    });
    return () => sub.remove();
  }, [isAuthenticated, queryClient]);

  useEffect(() => {
    if (!isAuthenticated) {
      pendingSnap.current = null;
      inboxSnap.current = null;
      bootstrapped.current = false;
      return;
    }

    if (!pendingQuery.data?.incoming) return;

    const incomingIds = new Set(pendingQuery.data.incoming.map((r) => r.id));
    if (!bootstrapped.current) {
      pendingSnap.current = { incomingIds: new Set(incomingIds) };
      bootstrapped.current = true;
      return;
    }

    const prev = pendingSnap.current?.incomingIds ?? new Set<string>();
    for (const id of incomingIds) {
      if (!prev.has(id)) {
        const row = pendingQuery.data.incoming.find((r) => r.id === id);
        showAppToast({
          variant: "info",
          title: "New connection request",
          message: row ? `${row.peer.name} wants to connect` : undefined,
          visibilityTime: 3500,
        });
      }
    }
    pendingSnap.current = { incomingIds: new Set(incomingIds) };
  }, [isAuthenticated, pendingQuery.data]);

  useEffect(() => {
    if (!isAuthenticated || !connectionsQuery.data?.connections) return;

    const nextMap: InboxSnapshot = new Map();
    for (const c of connectionsQuery.data.connections) {
      const lastAt = c.lastMessage?.createdAt ?? null;
      nextMap.set(c.id, { unread: c.unreadCount, lastAt });
    }

    if (!inboxSnap.current) {
      inboxSnap.current = nextMap;
      return;
    }

    for (const [connectionId, cur] of nextMap) {
      const prev = inboxSnap.current.get(connectionId);
      if (!prev) continue;
      if (cur.unread > prev.unread && cur.unread > 0) {
        const row = connectionsQuery.data.connections.find((c) => c.id === connectionId);
        if (row) {
          showAppToast({
            variant: "message",
            title: `Message from ${row.user.name}`,
            message: row.lastMessage?.content
              ? row.lastMessage.content.length > 72
                ? `${row.lastMessage.content.slice(0, 69)}…`
                : row.lastMessage.content
              : undefined,
            visibilityTime: 3200,
          });
        }
      }
    }

    inboxSnap.current = nextMap;
  }, [isAuthenticated, connectionsQuery.data]);

  useEffect(() => {
    if (!isAuthenticated) {
      acceptedLenRef.current = null;
      return;
    }
    if (!connectionsQuery.data?.connections) return;
    const n = connectionsQuery.data.connections.length;
    if (acceptedLenRef.current === null) {
      acceptedLenRef.current = n;
      return;
    }
    if (n > acceptedLenRef.current) {
      showAppToast({
        variant: "success",
        title: "New connection",
        message: "You can start messaging.",
        visibilityTime: 3200,
      });
    }
    acceptedLenRef.current = n;
  }, [isAuthenticated, connectionsQuery.data?.connections]);
}
