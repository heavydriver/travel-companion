import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";
import { PhraseCategory, PlaceCategory } from "../generated/prisma/enums";

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const english = await prisma.language.upsert({
    where: { isoCode: "en" },
    update: {},
    create: {
      name: "English",
      nativeName: "English",
      isoCode: "en",
    },
  });

  const french = await prisma.language.upsert({
    where: { isoCode: "fr" },
    update: {},
    create: {
      name: "French",
      nativeName: "Français",
      isoCode: "fr",
    },
  });

  const london = await prisma.destination.upsert({
    where: { slug: "london" },
    update: {},
    create: {
      name: "London",
      slug: "london",
      country: "United Kingdom",
      countryCode: "GB",
      latitude: 51.5074,
      longitude: -0.1278,
      timezone: "Europe/London",
      currencyCode: "GBP",
      isFeatured: true,
    },
  });

  const paris = await prisma.destination.upsert({
    where: { slug: "paris" },
    update: {},
    create: {
      name: "Paris",
      slug: "paris",
      country: "France",
      countryCode: "FR",
      latitude: 48.8566,
      longitude: 2.3522,
      timezone: "Europe/Paris",
      currencyCode: "EUR",
      isFeatured: true,
    },
  });

  const newYork = await prisma.destination.upsert({
    where: { slug: "new-york" },
    update: {},
    create: {
      name: "New York",
      slug: "new-york",
      country: "United States",
      countryCode: "US",
      latitude: 40.7128,
      longitude: -74.006,
      timezone: "America/New_York",
      currencyCode: "USD",
      isFeatured: true,
    },
  });

  await prisma.destinationLanguage.createMany({
    data: [
      { destinationId: london.id, languageId: english.id, isPrimary: true },
      { destinationId: paris.id, languageId: french.id, isPrimary: true },
      { destinationId: paris.id, languageId: english.id },
      { destinationId: newYork.id, languageId: english.id, isPrimary: true },
    ],
    skipDuplicates: true,
  });

  // LONDON
  await prisma.place.createMany({
    data: [
      {
        destinationId: london.id,
        name: "Big Ben",
        slug: "big-ben",
        category: PlaceCategory.ATTRACTION,
        latitude: 51.5007,
        longitude: -0.1246,
      },
      {
        destinationId: london.id,
        name: "Tower Bridge",
        slug: "tower-bridge",
        category: PlaceCategory.ATTRACTION,
        latitude: 51.5055,
        longitude: -0.0754,
      },
      {
        destinationId: london.id,
        name: "British Museum",
        slug: "british-museum",
        category: PlaceCategory.ATTRACTION,
        latitude: 51.5194,
        longitude: -0.127,
      },
      {
        destinationId: london.id,
        name: "Buckingham Palace",
        slug: "buckingham-palace",
        category: PlaceCategory.ATTRACTION,
        latitude: 51.5014,
        longitude: -0.1419,
      },
      {
        destinationId: london.id,
        name: "Hyde Park",
        slug: "hyde-park",
        category: PlaceCategory.NATURE,
        latitude: 51.5073,
        longitude: -0.1657,
      },
    ],
  });

  // PARIS
  await prisma.place.createMany({
    data: [
      {
        destinationId: paris.id,
        name: "Eiffel Tower",
        slug: "eiffel-tower",
        category: PlaceCategory.ATTRACTION,
        latitude: 48.8584,
        longitude: 2.2945,
      },
      {
        destinationId: paris.id,
        name: "Louvre Museum",
        slug: "louvre",
        category: PlaceCategory.ATTRACTION,
        latitude: 48.8606,
        longitude: 2.3376,
      },
      {
        destinationId: paris.id,
        name: "Notre Dame Cathedral",
        slug: "notre-dame",
        category: PlaceCategory.ATTRACTION,
        latitude: 48.853,
        longitude: 2.3499,
      },
      {
        destinationId: paris.id,
        name: "Montmartre",
        slug: "montmartre",
        category: PlaceCategory.ATTRACTION,
        latitude: 48.8867,
        longitude: 2.3431,
      },
      {
        destinationId: paris.id,
        name: "Luxembourg Gardens",
        slug: "luxembourg-gardens",
        category: PlaceCategory.NATURE,
        latitude: 48.8462,
        longitude: 2.3371,
      },
    ],
  });

  // NEW YORK
  await prisma.place.createMany({
    data: [
      {
        destinationId: newYork.id,
        name: "Statue of Liberty",
        slug: "statue-of-liberty",
        category: PlaceCategory.ATTRACTION,
        latitude: 40.6892,
        longitude: -74.0445,
      },
      {
        destinationId: newYork.id,
        name: "Central Park",
        slug: "central-park",
        category: PlaceCategory.NATURE,
        latitude: 40.7851,
        longitude: -73.9683,
      },
      {
        destinationId: newYork.id,
        name: "Times Square",
        slug: "times-square",
        category: PlaceCategory.ATTRACTION,
        latitude: 40.758,
        longitude: -73.9855,
      },
      {
        destinationId: newYork.id,
        name: "Brooklyn Bridge",
        slug: "brooklyn-bridge",
        category: PlaceCategory.ATTRACTION,
        latitude: 40.7061,
        longitude: -73.9969,
      },
      {
        destinationId: newYork.id,
        name: "Empire State Building",
        slug: "empire-state",
        category: PlaceCategory.ATTRACTION,
        latitude: 40.7484,
        longitude: -73.9857,
      },
    ],
  });

  await prisma.phrase.createMany({
    data: [
      {
        destinationId: paris.id,
        languageId: french.id,
        category: PhraseCategory.GREETINGS,
        originalText: "Bonjour",
        latinSpelling: "bon-zhoor",
        syllables: "bon-jour",
        englishText: "Hello",
        isEssential: true,
      },
      {
        destinationId: paris.id,
        languageId: french.id,
        category: PhraseCategory.GREETINGS,
        originalText: "Bonsoir",
        latinSpelling: "bon-swahr",
        syllables: "bon-soir",
        englishText: "Good evening",
      },
      {
        destinationId: paris.id,
        languageId: french.id,
        category: PhraseCategory.GENERAL,
        originalText: "Merci",
        latinSpelling: "mehr-see",
        syllables: "mer-ci",
        englishText: "Thank you",
        isEssential: true,
      },
      {
        destinationId: paris.id,
        languageId: french.id,
        category: PhraseCategory.DIRECTIONS,
        originalText: "Où est la gare ?",
        latinSpelling: "oo eh la gar",
        syllables: "où-est-la-gare",
        englishText: "Where is the train station?",
      },
      {
        destinationId: paris.id,
        languageId: french.id,
        category: PhraseCategory.FOOD_AND_DRINK,
        originalText: "Je voudrais un café",
        latinSpelling: "zhuh voo-dray uhn ka-fay",
        syllables: "je-vou-drais-un-ca-fé",
        englishText: "I would like a coffee",
      },
      {
        destinationId: paris.id,
        languageId: french.id,
        category: PhraseCategory.EMERGENCIES,
        originalText: "Appelez la police",
        latinSpelling: "ah-play lah po-lees",
        syllables: "ap-pe-lez-la-po-lice",
        englishText: "Call the police",
      },
    ],
  });
}

main()
  .then(() => {
    console.log("Database seeded");
  })
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
