import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { prisma } from "@repo/db";

process.env.NODE_ENV = "development";
process.env.JWT_ACCESS_SECRET ??= "test_access_secret_1234567890";
process.env.JWT_REFRESH_SECRET ??= "test_refresh_secret_1234567890";

const { languageService } = await import("./service");

const runId = `language_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const createdLanguageIds = new Set<string>();
const createdPhraseIds = new Set<string>();
const createdDestinationIds = new Set<string>();

let firstDestinationId: string;
let secondDestinationId: string;

function dummyDestinationPayload(suffix: "a" | "b") {
  return {
    name: `Dummy destination ${suffix} (${runId})`,
    slug: `lang-test-${suffix}-${runId}`,
    country: "Testland",
    countryCode: "TL",
    latitude: 1.23,
    longitude: 4.56,
    timezone: "Etc/UTC",
    currencyCode: "USD",
  };
}

beforeAll(async () => {
  const first = await prisma.destination.create({
    data: dummyDestinationPayload("a"),
    select: { id: true },
  });
  const second = await prisma.destination.create({
    data: dummyDestinationPayload("b"),
    select: { id: true },
  });

  firstDestinationId = first.id;
  secondDestinationId = second.id;
  createdDestinationIds.add(first.id);
  createdDestinationIds.add(second.id);
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
  if (createdDestinationIds.size > 0) {
    await prisma.destination.deleteMany({
      where: { id: { in: [...createdDestinationIds] } },
    });
    createdDestinationIds.clear();
  }
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
