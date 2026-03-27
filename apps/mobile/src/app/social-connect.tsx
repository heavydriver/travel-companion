import { useRouter } from "expo-router";
import { MessageCircle, UserCheck, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Button } from "@/components/shared/Button";
import { Screen } from "@/components/shared/Screen";

type SocialTab = "nearby" | "requests" | "connections";
type ConnectionStatus = "none" | "pending" | "accepted" | "rejected";

type Traveler = {
  id: string;
  name: string;
  bio: string;
  daysRemaining: number;
  connectionStatus: ConnectionStatus;
};

type ConnectionRequest = {
  id: string;
  name: string;
  note: string;
};

type AcceptedConnection = {
  id: string;
  name: string;
  lastMessagePreview: string;
};

const INITIAL_TRAVELERS: Traveler[] = [
  {
    id: "t-1",
    name: "Maya Chen",
    bio: "Food-focused traveler, currently exploring hidden ramen spots.",
    daysRemaining: 4,
    connectionStatus: "none",
  },
  {
    id: "t-2",
    name: "Luca Romano",
    bio: "Photographer searching for sunrise viewpoints.",
    daysRemaining: 2,
    connectionStatus: "pending",
  },
];

const INITIAL_REQUESTS: ConnectionRequest[] = [
  {
    id: "r-1",
    name: "Elena Park",
    note: "Hey! Want to share local museum tips?",
  },
];

const INITIAL_CONNECTIONS: AcceptedConnection[] = [
  {
    id: "c-1",
    name: "Noah Silva",
    lastMessagePreview: "Let's meet near the old town square at 6?",
  },
];

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
      accessibilityRole="button"
      accessibilityLabel={`${label} tab`}
    >
      <Text className={`text-center text-sm font-semibold ${active ? "text-primary-foreground" : "text-foreground"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function SocialConnectScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SocialTab>("nearby");
  const [travelers, setTravelers] = useState(INITIAL_TRAVELERS);
  const [requests, setRequests] = useState(INITIAL_REQUESTS);
  const [connections, setConnections] = useState(INITIAL_CONNECTIONS);
  const [selectedTraveler, setSelectedTraveler] = useState<Traveler | null>(null);

  const nearbyVisible = useMemo(
    () => travelers.filter((traveler) => traveler.connectionStatus !== "rejected"),
    [travelers],
  );

  const connectToTraveler = (travelerId: string) => {
    setTravelers((prev) =>
      prev.map((traveler) =>
        traveler.id === travelerId
          ? {
              ...traveler,
              connectionStatus: "pending",
            }
          : traveler,
      ),
    );
  };

  const acceptRequest = (request: ConnectionRequest) => {
    setConnections((prev) => [
      ...prev,
      {
        id: `c-${request.id}`,
        name: request.name,
        lastMessagePreview: "Connection accepted. Start your conversation.",
      },
    ]);
    setRequests((prev) => prev.filter((item) => item.id !== request.id));
  };

  const rejectRequest = (requestId: string) => {
    setRequests((prev) => prev.filter((item) => item.id !== requestId));
  };

  return (
    <Screen scrollable contentClassName="pb-8">
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

        <View className="flex-row gap-2 rounded-2xl border border-border bg-muted/30 p-1">
          <TabButton label="Nearby" active={activeTab === "nearby"} onPress={() => setActiveTab("nearby")} />
          <TabButton label="Requests" active={activeTab === "requests"} onPress={() => setActiveTab("requests")} />
          <TabButton
            label="Connections"
            active={activeTab === "connections"}
            onPress={() => setActiveTab("connections")}
          />
        </View>

        {activeTab === "nearby" && (
          <View className="gap-3">
            {nearbyVisible.map((traveler) => (
              <Pressable
                key={traveler.id}
                onPress={() => setSelectedTraveler(traveler)}
                className="rounded-2xl border border-border bg-card p-4 active:opacity-90"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground">{traveler.name}</Text>
                    <Text className="mt-1 text-sm text-muted-foreground" numberOfLines={2}>
                      {traveler.bio}
                    </Text>
                  </View>
                  <View className="rounded-full bg-primary/15 px-3 py-1">
                    <Text className="text-xs font-semibold text-primary">{traveler.daysRemaining} days left</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {activeTab === "requests" && (
          <View className="gap-3">
            {requests.length === 0 && (
              <View className="items-center rounded-2xl border border-border bg-card py-8">
                <UserCheck size={24} color="hsl(218 11% 65%)" />
                <Text className="mt-2 text-sm text-muted-foreground">No pending requests</Text>
              </View>
            )}
            {requests.map((request) => (
              <View key={request.id} className="rounded-2xl border border-border bg-card p-4">
                <Text className="text-base font-semibold text-foreground">{request.name}</Text>
                <Text className="mt-1 text-sm text-muted-foreground">{request.note}</Text>
                <View className="mt-4 flex-row gap-2">
                  <Button label="Accept" onPress={() => acceptRequest(request)} className="flex-1" />
                  <Button
                    label="Reject"
                    onPress={() => rejectRequest(request.id)}
                    variant="secondary"
                    className="flex-1"
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === "connections" && (
          <View className="gap-3">
            {connections.map((connection) => (
              <View key={connection.id} className="rounded-2xl border border-border bg-card p-4">
                <View className="flex-row items-center justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground">{connection.name}</Text>
                    <Text className="mt-1 text-sm text-muted-foreground" numberOfLines={1}>
                      {connection.lastMessagePreview}
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
                <Text className="text-lg font-semibold text-foreground">{selectedTraveler?.name}</Text>
                <Text className="mt-2 text-sm leading-5 text-muted-foreground">{selectedTraveler?.bio}</Text>
              </View>
              <Pressable onPress={() => setSelectedTraveler(null)} className="rounded-full p-1">
                <X size={18} color="hsl(218 11% 65%)" />
              </Pressable>
            </View>
            <View className="mt-5">
              {selectedTraveler?.connectionStatus === "pending" ? (
                <Button label="Pending" onPress={() => {}} disabled />
              ) : (
                <Button
                  label="Connect"
                  onPress={() => {
                    if (!selectedTraveler) return;
                    connectToTraveler(selectedTraveler.id);
                    setSelectedTraveler((prev) =>
                      prev
                        ? {
                            ...prev,
                            connectionStatus: "pending",
                          }
                        : null,
                    );
                  }}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
