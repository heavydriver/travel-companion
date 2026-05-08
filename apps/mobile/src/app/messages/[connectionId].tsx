import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Check, CheckCheck, ChevronLeft, Send, User as UserIcon } from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  KeyboardAvoidingView,
  KeyboardEvents,
  KeyboardGestureArea,
} from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { client } from "@/api/client";
import { invalidateMessageQueries } from "@/lib/socialQueries";
import { useAuthStore } from "@/store/authStore";
import { useNetworkStore } from "@/store/networkStore";
import { analytics } from "@/utils/analytics";

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
  lastMessage: {
    content: string;
    createdAt: string;
    senderId: string;
  } | null;
  unreadCount: number;
};

type MessagesResponse = {
  messages: MessageItem[];
};

type ConnectionsResponse = {
  connections: ConnectionInboxRow[];
};

const CHAT_INPUT_NATIVE_ID = "message-thread-input";

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
  const flatListRef = useRef<FlatList<MessageItem>>(null);
  const inputFocusedRef = useRef(false);
  const lastMarkedMessageIdRef = useRef<string | null>(null);
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
  });
  const {
    data: messagesData,
    isLoading: isMessagesLoading,
    refetch: refetchMessages,
  } = messagesQuery;

  const connectionQuery = useQuery({
    queryKey: ["connections-accepted"],
    queryFn: async () => {
      const res = await client.api.v1.connections.get();
      if (res.error) throw new Error("connections");
      return res.data;
    },
    enabled: !!connectionId,
  });
  const { data: connectionData, refetch: refetchConnections } = connectionQuery;

  const syncThread = useCallback(() => {
    if (!connectionId) return;
    void refetchMessages();
    void refetchConnections();
  }, [connectionId, refetchConnections, refetchMessages]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await client.api.v1.messages.post({
        connectionId,
        content,
      });
      if (res.error) throw new Error("Failed to send message");
      return res.data;
    },
    onSuccess: ({ message }) => {
      analytics.chatMessageSent(Boolean(connectionId));
      queryClient.setQueryData<MessagesResponse>(["messages", connectionId], (current) => ({
        messages: [...(current?.messages ?? []), message],
      }));
      queryClient.setQueryData<ConnectionsResponse>(["connections-accepted"], (current) => {
        if (!current) return current;
        return {
          connections: current.connections.map((row) =>
            row.id === connectionId
              ? {
                  ...row,
                  lastMessage: {
                    content: message.content,
                    createdAt: message.createdAt,
                    senderId: message.senderId,
                  },
                }
              : row,
          ),
        };
      });
      void refetchConnections();
      setDraft("");
    },
  });

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        syncThread();
      }
    });

    return () => sub.remove();
  }, [syncThread]);

  useFocusEffect(
    useCallback(() => {
      syncThread();
    }, [syncThread]),
  );

  useEffect(() => {
    if (!connectionId || !currentUserId) return;

    const unreadIncoming = (messagesData?.messages ?? []).filter(
      (message) => message.senderId !== currentUserId && !message.readAt,
    );
    const latestUnread = unreadIncoming.at(-1);
    if (!latestUnread) return;
    if (lastMarkedMessageIdRef.current === latestUnread.id) return;

    lastMarkedMessageIdRef.current = latestUnread.id;
    client.api.v1.messages["mark-read"]
      .patch({ connectionId })
      .then(() => {
        void invalidateMessageQueries(queryClient, connectionId);
      })
      .catch(() => {
        lastMarkedMessageIdRef.current = null;
      });
  }, [connectionId, currentUserId, messagesData?.messages, queryClient]);

  const messages = (messagesData?.messages ?? []) as MessageItem[];
  const latestMessageId = messages.at(-1)?.id;
  const connection = (connectionData?.connections ?? []).find(
    (row: ConnectionInboxRow) => row.id === connectionId,
  ) as ConnectionInboxRow | undefined;
  const canSend = draft.trim().length > 0 && !sendMutation.isPending && isConnected;

  const scrollToLatest = useCallback((animated = false) => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const handleSend = () => {
    if (!canSend) return;
    sendMutation.mutate(draft.trim());
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  useEffect(() => {
    if (!latestMessageId) return;
    scrollToLatest(false);
  }, [latestMessageId, scrollToLatest]);

  useEffect(() => {
    const willShowSub = KeyboardEvents.addListener("keyboardWillShow", () => {
      scrollToLatest(false);
    });
    const didShowSub = KeyboardEvents.addListener("keyboardDidShow", () => {
      scrollToLatest(false);
    });

    return () => {
      willShowSub.remove();
      didShowSub.remove();
    };
  }, [scrollToLatest]);

  const renderStatusIcon = (item: MessageItem) => {
    if (item.senderId !== currentUserId) return null;
    if (item.readAt) {
      return <CheckCheck size={13} color="rgba(255,255,255,0.92)" />;
    }
    return <Check size={13} color="rgba(255,255,255,0.82)" />;
  };

  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} className="flex-1 bg-background">
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
                <Image
                  source={{ uri: connection.user.avatarUrl }}
                  style={{ width: 48, height: 48 }}
                  contentFit="cover"
                />
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
              <Text
                className={`mt-0.5 text-sm ${isConnected ? "text-muted-foreground" : "text-destructive"}`}
              >
                {isConnected ? "Active conversation" : "Offline - reconnect to sync"}
              </Text>
            </View>
          </View>
        </View>

        {isMessagesLoading && (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        )}

        <KeyboardGestureArea
          interpolator="ios"
          style={{ flex: 1 }}
          textInputNativeID={CHAT_INPUT_NATIVE_ID}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            className="flex-1"
            contentContainerClassName="gap-1 px-3 pb-4 pt-3"
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollToLatest(false)}
            onLayout={() => {
              if (inputFocusedRef.current) {
                scrollToLatest(false);
              }
            }}
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
                      <Text
                        className={`text-[15px] leading-5 ${isMe ? "text-primary-foreground" : "text-foreground"}`}
                      >
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
              !isMessagesLoading ? (
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
                nativeID={CHAT_INPUT_NATIVE_ID}
                textAlignVertical="top"
                className="max-h-24 min-h-9 flex-1 px-1 py-1 text-[15px] leading-5 text-foreground"
                onFocus={() => {
                  inputFocusedRef.current = true;
                  scrollToLatest(false);
                }}
                onBlur={() => {
                  inputFocusedRef.current = false;
                }}
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
        </KeyboardGestureArea>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
