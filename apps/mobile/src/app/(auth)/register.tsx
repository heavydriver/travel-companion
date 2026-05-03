import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Pressable, Text, View } from "react-native";
import { z } from "zod";
import { useEden } from "@/api/client";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { AuthTextField } from "@/components/auth/AuthTextField";
import { OAuthButton } from "@/components/auth/OAuthButton";
import { Button } from "@/components/shared/Button";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { LoadingOverlay } from "@/components/shared/LoadingOverlay";
import { Screen } from "@/components/shared/Screen";
import { useGoogleAuth } from "@/features/auth/googleAuth";
import { useAuthStore } from "@/store/authStore";
import { analytics } from "@/utils/analytics";

const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be 30 characters or fewer"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const eden = useEden();
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const googleAuth = useGoogleAuth();

  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      username: "",
      email: "",
      password: "",
    },
  });

  const registerMutation = useMutation({
    ...eden.api.v1.auth.register.post.mutationOptions(),
  });

  const onGooglePress = async () => {
    setError(null);
    try {
      await googleAuth.signIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to continue with Google.");
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const data = await registerMutation.mutateAsync(values);
      await login({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      analytics.register("email");
      router.replace("/(tabs)" as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to register. Please try again.");
    }
  });

  return (
    <Screen scrollable>
      <View className="flex-1 gap-6">
        <AuthHeader
          title="Create account"
          subtitle="Start planning your adventures in one place."
        />

        <ErrorBanner message={error ?? null} />

        <View className="gap-4">
          <AuthTextField
            control={control}
            name="name"
            label="Name"
            placeholder="Your full name"
            keyboardType="default"
          />
          <AuthTextField
            control={control}
            name="username"
            label="Username"
            placeholder="Choose a username"
            keyboardType="default"
          />
          <AuthTextField
            control={control}
            name="email"
            label="Email"
            placeholder="you@example.com"
            keyboardType="email-address"
          />
          <AuthTextField
            control={control}
            name="password"
            label="Password"
            placeholder="Create a password"
            secureTextEntry
          />
        </View>

        <View className="gap-3">
          <Button
            label="Create account"
            onPress={() => void onSubmit()}
            loading={isSubmitting || registerMutation.isPending}
          />
          <OAuthButton
            provider="google"
            onPress={() => void onGooglePress()}
            loading={googleAuth.isPending}
          />
          <OAuthButton provider="apple" onPress={() => undefined} />
        </View>

        <View className="items-center gap-1">
          <Text className="text-sm text-muted-foreground">Already have an account?</Text>
          <Pressable onPress={() => router.push("/(auth)/login" as never)}>
            <Text className="font-semibold text-primary">Login</Text>
          </Pressable>
        </View>
      </View>
      {registerMutation.isPending || googleAuth.isPending ? (
        <LoadingOverlay label="Signing you in..." />
      ) : null}
    </Screen>
  );
}
