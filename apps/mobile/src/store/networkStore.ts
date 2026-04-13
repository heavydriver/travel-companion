import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { create } from "zustand";

type NetworkState = {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  startListening: () => () => void;
};

export const useNetworkStore = create<NetworkState>((set) => ({
  isConnected: true,
  isInternetReachable: true,
  startListening: () => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      set({
        isConnected: state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable,
      });
    });
    return unsubscribe;
  },
}));
