import { Platform } from "react-native";
import { Button } from "@/components/shared/Button";

type OAuthButtonProps = {
  provider: "google" | "apple";
  onPress: () => void;
  loading?: boolean;
};

export function OAuthButton({ provider, onPress, loading }: OAuthButtonProps) {
  const isGoogle = provider === "google";
  const isVisible =
    (isGoogle && Platform.OS === "android") ||
    (!isGoogle && Platform.OS === "ios");

  if (!isVisible) {
    return null;
  }

  const label = isGoogle ? "Continue with Google" : "Continue with Apple";

  return (
    <Button
      variant="secondary"
      label={label}
      onPress={onPress}
      loading={loading}
      className="w-full"
    />
  );
}
