import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MessageCircle, Pencil, User as UserIcon } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import {
  ActivityIndicator,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { client } from "@/api/client";
import { showAppToast } from "@/components/shared/AppToast";
import { Button } from "@/components/shared/Button";
import { Screen } from "@/components/shared/Screen";
import { useAuthStore } from "@/store/authStore";

type ProfileTab = "nearby" | "requests";

function TabChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 rounded-xl px-3 py-2 ${active ? "bg-primary" : "bg-card"}`}
    >
      <Text
        className={`text-center text-sm font-semibold ${active ? "text-primary-foreground" : "text-foreground"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const accessToken = useAuthStore((s) => s.accessToken);
  const login = useAuthStore((s) => s.login);
  const queryClient = useQueryClient();

  const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const initialTab: ProfileTab = tabParam === "requests" ? "requests" : "nearby";
  const [tab, setTab] = useState<ProfileTab>(initialTab);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [socialOptIn, setSocialOptIn] = useState(false);

  useEffect(() => {
    const t = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    if (t === "requests") setTab("requests");
    else if (t === "nearby") setTab("nearby");
  }, [params.tab]);

  const meQuery = useQuery({
    queryKey: ["users-me"],
    queryFn: async () => {
      const res = await client.api.v1.users.me.get();
      if (res.error) throw new Error("profile");
      return res.data;
    },
    enabled: Boolean(accessToken),
  });

  const user = meQuery.data?.user;

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setBio(user.bio ?? "");
    setSocialOptIn(Boolean(user.socialOptIn));
  }, [user?.id, user?.name, user?.bio, user?.socialOptIn]);

  const nearbyQuery = useQuery({
    queryKey: ["social-nearby"],
    queryFn: async () => {
      const res = await client.api.v1.social.nearby.get();
      if (res.error) throw new Error("nearby");
      return res.data;
    },
    enabled: Boolean(accessToken) && tab === "nearby",
  });

  const pendingQuery = useQuery({
    queryKey: ["connections-pending"],
    queryFn: async () => {
      const res = await client.api.v1.connections.pending.get();
      if (res.error) throw new Error("pending");
      return res.data;
    },
    enabled: Boolean(accessToken) && tab === "requests",
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await client.api.v1.users.me.patch({
        name: name.trim(),
        bio: bio.trim() || null,
        socialOptIn,
      });
      if (res.error) throw new Error("save");
      return res.data;
    },
    onSuccess: (data) => {
      if (data?.user && accessToken) {
        login({
          user: {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            username: data.user.username,
            avatarUrl: data.user.avatarUrl,
            bio: data.user.bio,
            socialOptIn: data.user.socialOptIn,
          },
          accessToken,
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["users-me"] });
      void queryClient.invalidateQueries({ queryKey: ["social-nearby"] });
      setEditing(false);
      showAppToast({ variant: "success", title: "Profile saved" });
    },
    onError: () => {
      showAppToast({ variant: "error", title: "Could not save profile" });
    },
  });

  const connectMutation = useMutation({
    mutationFn: async (receiverId: string) => {
      const res = await client.api.v1.connections.post({ receiverId });
      if (res.error) throw new Error("connect");
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["social-nearby"] });
      void queryClient.invalidateQueries({ queryKey: ["connections-pending"] });
      showAppToast({ variant: "success", title: "Request sent" });
    },
    onError: () => {
      showAppToast({ variant: "error", title: "Could not send request" });
    },
  });

  const respondMutation = useMutation({
    mutationFn: async (payload: { connectionId: string; status: "ACCEPTED" | "REJECTED" }) => {
      const res = await client.api.v1.connections({ connectionId: payload.connectionId }).patch({
        status: payload.status,
      });
      if (res.error) throw new Error("respond");
      return res.data;
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["connections-pending"] });
      void queryClient.invalidateQueries({ queryKey: ["connections-accepted"] });
      void queryClient.invalidateQueries({ queryKey: ["social-nearby"] });
      showAppToast({
        variant: variables.status === "ACCEPTED" ? "success" : "info",
        title: variables.status === "ACCEPTED" ? "Request accepted" : "Request declined",
      });
    },
    onError: () => {
      showAppToast({ variant: "error", title: "Could not update request" });
    },
  });

  const usernameLabel = user?.username ? `@${user.username}` : "@traveler";
  const displayName = user?.name ?? "Traveler";

  const travelers = useMemo(() => nearbyQuery.data?.travelers ?? [], [nearbyQuery.data?.travelers]);

  return (
    <Screen scrollable contentClassName="pb-10">
      <View className="gap-5">
        <Pressable onPress={() => router.back()} className="active:opacity-80">
          <Text className="text-base font-medium text-primary">Back</Text>
        </Pressable>

        {meQuery.isLoading ? (
          <View className="items-center py-10">
            <ActivityIndicator />
          </View>
        ) : meQuery.isError ? (
          <Text className="text-muted-foreground">Could not load your profile.</Text>
        ) : (
          <>
            <View className="flex-row gap-4">
              <View className="h-24 w-24 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                {user?.avatarUrl ? (
                  <Image
                    source={{ uri: user.avatarUrl }}
                    style={{ width: 96, height: 96 }}
                    contentFit="cover"
                  />
                ) : (
                  <View className="h-full w-full items-center justify-center bg-primary/15">
                    <UserIcon size={40} color="hsl(217 91% 60%)" />
                  </View>
                )}
              </View>
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-lg font-bold text-foreground" numberOfLines={1}>
                  {usernameLabel}
                </Text>
                {editing ? (
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground"
                    placeholder="Name"
                    placeholderTextColor="hsl(218 11% 65%)"
                  />
                ) : (
                  <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                    {displayName}
                  </Text>
                )}
                <View className="mt-1 flex-row items-center gap-4">
                  <View className="items-center">
                    <Text className="text-lg font-bold text-foreground">
                      {user?.friendCount ?? 0}
                    </Text>
                    <Text className="text-xs text-muted-foreground">friends</Text>
                  </View>
                  <View className="h-8 w-px bg-border" />
                  <View className="items-center">
                    <Text className="text-lg font-bold text-foreground">
                      {user?.tripCount ?? 0}
                    </Text>
                    <Text className="text-xs text-muted-foreground">trips</Text>
                  </View>
                </View>
              </View>
            </View>

            <View className="gap-2">
              <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Bio
              </Text>
              {editing ? (
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  multiline
                  textAlignVertical="top"
                  className="min-h-24 rounded-xl border border-border bg-background px-4 py-3 text-foreground"
                  placeholder="Tell travelers about you"
                  placeholderTextColor="hsl(218 11% 65%)"
                  maxLength={300}
                />
              ) : (
                <Text className="text-sm leading-6 text-foreground">
                  {(user?.bio ?? "").trim() || "No bio yet."}
                </Text>
              )}
            </View>

            {editing ? (
              <View className="rounded-2xl border border-border bg-card p-4">
                <View className="flex-row items-center justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground">
                      Discoverable nearby
                    </Text>
                    <Text className="mt-1 text-sm text-muted-foreground">
                      Show your profile to travelers at the same destination.
                    </Text>
                  </View>
                  <Switch value={socialOptIn} onValueChange={setSocialOptIn} />
                </View>
              </View>
            ) : null}

            <View className="flex-row flex-wrap gap-2">
              <Pressable
                onPress={() => router.push("/messages" as never)}
                className="flex-1 min-w-[140px] flex-row items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 active:opacity-90"
              >
                <MessageCircle size={18} color="hsl(217 91% 60%)" />
                <Text className="text-sm font-semibold text-foreground">Messages</Text>
              </Pressable>
              {editing ? (
                <>
                  <View className="flex-1 min-w-[120px]">
                    <Button
                      label="Cancel"
                      variant="secondary"
                      onPress={() => {
                        setEditing(false);
                        if (user) {
                          setName(user.name);
                          setBio(user.bio ?? "");
                          setSocialOptIn(Boolean(user.socialOptIn));
                        }
                      }}
                    />
                  </View>
                  <View className="flex-1 min-w-[120px]">
                    <Button
                      label="Save"
                      onPress={() => saveMutation.mutate()}
                      loading={saveMutation.isPending}
                      disabled={!name.trim()}
                    />
                  </View>
                </>
              ) : (
                <Pressable
                  onPress={() => setEditing(true)}
                  className="flex-1 min-w-[140px] flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3 active:opacity-90"
                >
                  <Pencil size={16} color="white" />
                  <Text className="text-sm font-semibold text-primary-foreground">
                    Edit profile
                  </Text>
                </Pressable>
              )}
            </View>

            {!editing ? (
              <Text className="text-xs text-muted-foreground">
                Username is permanent and cannot be changed from the app.
              </Text>
            ) : null}

            <View className="flex-row gap-2 rounded-2xl border border-border bg-muted/30 p-1">
              <TabChip label="Nearby" active={tab === "nearby"} onPress={() => setTab("nearby")} />
              <TabChip
                label="Requests"
                active={tab === "requests"}
                onPress={() => setTab("requests")}
              />
            </View>

            {tab === "nearby" ? (
              <View className="gap-2">
                <Text className="text-sm font-semibold text-foreground">Nearby travelers</Text>
                {nearbyQuery.isLoading ? (
                  <ActivityIndicator />
                ) : travelers.length === 0 ? (
                  <Text className="text-sm text-muted-foreground">
                    No travelers nearby right now. Add an active trip at a destination and opt in to
                    discovery to appear for others.
                  </Text>
                ) : (
                  <FlashList
                    horizontal
                    data={travelers}
                    keyExtractor={(item) => item.id}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
                    estimatedItemSize={160}
                    renderItem={({ item }) => {
                      const st = item.connection?.status;
                      const outgoing = item.connection?.direction === "outgoing";
                      const incomingPending =
                        st === "PENDING" && item.connection?.direction === "incoming";
                      const label = incomingPending
                        ? "Review"
                        : st === "PENDING"
                          ? outgoing
                            ? "Pending"
                            : "Connect"
                          : "Connect";
                      const disabled =
                        (st === "PENDING" && outgoing) ||
                        connectMutation.isPending ||
                        (!user?.socialOptIn && !incomingPending);
                      return (
                        <View className="w-36 rounded-2xl border border-border bg-card p-3">
                          <View className="mx-auto mb-2 h-16 w-16 overflow-hidden rounded-full bg-muted">
                            {item.avatarUrl ? (
                              <Image
                                source={{ uri: item.avatarUrl }}
                                style={{ width: 64, height: 64 }}
                                contentFit="cover"
                              />
                            ) : (
                              <View className="h-full w-full items-center justify-center">
                                <UserIcon size={28} color="hsl(218 11% 65%)" />
                              </View>
                            )}
                          </View>
                          <Text
                            className="text-center text-sm font-semibold text-foreground"
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                          <Text
                            className="mt-1 text-center text-[11px] text-muted-foreground"
                            numberOfLines={2}
                          >
                            {item.bio ?? "Traveler"}
                          </Text>
                          <View className="mt-2">
                            <Button
                              label={label}
                              variant="primary"
                              disabled={disabled}
                              onPress={() => {
                                if (incomingPending) {
                                  setTab("requests");
                                  return;
                                }
                                if (!user?.socialOptIn) {
                                  showAppToast({
                                    variant: "warning",
                                    title: "Opt in to connect",
                                    message:
                                      "Turn on “Discoverable nearby” in Edit profile to send requests.",
                                  });
                                  return;
                                }
                                connectMutation.mutate(item.id);
                              }}
                            />
                          </View>
                        </View>
                      );
                    }}
                  />
                )}
              </View>
            ) : (
              <View className="gap-3">
                {pendingQuery.isLoading ? (
                  <ActivityIndicator />
                ) : (pendingQuery.data?.incoming.length ?? 0) === 0 ? (
                  <View className="items-center rounded-2xl border border-border bg-card py-8">
                    <Text className="text-sm text-muted-foreground">No incoming requests</Text>
                  </View>
                ) : (
                  pendingQuery.data?.incoming.map((req) => (
                    <View key={req.id} className="rounded-2xl border border-border bg-card p-4">
                      <View className="flex-row items-center gap-3">
                        <View className="h-12 w-12 overflow-hidden rounded-full bg-muted">
                          {req.peer.avatarUrl ? (
                            <Image
                              source={{ uri: req.peer.avatarUrl }}
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
                          <Text className="text-base font-semibold text-foreground">
                            {req.peer.name}
                          </Text>
                          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                            @{req.peer.username}
                          </Text>
                        </View>
                      </View>
                      <View className="mt-4 flex-row gap-2">
                        <Button
                          label="Accept"
                          className="flex-1"
                          loading={respondMutation.isPending}
                          onPress={() =>
                            respondMutation.mutate({ connectionId: req.id, status: "ACCEPTED" })
                          }
                        />
                        <Button
                          label="Reject"
                          variant="secondary"
                          className="flex-1"
                          loading={respondMutation.isPending}
                          onPress={() =>
                            respondMutation.mutate({ connectionId: req.id, status: "REJECTED" })
                          }
                        />
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </>
        )}
      </View>
    </Screen>
  );
}
