import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ChevronLeft, MessageCircle, User as UserIcon } from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { client } from "@/api/client";

export default function MessagesInboxScreen() {
  const router = useRouter();
  const iconColor = useUnstableNativeVariable("--foreground");
  const resolvedIcon = iconColor ? `hsl(${iconColor})` : undefined;

  const query = useQuery({
    queryKey: ["connections-accepted"],
    queryFn: async () => {
      const res = await client.api.v1.connections.get();
      if (res.error) throw new Error("connections");
      return res.data;
    },
  });

  const rows = query.data?.connections ?? [];

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <View className="border-b border-border px-4 py-3">
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center gap-1 rounded-lg px-1 py-1 active:opacity-80"
          >
            <ChevronLeft size={22} color={resolvedIcon} />
            <Text className="text-base font-medium text-primary">Back</Text>
          </Pressable>
        </View>
        <Text className="mt-3 text-2xl font-bold text-foreground">Messages</Text>
        <Text className="mt-1 text-sm text-muted-foreground">Chats with travelers you have connected with</Text>
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
        <View className="flex-1">
          {rows.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/messages/${c.id}` as never)}
              className="flex-row items-center gap-3 border-b border-border px-4 py-3 active:bg-muted/40"
            >
              <View className="h-14 w-14 overflow-hidden rounded-full bg-muted">
                {c.user.avatarUrl ? (
                  <Image source={{ uri: c.user.avatarUrl }} style={{ width: 56, height: 56 }} contentFit="cover" />
                ) : (
                  <View className="h-full w-full items-center justify-center">
                    <UserIcon size={26} color="hsl(218 11% 65%)" />
                  </View>
                )}
              </View>
              <View className="min-w-0 flex-1">
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                    {c.user.name}
                  </Text>
                  {c.unreadCount > 0 ? (
                    <View className="min-w-6 rounded-full bg-primary px-2 py-0.5">
                      <Text className="text-center text-xs font-bold text-primary-foreground">{c.unreadCount}</Text>
                    </View>
                  ) : null}
                </View>
                <Text className="mt-0.5 text-sm text-muted-foreground" numberOfLines={1}>
                  {c.lastMessage?.content ?? "Say hello"}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}
