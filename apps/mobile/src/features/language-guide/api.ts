import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiBaseUrl } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import type { LanguageListResponse, PhraseListResponse } from "./types";

function createAuthHeaders(accessToken: string | null) {
  return accessToken
    ? {
        Authorization: `Bearer ${accessToken}`,
      }
    : {};
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = "Request failed";
    try {
      const payload = (await response.json()) as { message?: string };
      message = payload.message ?? message;
    } catch {
      // Ignore malformed response body.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export function useLanguagesQuery() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["languages", "list"],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/languages`, {
        headers: createAuthHeaders(accessToken),
      });
      return parseResponse<LanguageListResponse>(response);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useLanguagePhrasesInfiniteQuery(languageId: string | null) {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useInfiniteQuery({
    queryKey: ["languages", "phrases", languageId],
    enabled: Boolean(languageId),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/languages/${languageId}/phrases?page=${pageParam}`,
        {
          headers: createAuthHeaders(accessToken),
        }
      );
      return parseResponse<PhraseListResponse>(response);
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
  });
}
