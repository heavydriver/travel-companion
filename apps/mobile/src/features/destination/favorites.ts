import { useCallback, useEffect, useMemo, useState } from "react";
import { storage } from "@/lib/storage";

const DESTINATION_FAVORITES_KEY = "travel_companion_destination_favorites";

export type FavoriteDestination = {
  id: string;
  name: string;
  country: string;
  region: string | null;
};

type FavoritesPayload = {
  ids: string[];
  details: Record<string, FavoriteDestination>;
};

const emptyFavorites: FavoritesPayload = { ids: [], details: {} };

async function readFavorites() {
  try {
    const raw = await storage.getItem(DESTINATION_FAVORITES_KEY);
    if (!raw) return emptyFavorites;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const ids = parsed.filter((value): value is string => typeof value === "string");
      return { ids, details: {} } as FavoritesPayload;
    }
    if (!parsed || typeof parsed !== "object") return emptyFavorites;
    const ids = Array.isArray(parsed.ids)
      ? parsed.ids.filter((value: unknown): value is string => typeof value === "string")
      : [];
    const details =
      parsed.details && typeof parsed.details === "object"
        ? (parsed.details as Record<string, FavoriteDestination>)
        : {};
    return { ids, details };
  } catch {
    return emptyFavorites;
  }
}

async function writeFavorites(value: FavoritesPayload) {
  await storage.setItem(DESTINATION_FAVORITES_KEY, JSON.stringify(value));
}

export function useDestinationFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favoriteDetails, setFavoriteDetails] = useState<Record<string, FavoriteDestination>>({});
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      const favorites = await readFavorites();
      if (!mounted) return;
      setFavoriteIds(favorites.ids);
      setFavoriteDetails(favorites.details);
      setIsHydrating(false);
    };
    void hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const isFavorite = useCallback(
    (destinationId: string) => favoriteSet.has(destinationId),
    [favoriteSet],
  );

  const favoriteDestinations = useMemo(
    () =>
      favoriteIds
        .map((id) => favoriteDetails[id])
        .filter((destination): destination is FavoriteDestination => Boolean(destination)),
    [favoriteDetails, favoriteIds],
  );

  const toggleFavorite = useCallback(
    async (
      destinationId: string,
      details?: Omit<FavoriteDestination, "id">,
    ) => {
      const exists = favoriteSet.has(destinationId);
      const nextIds = exists
        ? favoriteIds.filter((id) => id !== destinationId)
        : [...favoriteIds, destinationId];
      const nextDetails = { ...favoriteDetails };

      if (exists) {
        delete nextDetails[destinationId];
      } else if (details) {
        nextDetails[destinationId] = { id: destinationId, ...details };
      }

      setFavoriteIds(nextIds);
      setFavoriteDetails(nextDetails);
      await writeFavorites({ ids: nextIds, details: nextDetails });
    },
    [favoriteDetails, favoriteIds, favoriteSet],
  );

  return {
    favoriteIds,
    favoriteDestinations,
    favoriteSet,
    isFavorite,
    isHydrating,
    toggleFavorite,
  };
}
