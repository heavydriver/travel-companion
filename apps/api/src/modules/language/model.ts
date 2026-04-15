import { t } from "elysia";

export const LanguageListItem = t.Object({
  id: t.String(),
  name: t.String(),
  isoCode: t.String(),
  nativeName: t.String(),
});

export const LanguageListResponse = t.Object({
  languages: t.Array(LanguageListItem),
});

export const LanguagePhraseQuery = t.Object({
  page: t.Optional(t.Number({ minimum: 1 })),
  destinationId: t.Optional(t.String()),
});

export const LanguagePhraseItem = t.Object({
  id: t.String(),
  category: t.String(),
  originalText: t.String(),
  latinSpelling: t.Nullable(t.String()),
  syllables: t.Nullable(t.String()),
  englishText: t.String(),
  audioUrl: t.Nullable(t.String()),
  isEssential: t.Boolean(),
});

export const LanguagePhraseListResponse = t.Object({
  phrases: t.Array(LanguagePhraseItem),
  page: t.Number(),
  pageSize: t.Number(),
  total: t.Number(),
  totalPages: t.Number(),
  hasMore: t.Boolean(),
});

