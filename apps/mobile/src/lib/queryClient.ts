import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { fileStorage } from "@/lib/storage";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24,
      staleTime: 1000 * 60 * 5,
      networkMode: "offlineFirst",
      retry: 2,
    },
    mutations: {
      networkMode: "online",
    },
  },
});

export const queryCachePersister = createAsyncStoragePersister({
  storage: fileStorage,
  key: "travel_companion_query_cache",
});

/** Clears in-memory queries and drops persisted React Query data from local storage. */
export function clearQueryCache() {
  queryClient.clear();
  void queryCachePersister.removeClient();
}
