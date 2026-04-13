import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ChevronRight, MessageCircle, User, Users } from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { client } from "@/api/client";
import { Button } from "@/components/shared/Button";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { Screen } from "@/components/shared/Screen";
import { useAuthStore } from "@/store/authStore";

export default function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const accessToken = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);
  const mutedFg = useUnstableNativeVariable("--muted-foreground");
  const mutedColor = mutedFg ? `hsl(${mutedFg})` : "#9CA3AF";
  const iconColor = useUnstableNativeVariable("--foreground");
  const resolvedIcon = iconColor ? `hsl(${iconColor})` : undefined;

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await client.api.v1.users.me.patch({
        name: name.trim(),
        username: username.trim(),
      });
      if (res.error) throw new Error("Failed to update profile");
      return res.data;
    },
    onSuccess: (data) => {
      if (data?.user && accessToken) {
        login({ user: data.user, accessToken });
      }
      setIsEditing(false);
    },
  });

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

  return (
    <Screen scrollable>
      <View className="gap-6">
        {/* Header */}
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

        <ErrorBanner message={updateMutation.error?.message ?? null} />

        {/* Profile section */}
        <Pressable
          onPress={() => router.push("/profile" as never)}
          className="rounded-2xl border border-border bg-card p-4 active:opacity-90"
        >
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/20">
              <User size={24} color={resolvedIcon} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground">
                Edit Profile
              </Text>
            </View>

            <View className="gap-1">
              <Text className="text-sm font-medium text-muted-foreground">Name</Text>
              <TextInput
                className="rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground"
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={mutedColor}
                maxLength={100}
              />
            </View>

            <View className="gap-1">
              <Text className="text-sm font-medium text-muted-foreground">Username</Text>
              <TextInput
                className="rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground"
                value={username}
                onChangeText={setUsername}
                placeholder="Username"
                placeholderTextColor={mutedColor}
                maxLength={30}
                autoCapitalize="none"
              />
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Button
                  label="Cancel"
                  variant="secondary"
                  onPress={() => {
                    setName(user?.name ?? "");
                    setUsername(user?.username ?? "");
                    setIsEditing(false);
                  }}
                />
              </View>
              <View className="flex-1">
                <Button
                  label="Save"
                  onPress={() => updateMutation.mutate()}
                  loading={updateMutation.isPending}
                  disabled={!name.trim()}
                />
              </View>
            </View>
          </View>
        </Pressable>

        <View className="rounded-2xl border border-border bg-card p-2">
          <Pressable
            onPress={() => router.push("/social-connect" as never)}
            className="flex-row items-center justify-between rounded-xl px-3 py-3 active:opacity-80"
          >
            <View className="flex-row items-center gap-2">
              <Users size={18} color={resolvedIcon} />
              <Text className="text-base text-foreground">Social Connect</Text>
            </View>
            <ChevronRight size={18} color={resolvedIcon} />
          </Pressable>

          <Pressable
            onPress={() => router.push("/messages/c-1" as never)}
            className="flex-row items-center justify-between rounded-xl px-3 py-3 active:opacity-80"
          >
            <View className="flex-row items-center gap-2">
              <MessageCircle size={18} color={resolvedIcon} />
              <Text className="text-base text-foreground">Messaging</Text>
            </View>
            <ChevronRight size={18} color={resolvedIcon} />
          </Pressable>
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
