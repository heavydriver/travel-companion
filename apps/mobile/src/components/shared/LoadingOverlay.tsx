import { ActivityIndicator, Text, View } from "react-native";

type LoadingOverlayProps = {
  label?: string;
};

export function LoadingOverlay({ label = "Loading..." }: LoadingOverlayProps) {
  return (
    <View className="absolute inset-0 z-50 items-center justify-center bg-background/80">
      <View className="items-center gap-3 rounded-xl border border-border bg-card px-6 py-5">
        <ActivityIndicator size="large" />
        <Text className="text-sm text-muted-foreground">{label}</Text>
      </View>
    </View>
  );
}
