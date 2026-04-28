import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { ChevronLeft, MessageCircle, User as UserIcon } from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { useCallback } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { client } from "@/api/client";

type InboxRow = {
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

function formatConversationTime(iso: string | null | undefined) {
  if (!iso) return "New";
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function MessagesInboxScreen() {
  const router = useRouter();
  const iconColor = useUnstableNativeVariable("--foreground");
  const primaryColor = useUnstableNativeVariable("--primary");
  const resolvedIcon = iconColor ? `hsl(${iconColor})` : undefined;
  const resolvedPrimary = primaryColor ? `hsl(${primaryColor})` : "hsl(217 91% 60%)";

  const query = useQuery({
    queryKey: ["connections-accepted"],
    queryFn: async () => {
      const res = await client.api.v1.connections.get();
      if (res.error) throw new Error("connections");
      return res.data;
    },
  });
  const { refetch } = query;

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const rows = [...((query.data?.connections ?? []) as InboxRow[])].sort((a, b) => {
    const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
    return bTime - aTime;
  });
  const unreadTotal = rows.reduce((sum, row) => sum + row.unreadCount, 0);

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <View className="border-b border-border bg-background px-4 pb-4 pt-3">
        <View className="flex-row items-center justify-between gap-3">
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center gap-1 rounded-lg px-1 py-1 active:opacity-80"
          >
            <ChevronLeft size={22} color={resolvedIcon} />
            <Text className="text-base font-medium text-primary">Back</Text>
          </Pressable>
          <View className="rounded-full border border-primary/15 bg-card/80 px-3 py-1.5">
            <Text className="text-xs font-semibold uppercase tracking-[1px] text-primary">
              {unreadTotal > 0 ? `${unreadTotal} unread` : "All caught up"}
            </Text>
          </View>
        </View>
        <Text className="mt-4 text-3xl font-bold tracking-tight text-foreground">Messages</Text>
        <Text className="mt-1 text-sm leading-5 text-muted-foreground">
          Recent chats stay on top. Jump back into trip planning fast.
        </Text>
      </View>

      {query.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : query.isError ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-muted-foreground">Could not load conversations.</Text>
        </View>
      ) : rows.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <MessageCircle size={40} color="hsl(218 11% 65%)" />
          <Text className="text-center text-muted-foreground">
            No conversations yet. Connect with someone from your profile, then message them here.
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-3 px-4 py-4"
          showsVerticalScrollIndicator={false}
        >
          {rows.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/messages/${c.id}` as never)}
              className={`rounded-[28px] border px-4 py-4 active:opacity-95 ${
                c.unreadCount > 0 ? "border-primary/20 bg-card" : "border-border/80 bg-card"
              }`}
            >
              <View className="flex-row items-center gap-3">
                <View className="h-16 w-16 overflow-hidden rounded-full border border-primary/10 bg-muted">
                  {c.user.avatarUrl ? (
                    <Image
                      source={{ uri: c.user.avatarUrl }}
                      style={{ width: 64, height: 64 }}
                      contentFit="cover"
                    />
                  ) : (
                    <View className="h-full w-full items-center justify-center">
                      <UserIcon size={28} color="hsl(218 11% 65%)" />
                    </View>
                  )}
                </View>
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="min-w-0 flex-1">
                      <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                        {c.user.name}
                      </Text>
                      <Text className="mt-0.5 text-xs uppercase tracking-[0.8px] text-muted-foreground">
                        @{c.user.username}
                      </Text>
                    </View>
                    <View className="items-end gap-2">
                      <Text
                        className={`text-xs font-medium ${
                          c.unreadCount > 0 ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {formatConversationTime(c.lastMessage?.createdAt)}
                      </Text>
                      {c.unreadCount > 0 ? (
                        <View
                          className="min-w-7 rounded-full px-2 py-1"
                          style={{ backgroundColor: resolvedPrimary }}
                        >
                          <Text className="text-center text-[11px] font-bold text-primary-foreground">
                            {c.unreadCount}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <Text
                    className={`mt-3 text-sm leading-5 ${
                      c.unreadCount > 0 ? "font-medium text-foreground" : "text-muted-foreground"
                    }`}
                    numberOfLines={2}
                  >
                    {c.lastMessage?.content ?? "Say hello and start planning together."}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
