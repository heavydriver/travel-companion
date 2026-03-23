import { useCallback, useEffect, useMemo, useState } from "react";
import { storage } from "@/lib/storage";

const FAVORITES_STORAGE_KEY = "travel_companion_language_guide_favorites";

type FavoriteMap = Record<string, string[]>;

async function readFavorites() {
  try {
    const raw = await storage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return {} as FavoriteMap;
    return JSON.parse(raw) as FavoriteMap;
  } catch {
    return {} as FavoriteMap;
  }
}

async function persistFavorites(value: FavoriteMap) {
  await storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(value));
}

export function useLanguageFavorites(languageId: string | null) {
  const [favoritesByLanguage, setFavoritesByLanguage] = useState<FavoriteMap>({});
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      const parsed = await readFavorites();
      if (!mounted) return;
      setFavoritesByLanguage(parsed);
      setIsHydrating(false);
    };

    void hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const favoriteIds = useMemo(() => {
    if (!languageId) return [];
    return favoritesByLanguage[languageId] ?? [];
  }, [favoritesByLanguage, languageId]);

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const isFavorite = useCallback(
    (phraseId: string) => {
      return favoriteSet.has(phraseId);
    },
    [favoriteSet]
  );

  const toggleFavorite = useCallback(
    async (phraseId: string) => {
      if (!languageId) return;

      const next = { ...favoritesByLanguage };
      const existing = new Set(next[languageId] ?? []);
      if (existing.has(phraseId)) {
        existing.delete(phraseId);
      } else {
        existing.add(phraseId);
      }
      next[languageId] = Array.from(existing);
      setFavoritesByLanguage(next);
      await persistFavorites(next);
    },
    [favoritesByLanguage, languageId]
  );

  return {
    isHydrating,
    favoriteIds,
    favoriteSet,
    isFavorite,
    toggleFavorite,
  };
}
