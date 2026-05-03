import type { QueryClient } from "@tanstack/react-query";

export function invalidateSocialGraphQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["social-nearby"] }),
    queryClient.invalidateQueries({ queryKey: ["connections-pending"] }),
    queryClient.invalidateQueries({ queryKey: ["connections-accepted"] }),
  ]);
}

export function invalidateMessageQueries(queryClient: QueryClient, connectionId?: string) {
  const tasks = [queryClient.invalidateQueries({ queryKey: ["connections-accepted"] })];
  if (connectionId) {
    tasks.push(queryClient.invalidateQueries({ queryKey: ["messages", connectionId] }));
  }
  return Promise.all(tasks);
}
