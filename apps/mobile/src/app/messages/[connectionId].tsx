import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Send } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { client } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useNetworkStore } from "@/store/networkStore";
import { SafeAreaView } from "react-native-safe-area-context";

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
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ connectionId?: string }>();
  const connectionId = params.connectionId ?? "";
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isConnected = useNetworkStore((s) => s.isConnected);
  const [draft, setDraft] = useState("");
  const flatListRef = useRef<FlashList<ApiMessage>>(null);

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
      setDraft("");
    },
  });

  const messages = (messagesQuery.data?.messages ?? []) as ApiMessage[];
  /** When polling adds messages, this changes so we mark read for new inbound items (R-1102). */
  const lastMessageId = messages.at(-1)?.id ?? "";

  // biome-ignore lint/correctness/useExhaustiveDependencies: lastMessageId must trigger mark-read when poll appends messages
  useEffect(() => {
    if (!connectionId) return;
    client.api.v1.messages["mark-read"].patch({ connectionId }).catch(() => {});
  }, [connectionId, lastMessageId]);
  const canSend = draft.trim().length > 0 && !sendMutation.isPending && isConnected;

  const handleSend = () => {
    if (!canSend) return;
    sendMutation.mutate(draft.trim());
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
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

          <View className="mt-3 rounded-2xl border border-border bg-card px-4 py-3">
            <Text className="text-lg font-semibold text-foreground">Messages</Text>
            {!isConnected && (
              <Text className="mt-1 text-xs text-destructive">
                Offline — messages will load when you reconnect
              </Text>
            )}
          </View>
        </View>

          {messagesQuery.isLoading && (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator />
            </View>
          )}

          <FlashList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingVertical: 16 }}
            estimatedItemSize={84}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const isMe = item.senderId === currentUserId;
              return (
                <View
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    isMe
                      ? "self-end bg-primary"
                      : "self-start border border-border bg-card"
                  }`}
                >
                  <Text className={isMe ? "text-primary-foreground" : "text-foreground"}>
                    {item.content}
                  </Text>
                  <View className="mt-1 flex-row items-center gap-1">
                    <Text
                      className={`text-[11px] ${
                        isMe ? "text-primary-foreground/80" : "text-muted-foreground"
                      }`}
                    >
                      {formatTime(item.createdAt)}
                    </Text>
                    {isMe && item.readAt && (
                      <Text className="text-[11px] text-primary-foreground/80">· Read</Text>
                    )}
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              !messagesQuery.isLoading ? (
                <View className="items-center py-12">
                  <Text className="text-sm text-muted-foreground">
                    No messages yet. Say hello!
                  </Text>
                </View>
              ) : null
            }
          />

          <View className="border-t border-border bg-background pb-5 pt-3">
            <View className="flex-row items-center gap-2">
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={isConnected ? "Type your message" : "You're offline"}
                placeholderTextColor="hsl(218 11% 65%)"
                editable={isConnected}
                className="min-h-12 flex-1 rounded-xl border border-border bg-card px-4 text-foreground"
                onSubmitEditing={handleSend}
              />
              <Pressable
                onPress={handleSend}
                disabled={!canSend}
                className={`h-12 w-12 items-center justify-center rounded-xl ${
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
