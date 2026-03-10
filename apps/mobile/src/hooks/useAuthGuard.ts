import { useRouter } from "expo-router";
import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";

export function useAuthGuard() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/(auth)/login" as never);
    }
  }, [isAuthenticated, router]);

  return isAuthenticated;
}
