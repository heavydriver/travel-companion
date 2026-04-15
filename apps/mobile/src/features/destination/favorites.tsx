import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { storage } from "@/lib/storage";

const DESTINATION_FAVORITES_KEY = "travel_companion_destination_favorites";

export type FavoriteDestination = {
  id: string;
  name: string;
  country: string;
  imageUrl: string | null;
};

type FavoritesPayload = {
  ids: string[];
  details: Record<string, FavoriteDestination>;
};

const emptyFavorites: FavoritesPayload = { ids: [], details: {} };

function normalizeStoredDetail(id: string, raw: unknown): FavoriteDestination {
  if (!raw || typeof raw !== "object") {
    return { id, name: "Saved destination", country: "", imageUrl: null };
  }
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name : "Saved destination";
  const country = typeof o.country === "string" ? o.country : "";
  const imageUrl = typeof o.imageUrl === "string" ? o.imageUrl : null;
  return { id, name, country, imageUrl };
}

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
    const rawDetails =
      parsed.details && typeof parsed.details === "object"
        ? (parsed.details as Record<string, unknown>)
        : {};
    const details: Record<string, FavoriteDestination> = {};
    for (const id of ids) {
      const row = rawDetails[id];
      details[id] = normalizeStoredDetail(id, row);
    }
    return { ids, details };
  } catch {
    return emptyFavorites;
  }
}

async function writeFavorites(value: FavoritesPayload) {
  await storage.setItem(DESTINATION_FAVORITES_KEY, JSON.stringify(value));
}

type FavoritesContextValue = {
  favoriteIds: string[];
  favoriteDestinations: FavoriteDestination[];
  favoriteSet: Set<string>;
  isFavorite: (destinationId: string) => boolean;
  isHydrating: boolean;
  toggleFavorite: (
    destinationId: string,
    details?: Omit<FavoriteDestination, "id">,
  ) => Promise<void>;
};

const DestinationFavoritesContext = createContext<FavoritesContextValue | null>(null);

function useDestinationFavoritesInternal(): FavoritesContextValue {
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

  const favoriteDestinations = useMemo((): FavoriteDestination[] => {
    return favoriteIds.map((id) => {
      const row = favoriteDetails[id];
      if (row) return row;
      return {
        id,
        name: "Saved destination",
        country: "",
        imageUrl: null,
      };
    });
  }, [favoriteDetails, favoriteIds]);

  const toggleFavorite = useCallback(
    async (destinationId: string, details?: Omit<FavoriteDestination, "id">) => {
      const exists = favoriteSet.has(destinationId);
      const nextIds = exists
        ? favoriteIds.filter((id) => id !== destinationId)
        : [...favoriteIds, destinationId];
      const nextDetails = { ...favoriteDetails };

      if (exists) {
        delete nextDetails[destinationId];
      } else if (details) {
        nextDetails[destinationId] = {
          id: destinationId,
          name: details.name,
          country: details.country,
          imageUrl: details.imageUrl ?? null,
        };
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

export function DestinationFavoritesProvider({ children }: { children: ReactNode }) {
  const value = useDestinationFavoritesInternal();
  return (
    <DestinationFavoritesContext.Provider value={value}>
      {children}
    </DestinationFavoritesContext.Provider>
  );
}

export function useDestinationFavorites(): FavoritesContextValue {
  const ctx = useContext(DestinationFavoritesContext);
  if (!ctx) {
    throw new Error("useDestinationFavorites must be used within DestinationFavoritesProvider");
  }
  return ctx;
}
