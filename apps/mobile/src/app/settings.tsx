import { useRouter } from "expo-router";
import { ChevronRight, User } from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { Alert, Pressable, Text, View } from "react-native";
import { client } from "@/api/client";
import { Button } from "@/components/shared/Button";
import { Screen } from "@/components/shared/Screen";
import { useAuthStore } from "@/store/authStore";

export default function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const iconColor = useUnstableNativeVariable("--muted-foreground");
  const resolvedIcon = iconColor ? `hsl(${iconColor})` : undefined;

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
            // Best-effort — clear local state regardless
          }
          await logout();
          router.replace("/(auth)/login" as never);
        },
      },
    ]);
  };

  return (
    <Screen scrollable>
      <View className="gap-6">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="active:opacity-80">
            <Text className="text-base font-medium text-primary">Back</Text>
          </Pressable>
        </View>

        <Text className="text-2xl font-bold text-foreground">Settings</Text>

        {/* Profile section */}
        <View className="rounded-2xl border border-border bg-card p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/20">
              <User size={24} color={resolvedIcon} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground">
                {user?.name ?? "Traveler"}
              </Text>
              <Text className="text-sm text-muted-foreground">{user?.email}</Text>
            </View>
            <ChevronRight size={20} color={resolvedIcon} />
          </View>
        </View>

        {/* Sign out */}
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
