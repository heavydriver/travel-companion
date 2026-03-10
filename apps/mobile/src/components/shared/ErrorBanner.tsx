import { Text, View } from "react-native";

type ErrorBannerProps = {
  message?: string | null;
};

export function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) {
    return null;
  }

  return (
    <View className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
      <Text className="text-sm text-destructive">{message}</Text>
    </View>
  );
}
