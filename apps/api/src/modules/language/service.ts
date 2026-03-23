import { prisma } from "@repo/db";
import { AppError } from "../../middleware/errorHandler";

const PAGE_SIZE = 15;

const languageListSelect = {
  id: true,
  name: true,
  isoCode: true,
  nativeName: true,
} as const;

const phraseListSelect = {
  id: true,
  category: true,
  originalText: true,
  latinSpelling: true,
  syllables: true,
  englishText: true,
  audioUrl: true,
  isEssential: true,
} as const;

export const languageService = {
  async list() {
    return prisma.language.findMany({
      select: languageListSelect,
      orderBy: { name: "asc" },
    });
  },

  async listPhrasesByLanguage(languageId: string, page: number) {
    const language = await prisma.language.findUnique({
      where: { id: languageId },
      select: { id: true },
    });

    if (!language) {
      throw new AppError(404, "NOT_FOUND", "Language not found");
    }

    const currentPage = Number.isFinite(page) && page > 0 ? page : 1;
    const skip = (currentPage - 1) * PAGE_SIZE;

    const [phrases, total] = await Promise.all([
      prisma.phrase.findMany({
        where: { languageId },
        select: phraseListSelect,
        orderBy: [{ isEssential: "desc" }, { category: "asc" }, { englishText: "asc" }],
        skip,
        take: PAGE_SIZE,
      }),
      prisma.phrase.count({ where: { languageId } }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const hasMore = currentPage < totalPages;

    return {
      phrases,
      page: currentPage,
      pageSize: PAGE_SIZE,
      total,
      totalPages,
      hasMore,
    };
  },
};
