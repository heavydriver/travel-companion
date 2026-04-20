import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { MessageCircle, UserCheck, Users, X } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { client } from "@/api/client";
import { Button } from "@/components/shared/Button";
import { Screen } from "@/components/shared/Screen";
import { useNetworkStore } from "@/store/networkStore";

type SocialTab = "nearby" | "connections";

type NearbyTraveler = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  daysRemaining: number;
  destinationId: string;
  connection: {
    id: string;
    status: "PENDING" | "ACCEPTED" | "REJECTED";
    direction: "outgoing" | "incoming";
  } | null;
};

type AcceptedConnection = {
  id: string;
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
};

function TabButton({
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

export default function SocialConnectScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isConnected = useNetworkStore((s) => s.isConnected);
  const [activeTab, setActiveTab] = useState<SocialTab>("nearby");
  const [selectedTraveler, setSelectedTraveler] = useState<NearbyTraveler | null>(null);

  const nearbyQuery = useQuery({
    queryKey: ["social", "nearby"],
    queryFn: async () => {
      const res = await client.api.v1.social.nearby.get();
      if (res.error) throw new Error("Failed to load nearby travelers");
      return res.data;
    },
  });

  const connectionsQuery = useQuery({
    queryKey: ["social", "connections"],
    queryFn: async () => {
      const res = await client.api.v1.connections.get();
      if (res.error) throw new Error("Failed to load connections");
      return res.data;
    },
  });

  const connectMutation = useMutation({
    mutationFn: async (receiverId: string) => {
      const res = await client.api.v1.connections.post({ receiverId });
      if (res.error) throw new Error("Failed to send connection request");
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social"] });
      setSelectedTraveler(null);
    },
    onError: (err) => Alert.alert("Error", err.message),
  });

  const respondMutation = useMutation({
    mutationFn: async ({
      connectionId,
      status,
    }: {
      connectionId: string;
      status: "ACCEPTED" | "REJECTED";
    }) => {
      const res = await client.api.v1
        .connections({ connectionId })
        .patch({ status });
      if (res.error) throw new Error("Failed to update connection");
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social"] });
    },
  });

  const travelers = (nearbyQuery.data?.travelers ?? []) as NearbyTraveler[];
  const connections = (connectionsQuery.data?.connections ?? []) as AcceptedConnection[];

  const pendingIncoming = travelers.filter(
    (t) => t.connection?.status === "PENDING" && t.connection.direction === "incoming"
  );
  const nearbyVisible = travelers.filter(
    (t) => !t.connection || t.connection.status === "PENDING"
  );

  const onRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["social"] });
  };

  return (
    <Screen>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-8"
        refreshControl={
          <RefreshControl
            refreshing={nearbyQuery.isRefetching || connectionsQuery.isRefetching}
            onRefresh={onRefresh}
          />
        }
      >
        <View className="gap-5">
          <Pressable onPress={() => router.back()} className="active:opacity-80">
            <Text className="text-base font-medium text-primary">Back</Text>
          </Pressable>

          <View>
            <Text className="text-2xl font-bold text-foreground">Social Connect</Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              Find nearby travelers, manage requests, and start messaging.
            </Text>
          </View>

          {!isConnected && (
            <View className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
              <Text className="text-sm text-destructive">
                You're offline. Social features require an internet connection.
              </Text>
            </View>
          )}

          <View className="flex-row gap-2 rounded-2xl border border-border bg-muted/30 p-1">
            <TabButton label="Nearby" active={activeTab === "nearby"} onPress={() => setActiveTab("nearby")} />
            <TabButton
              label={`Connections${connections.length > 0 ? ` (${connections.length})` : ""}`}
              active={activeTab === "connections"}
              onPress={() => setActiveTab("connections")}
            />
          </View>

          {/* Pending incoming requests banner */}
          {pendingIncoming.length > 0 && activeTab === "nearby" && (
            <View className="gap-2">
              <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pending Requests
              </Text>
              {pendingIncoming.map((t) => (
                <View key={t.id} className="rounded-2xl border border-border bg-card p-4">
                  <Text className="text-base font-semibold text-foreground">{t.name}</Text>
                  <Text className="mt-0.5 text-sm text-muted-foreground">@{t.username}</Text>
                  {t.bio && (
                    <Text className="mt-1 text-sm text-muted-foreground" numberOfLines={2}>
                      {t.bio}
                    </Text>
                  )}
                  <View className="mt-3 flex-row gap-2">
                    <Button
                      label="Accept"
                      onPress={() =>
                        t.connection &&
                        respondMutation.mutate({
                          connectionId: t.connection.id,
                          status: "ACCEPTED",
                        })
                      }
                      className="flex-1"
                    />
                    <Button
                      label="Reject"
                      onPress={() =>
                        t.connection &&
                        respondMutation.mutate({
                          connectionId: t.connection.id,
                          status: "REJECTED",
                        })
                      }
                      variant="secondary"
                      className="flex-1"
                    />
                  </View>
                </View>
              ))}
            </View>
          )}

          {activeTab === "nearby" && (
            <View className="gap-3">
              {nearbyQuery.isLoading && (
                <View className="items-center py-8">
                  <ActivityIndicator />
                </View>
              )}

              {!nearbyQuery.isLoading && nearbyVisible.length === 0 && (
                <View className="items-center rounded-2xl border border-border bg-card py-8">
                  <Users size={24} color="hsl(218 11% 65%)" />
                  <Text className="mt-2 text-sm text-muted-foreground">
                    No nearby travelers right now
                  </Text>
                  <Text className="mt-1 px-8 text-center text-xs text-muted-foreground">
                    You need an active trip to discover fellow travelers at the same destination.
                  </Text>
                </View>
              )}

              {nearbyVisible
                .filter((t) => t.connection?.direction !== "incoming")
                .map((traveler) => (
                  <Pressable
                    key={traveler.id}
                    onPress={() => setSelectedTraveler(traveler)}
                    className="rounded-2xl border border-border bg-card p-4 active:opacity-90"
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-foreground">
                          {traveler.name}
                        </Text>
                        <Text className="text-sm text-muted-foreground">@{traveler.username}</Text>
                        {traveler.bio && (
                          <Text className="mt-1 text-sm text-muted-foreground" numberOfLines={2}>
                            {traveler.bio}
                          </Text>
                        )}
                      </View>
                      <View className="items-end gap-1">
                        <View className="rounded-full bg-primary/15 px-3 py-1">
                          <Text className="text-xs font-semibold text-primary">
                            {traveler.daysRemaining}d left
                          </Text>
                        </View>
                        {traveler.connection?.status === "PENDING" && (
                          <Text className="text-xs text-muted-foreground">Pending</Text>
                        )}
                      </View>
                    </View>
                  </Pressable>
                ))}
            </View>
          )}

          {activeTab === "connections" && (
            <View className="gap-3">
              {connectionsQuery.isLoading && (
                <View className="items-center py-8">
                  <ActivityIndicator />
                </View>
              )}

              {!connectionsQuery.isLoading && connections.length === 0 && (
                <View className="items-center rounded-2xl border border-border bg-card py-8">
                  <UserCheck size={24} color="hsl(218 11% 65%)" />
                  <Text className="mt-2 text-sm text-muted-foreground">No connections yet</Text>
                </View>
              )}

              {connections.map((connection) => (
                <View key={connection.id} className="rounded-2xl border border-border bg-card p-4">
                  <View className="flex-row items-center justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-foreground">
                        {connection.user.name}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => router.push(`/messages/${connection.id}` as never)}
                      className="flex-row items-center gap-1 rounded-xl bg-primary px-3 py-2 active:opacity-90"
                    >
                      <MessageCircle size={14} color="white" />
                      <Text className="text-xs font-semibold text-primary-foreground">Message</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Traveler detail modal */}
      <Modal
        visible={Boolean(selectedTraveler)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedTraveler(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-6">
          <View className="w-full rounded-2xl border border-border bg-card p-5">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-lg font-semibold text-foreground">
                  {selectedTraveler?.name}
                </Text>
                <Text className="text-sm text-muted-foreground">
                  @{selectedTraveler?.username}
                </Text>
                {selectedTraveler?.bio && (
                  <Text className="mt-2 text-sm leading-5 text-muted-foreground">
                    {selectedTraveler.bio}
                  </Text>
                )}
                <Text className="mt-2 text-xs text-muted-foreground">
                  {selectedTraveler?.daysRemaining} days remaining at destination
                </Text>
              </View>
              <Pressable onPress={() => setSelectedTraveler(null)} className="rounded-full p-1">
                <X size={18} color="hsl(218 11% 65%)" />
              </Pressable>
            </View>
            <View className="mt-5">
              {selectedTraveler?.connection?.status === "PENDING" ? (
                <Button label="Request Pending" onPress={() => {}} disabled />
              ) : (
                <Button
                  label="Send Connection Request"
                  onPress={() => {
                    if (!selectedTraveler) return;
                    connectMutation.mutate(selectedTraveler.id);
                  }}
                  disabled={connectMutation.isPending || !isConnected}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
