import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { client } from "@/api/client";
import type { LanguageListResponse, PhraseListResponse } from "./types";

export function useLanguagesQuery() {
  return useQuery({
    queryKey: ["languages", "list"],
    queryFn: async () => {
      const res = await client.api.v1.languages.get();
      if (res.error) throw new Error("Failed to load languages");
      return res.data as LanguageListResponse;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useLanguagePhrasesInfiniteQuery(languageId: string | null) {
  return useInfiniteQuery({
    queryKey: ["languages", "phrases", languageId],
    enabled: Boolean(languageId),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      if (!languageId) throw new Error("Language is required");
      const page = typeof pageParam === "number" ? pageParam : 1;
      const res = await client.api.v1.languages({ languageId }).phrases.get({
        query: { page },
      });
      if (res.error) throw new Error("Failed to load phrases");
      return res.data as PhraseListResponse;
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
  });
}
