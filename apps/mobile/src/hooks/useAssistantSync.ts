import { useEffect } from "react";
import { syncPendingPlannerOperations } from "@/llm/plannerSync";
import { useNetworkStore } from "@/store/networkStore";

export function useAssistantSync() {
  const isConnected = useNetworkStore((state) => state.isConnected);

  useEffect(() => {
    if (!isConnected) {
      return;
    }

    void syncPendingPlannerOperations();
  }, [isConnected]);
}
