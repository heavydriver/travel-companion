import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, User as UserIcon } from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { useCallback, useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { client } from "@/api/client";
import { showAppToast } from "@/components/shared/AppToast";
import { Button } from "@/components/shared/Button";
import { Screen } from "@/components/shared/Screen";
import { invalidateSocialGraphQueries } from "@/lib/socialQueries";
import { useAuthStore } from "@/store/authStore";
import { useNetworkStore } from "@/store/networkStore";

export default function UserProfileScreen() {
  const router = useRouter();
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const userId = Array.isArray(rawId) ? rawId[0] : rawId;
  const me = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const isConnectedNet = useNetworkStore((s) => s.isConnected);
  const iconColor = useUnstableNativeVariable("--foreground");
  const resolvedIcon = iconColor ? `hsl(${iconColor})` : undefined;

  useEffect(() => {
    if (userId && me?.id && userId === me.id) {
      router.replace("/profile" as never);
    }
  }, [userId, me?.id, router]);

  useFocusEffect(
    useCallback(() => {
      if (!accessToken || !userId || userId === me?.id) return;
      void queryClient.invalidateQueries({ queryKey: ["user-public", userId] });
      void invalidateSocialGraphQueries(queryClient);
    }, [accessToken, me?.id, queryClient, userId]),
  );

  const profileQuery = useQuery({
    queryKey: ["user-public", userId],
    queryFn: async () => {
      if (!userId) throw new Error("user-public");
      const res = await client.api.v1.users({ id: userId }).get();
      if (res.error) throw new Error("user-public");
      return res.data;
    },
    enabled: Boolean(accessToken && userId && userId !== me?.id),
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("connect");
      const res = await client.api.v1.connections.post({ receiverId: userId });
      if (res.error) throw new Error("connect");
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["user-public", userId] });
      void invalidateSocialGraphQueries(queryClient);
      showAppToast({ variant: "success", title: "Request sent" });
    },
    onError: () => {
      showAppToast({ variant: "error", title: "Could not send request" });
    },
  });

  const respondMutation = useMutation({
    mutationFn: async (status: "ACCEPTED" | "REJECTED") => {
      const connId = profileQuery.data?.connection?.id;
      if (!connId) throw new Error("no connection");
      const res = await client.api.v1.connections({ connectionId: connId }).patch({ status });
      if (res.error) throw new Error("respond");
      return res.data;
    },
    onSuccess: (_, status) => {
      void queryClient.invalidateQueries({ queryKey: ["user-public", userId] });
      void invalidateSocialGraphQueries(queryClient);
      showAppToast({
        variant: status === "ACCEPTED" ? "success" : "info",
        title: status === "ACCEPTED" ? "You are connected" : "Request declined",
      });
    },
    onError: () => {
      showAppToast({ variant: "error", title: "Could not update request" });
    },
  });

  const data = profileQuery.data;
  const u = data?.user;
  const conn = data?.connection;
  const socialOptIn = Boolean(me?.socialOptIn);

  const primaryBlock = (() => {
    if (!u || !userId) return null;

    if (conn?.status === "ACCEPTED") {
      return (
        <Button
          label="Message"
          variant="secondary"
          size="lg"
          className="w-full rounded-xl border border-border bg-card py-4"
          onPress={() => router.push(`/messages/${conn.id}` as never)}
        />
      );
    }

    if (conn?.status === "PENDING" && conn.direction === "outgoing") {
      return (
        <Button
          label="Request sent"
          variant="primary"
          size="lg"
          disabled
          className="w-full rounded-xl py-4"
          onPress={() => {}}
        />
      );
    }

    if (conn?.status === "PENDING" && conn.direction === "incoming") {
      return (
        <View className="w-full gap-2">
          <Button
            label="Accept request"
            variant="primary"
            size="lg"
            loading={respondMutation.isPending}
            className="w-full rounded-xl py-4"
            onPress={() => respondMutation.mutate("ACCEPTED")}
          />
          <Button
            label="Decline"
            variant="secondary"
            size="lg"
            loading={respondMutation.isPending}
            className="w-full rounded-xl py-4"
            onPress={() => respondMutation.mutate("REJECTED")}
          />
        </View>
      );
    }

    if (conn?.status === "REJECTED") {
      return (
        <Button
          label="Unavailable"
          variant="secondary"
          size="lg"
          disabled
          className="w-full rounded-xl py-4"
          onPress={() => {}}
        />
      );
    }

    return (
      <Button
        label="Connect"
        variant="primary"
        size="lg"
        loading={connectMutation.isPending}
        disabled={!socialOptIn || !isConnectedNet}
        className="w-full rounded-xl py-4"
        onPress={() => {
          if (!isConnectedNet) {
            showAppToast({ variant: "warning", title: "You are offline" });
            return;
          }
          if (!socialOptIn) {
            showAppToast({
              variant: "warning",
              title: "Opt in to connect",
              message: "Turn on Discoverable nearby in your profile to send requests.",
            });
            return;
          }
          connectMutation.mutate();
        }}
      />
    );
  })();

  if (!userId || userId === me?.id) {
    return (
      <Screen contentClassName="items-center justify-center">
        <ActivityIndicator />
      </Screen>
    );
  }

  return (
    <Screen scrollable contentClassName="pb-8">
      <Pressable
        onPress={() => router.back()}
        className="mb-4 flex-row items-center gap-1 self-start active:opacity-80"
      >
        <ChevronLeft size={20} color={resolvedIcon} />
        <Text className="text-base font-medium text-primary">Back</Text>
      </Pressable>

      {profileQuery.isLoading ? (
        <View className="items-center py-16">
          <ActivityIndicator />
        </View>
      ) : profileQuery.isError || !u ? (
        <Text className="text-muted-foreground">Could not load this profile.</Text>
      ) : (
        <View className="gap-4">
          <View className="overflow-hidden rounded-[28px] bg-muted">
            {u.avatarUrl ? (
              <Image
                source={{ uri: u.avatarUrl }}
                style={{ width: "100%", aspectRatio: 1 }}
                contentFit="cover"
              />
            ) : (
              <View
                className="w-full items-center justify-center bg-primary/10"
                style={{ aspectRatio: 1 }}
              >
                <UserIcon size={72} color="hsl(217 91% 60%)" />
              </View>
            )}
          </View>

          <View className="gap-1">
            <Text className="text-2xl font-bold text-foreground">{u.name}</Text>
            <Text className="text-base text-muted-foreground">@{u.username}</Text>
          </View>

          {u.bio && (
            <Text className="text-base font-medium leading-6 text-muted-foreground">
              {u.bio.trim()}
            </Text>
          )}

          <View className="flex-row flex-wrap gap-x-10 gap-y-2">
            <Text className="text-base text-foreground">
              <Text className="font-bold text-foreground">{u.friendCount}</Text>
              <Text className="text-muted-foreground"> Friends</Text>
            </Text>
            <Text className="text-base text-foreground">
              <Text className="font-bold text-foreground">{u.tripCount}</Text>
              <Text className="text-muted-foreground"> Trips</Text>
            </Text>
          </View>

          <View className="mt-2">{primaryBlock}</View>
        </View>
      )}
    </Screen>
  );
}
