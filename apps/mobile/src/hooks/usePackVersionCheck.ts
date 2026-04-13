import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { client } from "@/api/client";
import { useNetworkStore } from "@/store/networkStore";
import { useOfflineStore } from "@/store/offlineStore";

export function usePackVersionCheck() {
  const isConnected = useNetworkStore((s) => s.isConnected);
  const packs = useOfflineStore((s) => s.packs);
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!isConnected) {
      wasOffline.current = true;
      return;
    }

    if (!wasOffline.current || packs.length === 0) return;
    wasOffline.current = false;

    (async () => {
      for (const pack of packs) {
        try {
          const res = await client.api.v1
            .destinations({ destId: pack.destinationId })
            ["pack-version"].get();
          if (res.error) continue;
          const remote = (res.data as any)?.packVersion;
          if (typeof remote === "number" && remote > pack.packVersion) {
            Alert.alert(
              "Update Available",
              `A new offline pack is available for ${pack.destinationName}. Open the trip to update.`,
              [{ text: "OK" }]
            );
          }
        } catch {
          // Non-critical — skip silently
        }
      }
    })();
  }, [isConnected, packs]);
}
