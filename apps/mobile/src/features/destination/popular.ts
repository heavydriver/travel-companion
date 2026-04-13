export const POPULAR_DESTINATIONS_QUERY_KEY = ["popular-destinations"] as const;

export type PopularDestination = {
  id: string;
  name: string;
  country: string;
  slug: string;
  imageUrl: string | null;
  description: string | null;
  isFeatured: boolean;
};

export function getDestinationTitle(destination: Pick<PopularDestination, "name" | "country">) {
  if (!destination.country || destination.country.trim() === "") {
    return destination.name;
  }
  return destination.name.trim().toLowerCase() === destination.country.trim().toLowerCase()
    ? destination.name
    : `${destination.name}, ${destination.country}`;
}
