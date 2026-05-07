import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { prisma } from "@repo/db";

process.env.NODE_ENV = "development";
process.env.JWT_ACCESS_SECRET ??= "test_access_secret_1234567890";
process.env.JWT_REFRESH_SECRET ??= "test_refresh_secret_1234567890";

const { languageService } = await import("./service");

const runId = `language_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const createdLanguageIds = new Set<string>();
const createdPhraseIds = new Set<string>();

let firstDestinationId: string;
let secondDestinationId: string;

beforeAll(async () => {
  const destinations = await prisma.destination.findMany({
    select: { id: true },
    take: 2,
    orderBy: { createdAt: "asc" },
  });

  if (destinations.length < 2) {
    throw new Error("Need at least two seeded destinations to run languageService tests");
  }

  firstDestinationId = destinations[0].id;
  secondDestinationId = destinations[1].id;
});

afterEach(async () => {
  if (createdPhraseIds.size > 0) {
    await prisma.phrase.deleteMany({
      where: { id: { in: [...createdPhraseIds] } },
    });
    createdPhraseIds.clear();
  }

  if (createdLanguageIds.size > 0) {
    await prisma.language.deleteMany({
      where: { id: { in: [...createdLanguageIds] } },
    });
    createdLanguageIds.clear();
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("languageService", () => {
  test("falls back to language-wide phrases when the selected destination has none", async () => {
    const language = await prisma.language.create({
      data: {
        name: `Fallback ${runId}`,
        isoCode: `${runId.slice(-2)}${Math.random().toString(36).slice(2, 4)}`,
        nativeName: `Fallback ${runId}`,
      },
      select: { id: true },
    });
    createdLanguageIds.add(language.id);

    const phrase = await prisma.phrase.create({
      data: {
        destinationId: secondDestinationId,
        languageId: language.id,
        category: "GENERAL",
        originalText: `Original ${runId}`,
        englishText: `Fallback phrase ${runId}`,
        isEssential: true,
      },
      select: { id: true, destinationId: true, englishText: true },
    });
    createdPhraseIds.add(phrase.id);

    const result = await languageService.listPhrasesByLanguage(
      language.id,
      1,
      firstDestinationId,
    );

    expect(result.total).toBe(1);
    expect(result.phrases).toHaveLength(1);
    expect(result.phrases[0]?.id).toBe(phrase.id);
    expect(result.phrases[0]?.englishText).toBe(phrase.englishText);
  });

  test("keeps destination-specific phrases when the selected destination has matches", async () => {
    const language = await prisma.language.create({
      data: {
        name: `Scoped ${runId}`,
        isoCode: `${runId.slice(-2)}${Math.random().toString(36).slice(2, 4)}x`,
        nativeName: `Scoped ${runId}`,
      },
      select: { id: true },
    });
    createdLanguageIds.add(language.id);

    const scopedPhrase = await prisma.phrase.create({
      data: {
        destinationId: firstDestinationId,
        languageId: language.id,
        category: "GENERAL",
        originalText: `Scoped original ${runId}`,
        englishText: `Scoped phrase ${runId}`,
        isEssential: true,
      },
      select: { id: true },
    });
    createdPhraseIds.add(scopedPhrase.id);

    const otherDestinationPhrase = await prisma.phrase.create({
      data: {
        destinationId: secondDestinationId,
        languageId: language.id,
        category: "GENERAL",
        originalText: `Other original ${runId}`,
        englishText: `Other phrase ${runId}`,
        isEssential: true,
      },
      select: { id: true },
    });
    createdPhraseIds.add(otherDestinationPhrase.id);

    const result = await languageService.listPhrasesByLanguage(
      language.id,
      1,
      firstDestinationId,
    );

    expect(result.total).toBe(1);
    expect(result.phrases).toHaveLength(1);
    expect(result.phrases[0]?.id).toBe(scopedPhrase.id);
  });
});
