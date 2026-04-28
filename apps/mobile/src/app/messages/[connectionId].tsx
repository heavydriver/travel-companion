import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Check, CheckCheck, ChevronLeft, Send, User as UserIcon } from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { client } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useNetworkStore } from "@/store/networkStore";

type MessageItem = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
};

type ConnectionInboxRow = {
  id: string;
  user: {
    id: string;
    name: string;
    username: string;
    avatarUrl: string | null;
  };
  unreadCount: number;
};

function formatMessageDay(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Today";

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function MessageThreadScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ connectionId?: string }>();
  const connectionId = params.connectionId ?? "";
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isConnected = useNetworkStore((s) => s.isConnected);
  const [draft, setDraft] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const iconColor = useUnstableNativeVariable("--foreground");
  const resolvedIcon = iconColor ? `hsl(${iconColor})` : "hsl(220 20% 10%)";

  const messagesQuery = useQuery({
    queryKey: ["messages", connectionId],
    queryFn: async () => {
      const res = await client.api.v1.messages.get({
        query: { connectionId },
      });
      if (res.error) throw new Error("Failed to load messages");
      return res.data;
    },
    enabled: !!connectionId,
    refetchInterval: 5000,
  });

  const connectionQuery = useQuery({
    queryKey: ["connections-accepted"],
    queryFn: async () => {
      const res = await client.api.v1.connections.get();
      if (res.error) throw new Error("connections");
      return res.data;
    },
    enabled: !!connectionId,
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await client.api.v1.messages.post({
        connectionId,
        content,
      });
      if (res.error) throw new Error("Failed to send message");
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", connectionId] });
      queryClient.invalidateQueries({ queryKey: ["connections-accepted"] });
      setDraft("");
    },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (!connectionId) return;
    client.api.v1.messages["mark-read"].patch({ connectionId }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["connections-accepted"] });
    }).catch(() => {});
  }, [connectionId, messagesQuery.data]);

  const messages = (messagesQuery.data?.messages ?? []) as MessageItem[];
  const connection = (connectionQuery.data?.connections ?? []).find(
    (row: ConnectionInboxRow) => row.id === connectionId,
  ) as ConnectionInboxRow | undefined;
  const canSend = draft.trim().length > 0 && !sendMutation.isPending && isConnected;

  const handleSend = () => {
    if (!canSend) return;
    sendMutation.mutate(draft.trim());
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const renderStatusIcon = (item: MessageItem) => {
    if (item.senderId !== currentUserId) return null;
    if (item.readAt) {
      return <CheckCheck size={13} color="rgba(255,255,255,0.92)" />;
    }
    return <Check size={13} color="rgba(255,255,255,0.82)" />;
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <KeyboardAvoidingView className="flex-1" behavior="padding" keyboardVerticalOffset={8}>
        <View className="border-b border-border bg-background px-4 pb-3 pt-2">
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => router.back()}
              className="h-11 w-11 items-center justify-center rounded-full border border-border/80 bg-card active:opacity-80"
            >
              <ChevronLeft size={22} color={resolvedIcon} />
            </Pressable>

            <View className="h-12 w-12 overflow-hidden rounded-full border border-primary/10 bg-muted">
              {connection?.user.avatarUrl ? (
                <Image source={{ uri: connection.user.avatarUrl }} style={{ width: 48, height: 48 }} contentFit="cover" />
              ) : (
                <View className="h-full w-full items-center justify-center">
                  <UserIcon size={22} color="hsl(218 11% 65%)" />
                </View>
              )}
            </View>

            <View className="min-w-0 flex-1">
              <Text className="text-lg font-semibold text-foreground" numberOfLines={1}>
                {connection?.user.name ?? "Messages"}
              </Text>
              <Text className={`mt-0.5 text-sm ${isConnected ? "text-muted-foreground" : "text-destructive"}`}>
                {isConnected ? "Active conversation" : "Offline - reconnect to sync"}
              </Text>
            </View>
          </View>
        </View>

        {messagesQuery.isLoading && (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          className="flex-1"
          contentContainerClassName="gap-1 px-3 pb-4 pt-3"
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item, index }) => {
            const isMe = item.senderId === currentUserId;
            const previousMessage = index > 0 ? messages[index - 1] : null;
            const showDayLabel =
              !previousMessage ||
              formatMessageDay(previousMessage.createdAt) !== formatMessageDay(item.createdAt);
            return (
              <View>
                {showDayLabel ? (
                  <View className="items-center py-3">
                    <View className="rounded-full border border-border/70 bg-card/90 px-3 py-1">
                      <Text className="text-[11px] font-medium uppercase tracking-[1px] text-muted-foreground">
                        {formatMessageDay(item.createdAt)}
                      </Text>
                    </View>
                  </View>
                ) : null}

                <View className={`mb-1 max-w-[82%] ${isMe ? "self-end" : "self-start"}`}>
                  <View
                    className={`px-4 py-2.5 ${
                      isMe
                        ? "rounded-[22px] rounded-br-md bg-primary"
                        : "rounded-[22px] rounded-bl-md border border-border/70 bg-card"
                    }`}
                  >
                    <Text className={`text-[15px] leading-5 ${isMe ? "text-primary-foreground" : "text-foreground"}`}>
                      {item.content}
                    </Text>
                    <View className="mt-1.5 flex-row items-center justify-end gap-1">
                      <Text
                        className={`text-[11px] ${
                          isMe ? "text-primary-foreground/80" : "text-muted-foreground"
                        }`}
                      >
                        {formatTime(item.createdAt)}
                      </Text>
                      {renderStatusIcon(item)}
                    </View>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            !messagesQuery.isLoading ? (
              <View className="flex-1 items-center justify-center px-8 py-16">
                <View className="rounded-[28px] border border-border bg-card px-6 py-8">
                  <Text className="text-center text-base font-semibold text-foreground">
                    No messages yet
                  </Text>
                  <Text className="mt-2 text-center text-sm leading-5 text-muted-foreground">
                    Break ice. Start with travel plan, favorite spot, or quick hello.
                  </Text>
                </View>
              </View>
            ) : null
          }
        />

        <View className="border-t border-border bg-background px-3 pb-3 pt-2">
          <View className="flex-row items-end gap-2 rounded-[24px] border border-border/80 bg-card px-3 py-2">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={isConnected ? "Type your message" : "You're offline"}
              placeholderTextColor="hsl(218 11% 65%)"
              editable={isConnected}
              multiline
              textAlignVertical="top"
              className="max-h-24 min-h-9 flex-1 px-1 py-1 text-[15px] leading-5 text-foreground"
              onSubmitEditing={handleSend}
            />
            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              className={`h-10 w-10 items-center justify-center rounded-full ${
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
