import { Alert } from "react-native";
import { useNetworkStore } from "@/store/networkStore";

export function useOfflineGuard() {
  const isConnected = useNetworkStore((s) => s.isConnected);
  const isInternetReachable = useNetworkStore((s) => s.isInternetReachable);
  const isOnline = isConnected && isInternetReachable === true;

  const guardAction = (action: () => void) => {
    if (!isOnline) {
      Alert.alert(
        "You're Offline",
        "This action requires an internet connection. Please try again when you're back online.",
      );
      return;
    }
    action();
  };

  return { isConnected: isOnline, guardAction };
}
