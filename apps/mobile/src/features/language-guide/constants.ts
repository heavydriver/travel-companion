import type { CategoryFilter, PhraseCategory } from "./types";

export const CATEGORY_LABELS: Record<PhraseCategory, string> = {
  GREETINGS: "Greetings",
  DIRECTIONS: "Directions",
  FOOD_AND_DRINK: "Food & Drink",
  EMERGENCIES: "Emergencies",
  SHOPPING: "Shopping",
  NUMBERS: "Numbers",
  TRANSPORT: "Transport",
  ACCOMMODATION: "Accommodation",
  GENERAL: "General",
};

export const FAVORITES_FILTER: CategoryFilter = "FAVORITES";
export const FAVORITES_LABEL = "Favorites";

export const LANGUAGE_TO_COUNTRY_CODE: Record<string, string> = {
  en: "US",
  fr: "FR",
  it: "IT",
  ja: "JP",
  es: "ES",
  th: "TH",
};

export const COUNTRY_TO_LANGUAGE_ISO: Record<string, string> = {
  US: "en",
  FR: "fr",
  IT: "it",
  JP: "ja",
  ES: "es",
  TH: "th",
};
