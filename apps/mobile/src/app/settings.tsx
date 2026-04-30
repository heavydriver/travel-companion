import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, Download, MessageCircle, Ruler, Trash2, User } from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { useEffect } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { client } from "@/api/client";
import { Button } from "@/components/shared/Button";
import { Screen } from "@/components/shared/Screen";
import type { UnitSystem } from "@/lib/units";
import { useAssistantStore } from "@/store/assistantStore";
import { useAuthStore } from "@/store/authStore";
import { usePreferencesStore } from "@/store/preferencesStore";

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

export default function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const unitSystem = usePreferencesStore((s) => s.unitSystem);
  const setUnitSystem = usePreferencesStore((s) => s.setUnitSystem);
  const hydrated = useAssistantStore((s) => s.hydrated);
  const hydrateAssistant = useAssistantStore((s) => s.hydrate);
  const modelState = useAssistantStore((s) => s.modelState);
  const threads = useAssistantStore((s) => s.threads);
  const clearHistory = useAssistantStore((s) => s.clearHistory);
  const deleteModelAndReset = useAssistantStore((s) => s.deleteModelAndReset);

  const iconColor = useUnstableNativeVariable("--foreground");
  const resolvedIcon = iconColor ? `hsl(${iconColor})` : undefined;

  useEffect(() => {
    if (!hydrated) {
      void hydrateAssistant();
    }
  }, [hydrated, hydrateAssistant]);

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await client.api.v1.auth.logout.post();
          } catch {
            // Best-effort
          }
          await logout();
          router.replace("/(auth)/login" as never);
        },
      },
    ]);
  };

  const onUnitsChange = (next: UnitSystem) => {
    void setUnitSystem(next);
  };

  const handleClearAssistantHistory = () => {
    Alert.alert("Clear Chat History", "This will remove your assistant conversations on this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          void clearHistory();
        },
      },
    ]);
  };

  const handleDeleteModel = () => {
    Alert.alert("Delete AI Model", "This removes the downloaded model from this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteModelAndReset();
        },
      },
    ]);
  };

  return (
    <Screen scrollable>
      <View className="gap-6">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center gap-1 active:opacity-80"
          >
            <ChevronLeft size={20} color={resolvedIcon} />
            <Text className="text-base font-medium text-primary">Back</Text>
          </Pressable>
        </View>

        <Text className="text-2xl font-bold text-foreground">Settings</Text>

        <Pressable
          onPress={() => router.push("/profile" as never)}
          className="flex-row items-center gap-3 rounded-2xl border border-border bg-card p-4 active:opacity-90"
        >
          <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/20">
            <User size={24} color={resolvedIcon} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-foreground">Profile & social</Text>
          </View>
          <ChevronRight size={18} color={resolvedIcon} />
        </Pressable>

        <View className="rounded-2xl border border-border bg-card p-4 gap-2">
          <View className="flex-row items-center gap-3">
            <View className="rounded-full bg-primary/15 p-2">
              <Ruler size={18} color={resolvedIcon} />
            </View>
            <Text className="text-base font-semibold text-foreground">Units</Text>
          </View>
          <View className="flex-row gap-2 rounded-2xl border border-border bg-muted/30 p-1">
            <TabChip
              label="Metric"
              active={unitSystem === "metric"}
              onPress={() => onUnitsChange("metric")}
            />
            <TabChip
              label="Imperial"
              active={unitSystem === "imperial"}
              onPress={() => onUnitsChange("imperial")}
            />
          </View>
          <Text className="text-xs text-muted-foreground">
            {unitSystem === "metric" ? "°C · km · km/h" : "°F · mi · mph"}
          </Text>
        </View>

        <View className="rounded-2xl border border-border bg-card p-2">
          <Pressable
            onPress={() => router.push("/messages" as never)}
            className="flex-row items-center justify-between rounded-xl px-2 py-2 active:opacity-80"
          >
            <View className="flex-row items-center gap-2">
              <View className="rounded-full bg-primary/15 p-2">
                <MessageCircle size={18} color={resolvedIcon} />
              </View>
              <Text className="text-base text-foreground">Messages</Text>
            </View>
            <ChevronRight size={18} color={resolvedIcon} />
          </Pressable>
        </View>

        <View className="rounded-2xl border border-border bg-card p-4 gap-3">
          <View className="flex-row items-center gap-3">
            <View className="rounded-full bg-primary/15 p-2">
              <Download size={18} color={resolvedIcon} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground">AI Model</Text>
              <Text className="text-sm text-muted-foreground">
                {modelState.status === "ready"
                  ? "Ready for offline chat"
                  : modelState.status === "downloading"
                    ? "Downloading now"
                    : modelState.status === "paused"
                      ? "Download paused"
                      : modelState.status === "loading"
                        ? "Loading into memory"
                        : "Not downloaded"}
              </Text>
            </View>
          </View>
          <View className="rounded-2xl bg-muted/30 px-4 py-3">
            <Text className="text-sm text-foreground">
              Size: {(modelState.sizeBytes / (1024 * 1024)).toFixed(0)} MB
            </Text>
            <Text className="mt-1 text-xs text-muted-foreground">
              {modelState.downloadedAt
                ? `Downloaded ${new Date(modelState.downloadedAt).toLocaleDateString("en-US")}`
                : "Download it from the Assistant tab when you're ready."}
            </Text>
          </View>
          <Button
            label="Delete Model"
            variant="secondary"
            onPress={handleDeleteModel}
            disabled={!modelState.modelUri}
            className="border-destructive"
          />
        </View>

        <View className="rounded-2xl border border-border bg-card p-4 gap-3">
          <View className="flex-row items-center gap-3">
            <View className="rounded-full bg-primary/15 p-2">
              <Trash2 size={18} color={resolvedIcon} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground">Assistant History</Text>
              <Text className="text-sm text-muted-foreground">
                {threads.length} local {threads.length === 1 ? "thread" : "threads"}
              </Text>
            </View>
          </View>
          <Button
            label="Clear Chat History"
            variant="secondary"
            onPress={handleClearAssistantHistory}
            className="border-destructive"
          />
        </View>

        <View className="rounded-2xl border border-border bg-card p-4">
          <Text className="text-sm font-medium text-muted-foreground">Signed in as</Text>
          <Text className="mt-1 text-base font-semibold text-foreground">
            {user?.name ?? "Traveler"}
          </Text>
          {user?.email ? (
            <Text className="mt-0.5 text-sm text-muted-foreground">{user.email}</Text>
          ) : null}
          {user?.username ? (
            <Text className="mt-1 text-sm text-muted-foreground">@{user.username}</Text>
          ) : null}
        </View>

        <Button
          label="Sign Out"
          variant="secondary"
          onPress={handleSignOut}
          className="border-destructive"
        />
      </View>
    </Screen>
  );
}
