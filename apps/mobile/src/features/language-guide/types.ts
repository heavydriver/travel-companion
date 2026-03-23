export const PHRASE_CATEGORIES = [
  "GREETINGS",
  "DIRECTIONS",
  "FOOD_AND_DRINK",
  "EMERGENCIES",
  "SHOPPING",
  "NUMBERS",
  "TRANSPORT",
  "ACCOMMODATION",
  "GENERAL",
] as const;

export type PhraseCategory = (typeof PHRASE_CATEGORIES)[number];
export type CategoryFilter = "FAVORITES" | PhraseCategory;

export type LanguageListItem = {
  id: string;
  name: string;
  isoCode: string;
  nativeName: string;
};

export type LanguageListResponse = {
  languages: LanguageListItem[];
};

export type PhraseItem = {
  id: string;
  category: PhraseCategory;
  originalText: string;
  latinSpelling: string | null;
  syllables: string | null;
  englishText: string;
  audioUrl: string | null;
  isEssential: boolean;
};

export type PhraseListResponse = {
  phrases: PhraseItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};
