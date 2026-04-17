import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Send } from "lucide-react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { client } from "@/api/client";
import { useAuthStore } from "@/store/authStore";

type ApiMessage = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
};

export default function MessageThreadScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ connectionId?: string }>();
  const connectionId = typeof params.connectionId === "string" ? params.connectionId : "";
  const myId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<ApiMessage>>(null);

  const connectionsQuery = useQuery({
    queryKey: ["connections-accepted"],
    queryFn: async () => {
      const res = await client.api.v1.connections.get();
      if (res.error) throw new Error("connections");
      return res.data;
    },
  });

  const peer = useMemo(() => {
    const list = connectionsQuery.data?.connections ?? [];
    return list.find((c) => c.id === connectionId)?.user;
  }, [connectionsQuery.data?.connections, connectionId]);

  const messagesQuery = useQuery({
    queryKey: ["messages", connectionId],
    queryFn: async () => {
      const res = await client.api.v1.messages.get({
        query: { connectionId },
      });
      if (res.error) throw new Error("messages");
      return (res.data?.messages ?? []) as ApiMessage[];
    },
    enabled: Boolean(connectionId),
    refetchInterval: 4000,
  });

  useFocusEffect(
    useCallback(() => {
      if (!connectionId) return;
      void (async () => {
        const res = await client.api.v1.messages["mark-read"].patch({ connectionId });
        if (!res.error) {
          void queryClient.invalidateQueries({ queryKey: ["connections-accepted"] });
        }
      })();
    }, [connectionId, queryClient])
  );

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await client.api.v1.messages.post({ connectionId, content });
      if (res.error) throw new Error("send");
      return res.data;
    },
    onSuccess: () => {
      setDraft("");
      void queryClient.invalidateQueries({ queryKey: ["messages", connectionId] });
      void queryClient.invalidateQueries({ queryKey: ["connections-accepted"] });
    },
  });

  const messages = messagesQuery.data ?? [];
  const canSend = draft.trim().length > 0 && !sendMutation.isPending;

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <View className="flex-row items-center border-b border-border px-2 py-2">
          <Pressable onPress={() => router.back()} className="px-2 py-2 active:opacity-80">
            <Text className="text-base font-medium text-primary">Back</Text>
          </Pressable>
          <View className="min-w-0 flex-1 items-center pr-16">
            <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
              {peer?.name ?? "Chat"}
            </Text>
            {peer?.username ? (
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                @{peer.username}
              </Text>
            ) : null}
          </View>
        </View>

        {messagesQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : messagesQuery.isError ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-center text-muted-foreground">
              Unable to load messages. You can only message accepted connections.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            className="flex-1 px-3"
            data={messages}
            keyExtractor={(item) => item.id}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const mine = item.senderId === myId;
              return (
                <View className={`mb-2 max-w-[85%] ${mine ? "self-end" : "self-start"}`}>
                  <View
                    className={`rounded-2xl px-4 py-2.5 ${
                      mine ? "bg-primary" : "border border-border bg-card"
                    }`}
                  >
                    <Text className={`text-[15px] leading-5 ${mine ? "text-primary-foreground" : "text-foreground"}`}>
                      {item.content}
                    </Text>
                    <Text
                      className={`mt-1 text-[11px] ${mine ? "text-primary-foreground/75" : "text-muted-foreground"}`}
                    >
                      {formatTime(item.createdAt)}
                    </Text>
                  </View>
                </View>
              );
            }}
            contentContainerStyle={{ paddingVertical: 12, flexGrow: 1, justifyContent: "flex-end" }}
          />
        )}

        <View className="border-t border-border bg-background px-3 pb-4 pt-2">
          <View className="flex-row items-end gap-2">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message…"
              placeholderTextColor="hsl(218 11% 65%)"
              multiline
              className="max-h-28 min-h-11 flex-1 rounded-2xl border border-border bg-card px-4 py-2.5 text-base text-foreground"
            />
            <Pressable
              onPress={() => {
                if (!canSend) return;
                sendMutation.mutate(draft.trim());
              }}
              disabled={!canSend}
              className={`mb-0.5 h-11 w-11 items-center justify-center rounded-full ${
                canSend ? "bg-primary" : "bg-muted"
              }`}
            >
              <Send size={18} color={canSend ? "white" : "hsl(218 11% 65%)"} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
