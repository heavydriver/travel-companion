import { useRouter } from "expo-router";
import { ShieldCheck, User as UserIcon, Users } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";
import { Button } from "@/components/shared/Button";
import { Screen } from "@/components/shared/Screen";
import { useAuthStore } from "@/store/authStore";

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState("Explorer who loves local cafes and hidden streets.");
  const [socialOptIn, setSocialOptIn] = useState(false);

  return (
    <Screen scrollable contentClassName="pb-8">
      <View className="gap-6">
        <Pressable onPress={() => router.back()} className="active:opacity-80">
          <Text className="text-base font-medium text-primary">Back</Text>
        </Pressable>

        <Text className="text-2xl font-bold text-foreground">Profile</Text>

        <View className="items-center gap-3 rounded-2xl border border-border bg-card p-5">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-primary/15">
            <UserIcon size={34} color="hsl(217 91% 60%)" />
          </View>
          <View className="items-center">
            <Text className="text-lg font-semibold text-foreground">{name || "Traveler"}</Text>
            <Text className="text-sm text-muted-foreground">{user?.email}</Text>
          </View>
        </View>

        <View className="gap-3 rounded-2xl border border-border bg-card p-4">
          <Text className="text-sm font-medium text-foreground">Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            className="min-h-12 rounded-xl border border-border bg-background px-4 text-foreground"
            placeholder="Your name"
            placeholderTextColor="hsl(218 11% 65%)"
          />

          <Text className="text-sm font-medium text-foreground">Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            className="min-h-12 rounded-xl border border-border bg-background px-4 text-foreground"
            placeholder="@username"
            placeholderTextColor="hsl(218 11% 65%)"
            autoCapitalize="none"
          />

          <Text className="text-sm font-medium text-foreground">Bio</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            multiline
            textAlignVertical="top"
            className="min-h-24 rounded-xl border border-border bg-background px-4 py-3 text-foreground"
            placeholder="Tell other travelers about yourself"
            placeholderTextColor="hsl(218 11% 65%)"
          />
        </View>

        <View className="rounded-2xl border border-border bg-card p-4">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Users size={16} color="hsl(217 91% 60%)" />
                <Text className="text-base font-semibold text-foreground">
                  Show me to other travelers nearby
                </Text>
              </View>
              <Text className="mt-1 text-sm leading-5 text-muted-foreground">
                When enabled, your profile can appear to travelers at the same destination.
              </Text>
            </View>
            <Switch value={socialOptIn} onValueChange={setSocialOptIn} />
          </View>
        </View>

        <View className="rounded-2xl border border-border bg-card p-4">
          <View className="flex-row items-center gap-2">
            <ShieldCheck size={16} color="hsl(142 71% 45%)" />
            <Text className="text-sm text-muted-foreground">
              Profile updates are currently local-only until Phase 4 API endpoints are wired.
            </Text>
          </View>
        </View>

        <Button label="Save Profile" onPress={() => router.back()} />
        <Button
          label="Open Social Connect"
          variant="secondary"
          onPress={() => router.push("/social-connect" as never)}
        />
      </View>
    </Screen>
  );
}
