import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Pressable, Text, View } from "react-native";
import { z } from "zod";
import { type AuthResponse, useEden } from "@/api/client";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { AuthTextField } from "@/components/auth/AuthTextField";
import { OAuthButton } from "@/components/auth/OAuthButton";
import { Button } from "@/components/shared/Button";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { LoadingOverlay } from "@/components/shared/LoadingOverlay";
import { Screen } from "@/components/shared/Screen";
import { useAuthStore } from "@/store/authStore";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const eden = useEden();
  const router = useRouter();
  const login = useAuthStore((state) => state.login);

  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({ ...eden.api.v1.auth.login.post.mutationOptions() });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const data = await loginMutation.mutateAsync(values);
      await login({
        user: data.user,
        accessToken: data.accessToken,
      });
      router.replace("/(tabs)" as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid email or password.");
    }
  });

  return (
    <Screen scrollable>
      <View className="flex-1 gap-6">
        <AuthHeader title="Welcome back" subtitle="Sign in to continue planning your trips." />

        <ErrorBanner message={error ?? null} />

        <View className="gap-4">
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
            placeholder="Enter your password"
            secureTextEntry
          />
        </View>

        <View className="gap-3">
          <Button
            label="Login"
            onPress={() => void onSubmit()}
            loading={isSubmitting || loginMutation.isPending}
          />
          <OAuthButton provider="google" onPress={() => undefined} />
          <OAuthButton provider="apple" onPress={() => undefined} />
        </View>

        <View className="items-center gap-1">
          <Text className="text-sm text-muted-foreground">Need an account?</Text>
          <Pressable onPress={() => router.push("/(auth)/register" as never)}>
            <Text className="font-semibold text-primary">Register</Text>
          </Pressable>
        </View>
      </View>
      {loginMutation.isPending ? <LoadingOverlay label="Signing you in..." /> : null}
    </Screen>
  );
}
