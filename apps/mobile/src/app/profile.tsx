import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  Luggage,
  MessageCircle,
  Pencil,
  UserCheck,
  User as UserIcon,
  Users,
} from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiBaseUrl, authAwareFetch, authHeadersForMultipart, client } from "@/api/client";
import { showAppToast } from "@/components/shared/AppToast";
import { Button } from "@/components/shared/Button";
import { Screen } from "@/components/shared/Screen";
import { invalidateSocialGraphQueries } from "@/lib/socialQueries";
import { useAuthStore } from "@/store/authStore";
import { useNetworkStore } from "@/store/networkStore";

type ProfileTab = "nearby" | "requests" | "connections";

const PROFILE_PIC_MAX_BYTES = 10 * 1024 * 1024;

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
      className={`flex-1 items-center justify-center rounded-xl px-3 py-2.5 ${active ? "bg-primary" : "bg-card"}`}
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
  const isConnected = useNetworkStore((s) => s.isConnected);

  const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const initialTab: ProfileTab =
    tabParam === "requests" || tabParam === "connections" ? tabParam : "nearby";
  const [tab, setTab] = useState<ProfileTab>(initialTab);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [socialOptIn, setSocialOptIn] = useState(false);
  const iconColor = useUnstableNativeVariable("--foreground");
  const resolvedIcon = iconColor ? `hsl(${iconColor})` : undefined;

  useEffect(() => {
    const nextTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    if (nextTab === "requests" || nextTab === "nearby" || nextTab === "connections") {
      setTab(nextTab);
    }
  }, [params.tab]);

  useFocusEffect(
    useCallback(() => {
      if (!accessToken) return;
      void queryClient.invalidateQueries({ queryKey: ["users-me"] });
      void invalidateSocialGraphQueries(queryClient);
    }, [accessToken, queryClient]),
  );

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset form from latest profile data
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
    enabled: Boolean(accessToken) && (tab === "nearby" || tab === "requests"),
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

  const connectionsQuery = useQuery({
    queryKey: ["connections-accepted"],
    queryFn: async () => {
      const res = await client.api.v1.connections.get();
      if (res.error) throw new Error("connections");
      return res.data;
    },
    enabled: Boolean(accessToken) && tab === "connections",
  });

  const { mutate: uploadProfilePicture, isPending: isUploadingProfilePicture } = useMutation({
    mutationFn: async (asset: ImagePicker.ImagePickerAsset) => {
      if (asset.fileSize != null && asset.fileSize > PROFILE_PIC_MAX_BYTES) {
        throw new Error("too_large");
      }
      const token = useAuthStore.getState().accessToken;
      if (!token) {
        throw new Error("not_authenticated");
      }

      const form = new FormData();
      form.append("file", {
        uri: asset.uri,
        name: "photo.jpg",
        type: asset.mimeType ?? "image/jpeg",
      } as unknown as Blob);

      const base = apiBaseUrl.replace(/\/$/, "");
      const res = await authAwareFetch(`${base}/api/v1/users/me/profile-picture`, {
        method: "POST",
        headers: authHeadersForMultipart(),
        body: form,
      });
      if (!res.ok) {
        let message = "upload_failed";
        try {
          const j = (await res.json()) as { error?: { message?: string } };
          if (j?.error?.message) message = j.error.message;
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }
      return (await res.json()) as {
        user: {
          id: string;
          email: string;
          name: string;
          username: string;
          avatarUrl: string | null;
          bio: string | null;
          socialOptIn: boolean;
          friendCount: number;
          tripCount: number;
        };
      };
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
      void invalidateSocialGraphQueries(queryClient);
      showAppToast({ variant: "success", title: "Profile photo updated" });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "too_large") {
        showAppToast({ variant: "error", title: "Image must be under 10 MB" });
        return;
      }
      if (msg === "not_authenticated") {
        showAppToast({ variant: "error", title: "Sign in again to update your photo" });
        return;
      }
      showAppToast({
        variant: "error",
        title: msg && msg !== "upload_failed" ? msg : "Could not update photo",
      });
    },
  });

  const pickProfilePhoto = useCallback(async () => {
    if (!isConnected) {
      showAppToast({ variant: "warning", title: "You are offline" });
      return;
    }
    if (isUploadingProfilePicture) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAppToast({
        variant: "warning",
        title: "Photo library access is needed to change your picture",
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.92,
    });

    if (result.canceled || !result.assets[0]) return;
    uploadProfilePicture(result.assets[0]);
  }, [isConnected, isUploadingProfilePicture, uploadProfilePicture]);

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
      void invalidateSocialGraphQueries(queryClient);
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
      if (variables.status === "ACCEPTED") {
        queryClient.setQueryData<{ user: typeof user }>(["users-me"], (current) => {
          if (!current?.user) return current;
          return {
            ...current,
            user: {
              ...current.user,
              friendCount: current.user.friendCount + 1,
            },
          };
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["users-me"] });
      void invalidateSocialGraphQueries(queryClient);
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
  const pendingIncoming = pendingQuery.data?.incoming ?? [];
  const acceptedConnections = connectionsQuery.data?.connections ?? [];
  const incomingCount = pendingIncoming.length;
  const pendingIncomingFromNearby = travelers.filter(
    (item) => item.connection?.status === "PENDING" && item.connection.direction === "incoming",
  ).length;

  const openUserProfile = (otherUserId: string) => {
    if (!user || otherUserId === user.id) return;
    router.push(`/user/${otherUserId}` as never);
  };

  return (
    <Screen scrollable contentClassName="pb-10">
      <View className="gap-5">
        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center gap-1 active:opacity-80"
        >
          <ChevronLeft size={20} color={resolvedIcon} />
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
            {!isConnected ? (
              <View className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3">
                <Text className="text-sm text-destructive">
                  You&apos;re offline. Profile edits and social updates will need connection.
                </Text>
              </View>
            ) : null}

            <View className="overflow-hidden rounded-[28px] border border-border bg-card">
              <View className="bg-primary/10 px-5 pb-5 pt-6">
                <View className="flex-row gap-4">
                  <Pressable
                    accessibilityLabel={editing ? "Change profile photo" : undefined}
                    accessibilityRole={editing ? "button" : undefined}
                    onPress={() => {
                      if (editing) void pickProfilePhoto();
                    }}
                    disabled={!editing}
                    className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-background bg-muted active:opacity-90"
                  >
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
                    {editing ? (
                      <View
                        pointerEvents="none"
                        className="absolute inset-0 items-center justify-center bg-black/25"
                      >
                        <Text className="px-1 text-center text-[10px] font-semibold text-white">
                          Tap to change
                        </Text>
                      </View>
                    ) : null}
                    {isUploadingProfilePicture ? (
                      <View className="absolute inset-0 items-center justify-center bg-background/75">
                        <ActivityIndicator />
                      </View>
                    ) : null}
                  </Pressable>

                  <View className="min-w-0 flex-1 justify-center gap-2">
                    <View className="self-start rounded-full bg-background/90 px-3 py-1">
                      <Text className="text-xs font-semibold uppercase tracking-wide text-primary">
                        {socialOptIn ? "Visible to nearby travelers" : "Private profile"}
                      </Text>
                    </View>

                    {editing ? (
                      <TextInput
                        value={name}
                        onChangeText={setName}
                        className="rounded-xl border border-border bg-background px-3 py-2 text-base font-semibold text-foreground"
                        placeholder="Name"
                        placeholderTextColor="hsl(218 11% 65%)"
                      />
                    ) : (
                      <Text className="text-2xl font-bold text-foreground" numberOfLines={1}>
                        {displayName}
                      </Text>
                    )}

                    <Text className="text-sm font-medium text-muted-foreground" numberOfLines={1}>
                      {usernameLabel}
                    </Text>
                  </View>
                </View>

                <View className="mt-4 w-full flex-row overflow-hidden rounded-2xl border border-border/80 bg-background/85">
                  <View className="min-w-0 flex-1 flex-row items-center gap-3 px-4 py-3.5">
                    <View className="rounded-xl bg-primary/15 p-2">
                      <Users size={18} color="hsl(217 91% 60%)" />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-xl font-bold tabular-nums text-foreground">
                        {user?.friendCount ?? 0}
                      </Text>
                      <Text className="text-xs font-medium text-muted-foreground">Friends</Text>
                    </View>
                  </View>
                  <View className="my-3 w-px shrink-0 bg-border" />
                  <View className="min-w-0 flex-1 flex-row items-center gap-3 px-4 py-3.5">
                    <View className="rounded-xl bg-primary/15 p-2">
                      <Luggage size={18} color="hsl(217 91% 60%)" />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-xl font-bold tabular-nums text-foreground">
                        {user?.tripCount ?? 0}
                      </Text>
                      <Text className="text-xs font-medium text-muted-foreground">Trips</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View className="gap-4 px-5 py-5">
                <View className="gap-2">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    About
                  </Text>
                  {editing ? (
                    <TextInput
                      value={bio}
                      onChangeText={setBio}
                      multiline
                      textAlignVertical="top"
                      className="min-h-24 rounded-2xl border border-border bg-background px-4 py-3 text-foreground"
                      placeholder="Tell travelers about you"
                      placeholderTextColor="hsl(218 11% 65%)"
                      maxLength={300}
                    />
                  ) : (
                    <Text className="text-sm leading-6 text-foreground">
                      {(user?.bio ?? "").trim() ||
                        "Add quick intro so nearby travelers know your vibe."}
                    </Text>
                  )}
                </View>

                <View className="flex-row flex-wrap gap-2">
                  {editing ? (
                    <>
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
                        className="flex-1 min-w-[140px] flex-row items-center justify-center gap-2 rounded-2xl border border-border active:opacity-90"
                      />

                      <Button
                        label="Save"
                        onPress={() => saveMutation.mutate()}
                        loading={saveMutation.isPending}
                        disabled={!name.trim()}
                        className="flex-1 min-w-[140px] flex-row items-center justify-center gap-2 rounded-2xl border border-border active:opacity-90"
                      />
                    </>
                  ) : (
                    <>
                      <Pressable
                        onPress={() => router.push("/messages" as never)}
                        className="flex-1 min-w-[140px] flex-row items-center justify-center gap-2 rounded-2xl border border-border bg-background py-2 active:opacity-90"
                      >
                        <MessageCircle size={18} color="hsl(217 91% 60%)" />
                        <Text className="text-sm font-semibold text-foreground">Messages</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => setEditing(true)}
                        className="flex-1 min-w-[140px] flex-row items-center justify-center gap-2 rounded-2xl bg-primary py-2 active:opacity-90"
                      >
                        <Pencil size={16} color="white" />
                        <Text className="text-sm font-semibold text-primary-foreground">
                          Edit profile
                        </Text>
                      </Pressable>
                    </>
                  )}
                </View>

                {editing ? (
                  <View className="rounded-2xl border border-border bg-background p-4">
                    <View className="flex-row items-center justify-between gap-3">
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-foreground">
                          Discoverable nearby
                        </Text>
                        <Text className="mt-1 text-sm text-muted-foreground">
                          Let travelers at same destination find you and send requests.
                        </Text>
                      </View>
                      <Switch value={socialOptIn} onValueChange={setSocialOptIn} />
                    </View>
                  </View>
                ) : null}

                {editing ? (
                  <Text className="text-xs text-muted-foreground">
                    Username is permanent and cannot be changed from app.
                  </Text>
                ) : null}
              </View>
            </View>

            <View className="rounded-[28px] border border-border bg-card p-4">
              <View className="mb-4">
                <Text className="text-lg font-bold text-foreground">Travel network</Text>
              </View>

              <View className="flex-row gap-2 rounded-2xl border border-border bg-muted/30 p-1">
                <TabChip
                  label="Nearby"
                  active={tab === "nearby"}
                  onPress={() => setTab("nearby")}
                />
                <TabChip
                  label={incomingCount > 0 ? `Requests (${incomingCount})` : "Requests"}
                  active={tab === "requests"}
                  onPress={() => setTab("requests")}
                />
                <TabChip
                  label={
                    acceptedConnections.length > 0
                      ? `Friends (${acceptedConnections.length})`
                      : "Friends"
                  }
                  active={tab === "connections"}
                  onPress={() => setTab("connections")}
                />
              </View>

              {tab === "nearby" ? (
                <View className="mt-4 gap-3">
                  {pendingIncomingFromNearby > 0 ? (
                    <View className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3">
                      <Text className="text-sm font-semibold text-foreground">
                        {pendingIncomingFromNearby} request
                        {pendingIncomingFromNearby === 1 ? "" : "s"} waiting for review
                      </Text>
                      <Pressable
                        onPress={() => setTab("requests")}
                        className="mt-2 self-start rounded-full bg-background px-3 py-1.5"
                      >
                        <Text className="text-xs font-semibold text-primary">Open requests</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {nearbyQuery.isLoading ? (
                    <ActivityIndicator />
                  ) : travelers.length === 0 ? (
                    <View className="items-center rounded-2xl border border-border bg-background px-6 py-8">
                      <Users size={24} color="hsl(218 11% 65%)" />
                      <Text className="mt-3 text-sm text-muted-foreground">Nobody nearby yet</Text>
                    </View>
                  ) : (
                    <FlatList
                      horizontal
                      data={travelers}
                      keyExtractor={(item) => item.id}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
                      renderItem={({ item }) => {
                        const status = item.connection?.status;
                        const outgoing = item.connection?.direction === "outgoing";
                        const incomingPending =
                          status === "PENDING" && item.connection?.direction === "incoming";
                        const label = incomingPending
                          ? "Review"
                          : status === "PENDING"
                            ? outgoing
                              ? "Pending"
                              : "Connect"
                            : "Connect";
                        const disabled =
                          (status === "PENDING" && outgoing) ||
                          connectMutation.isPending ||
                          (!user?.socialOptIn && !incomingPending) ||
                          !isConnected;

                        return (
                          <View className="w-40 rounded-3xl border border-border bg-background p-4">
                            <Pressable
                              onPress={() => openUserProfile(item.id)}
                              className="active:opacity-90"
                            >
                              <View className="mx-auto mb-3 h-16 w-16 overflow-hidden rounded-full bg-muted">
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
                                className="mt-1 text-center text-[11px] leading-4 text-muted-foreground"
                                numberOfLines={3}
                              >
                                {item.bio ?? "Traveler nearby"}
                              </Text>
                            </Pressable>

                            <View className="mt-3">
                              <Button
                                label={label}
                                variant="primary"
                                disabled={disabled}
                                onPress={() => {
                                  if (incomingPending) {
                                    setTab("requests");
                                    return;
                                  }
                                  if (!isConnected) {
                                    showAppToast({
                                      variant: "warning",
                                      title: "You are offline",
                                    });
                                    return;
                                  }
                                  if (!user?.socialOptIn) {
                                    showAppToast({
                                      variant: "warning",
                                      title: "Opt in to connect",
                                      message:
                                        "Turn on Discoverable nearby in Edit profile to send requests.",
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
              ) : null}

              {tab === "requests" ? (
                <View className="mt-4 gap-3">
                  {pendingQuery.isLoading ? (
                    <ActivityIndicator />
                  ) : incomingCount === 0 ? (
                    <View className="items-center rounded-2xl border border-border bg-background py-8">
                      <Text className="text-sm text-muted-foreground">No incoming requests</Text>
                    </View>
                  ) : (
                    pendingIncoming.map((req) => (
                      <View
                        key={req.id}
                        className="rounded-2xl border border-border bg-background p-4"
                      >
                        <Pressable
                          onPress={() => openUserProfile(req.peer.id)}
                          className="active:opacity-90"
                        >
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
                        </Pressable>

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
              ) : null}

              {tab === "connections" ? (
                <View className="mt-4 gap-3">
                  {connectionsQuery.isLoading ? (
                    <ActivityIndicator />
                  ) : acceptedConnections.length === 0 ? (
                    <View className="items-center rounded-2xl border border-border bg-background px-6 py-8">
                      <UserCheck size={24} color="hsl(218 11% 65%)" />
                      <Text className="mt-3 text-sm font-medium text-foreground">
                        No connections yet
                      </Text>
                      <Text className="mt-1 text-center text-sm text-muted-foreground">
                        Accept request or connect with nearby traveler to start chatting.
                      </Text>
                    </View>
                  ) : (
                    acceptedConnections.map((connection) => (
                      <View
                        key={connection.id}
                        className="rounded-2xl border border-border bg-background p-4"
                      >
                        <View className="flex-row items-center justify-between gap-3">
                          <Pressable
                            onPress={() => openUserProfile(connection.user.id)}
                            className="min-w-0 flex-1 flex-row items-center gap-3 active:opacity-90"
                          >
                            <View className="h-12 w-12 overflow-hidden rounded-full bg-muted">
                              {connection.user.avatarUrl ? (
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
                            <Text
                              className="min-w-0 flex-1 text-base font-semibold text-foreground"
                              numberOfLines={1}
                            >
                              {connection.user.name}
                            </Text>
                          </Pressable>

                          <Pressable
                            onPress={() => router.push(`/messages/${connection.id}` as never)}
                            className="flex-row items-center gap-1 rounded-xl bg-primary px-3 py-2 active:opacity-90"
                          >
                            <MessageCircle size={14} color="white" />
                            <Text className="text-xs font-semibold text-primary-foreground">
                              Message
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              ) : null}
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}
