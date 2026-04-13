import { WifiOff } from "lucide-react-native";
import { Text, View } from "react-native";
import { useNetworkStore } from "@/store/networkStore";

export function OfflineBanner() {
  const isConnected = useNetworkStore((s) => s.isConnected);

  if (isConnected) return null;

  return (
    <View className="flex-row items-center justify-center gap-2 bg-destructive/90 px-4 py-2">
      <WifiOff size={14} color="white" />
      <Text className="text-sm font-medium text-white">
        You're offline — some features may be limited
      </Text>
    </View>
  );
}
