import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Languages
  const japanese = await prisma.language.upsert({
    where: { isoCode: "ja" },
    update: {},
    create: { name: "Japanese", isoCode: "ja", nativeName: "日本語" },
  });
  const french = await prisma.language.upsert({
    where: { isoCode: "fr" },
    update: {},
    create: { name: "French", isoCode: "fr", nativeName: "Français" },
  });
  const thai = await prisma.language.upsert({
    where: { isoCode: "th" },
    update: {},
    create: { name: "Thai", isoCode: "th", nativeName: "ไทย" },
  });
  const italian = await prisma.language.upsert({
    where: { isoCode: "it" },
    update: {},
    create: { name: "Italian", isoCode: "it", nativeName: "Italiano" },
  });
  const spanish = await prisma.language.upsert({
    where: { isoCode: "es" },
    update: {},
    create: { name: "Spanish", isoCode: "es", nativeName: "Español" },
  });

  // Destinations
  const tokyo = await prisma.destination.upsert({
    where: { slug: "tokyo" },
    update: {},
    create: {
      name: "Tokyo",
      slug: "tokyo",
      country: "Japan",
      countryCode: "JP",
      latitude: 35.6762,
      longitude: 139.6503,
      timezone: "Asia/Tokyo",
      currencyCode: "JPY",
      description:
        "Japan's bustling capital blends ultramodern with traditional, from neon-lit skyscrapers to historic temples.",
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
      description:
        "The City of Light, known for its art, gastronomy, and culture, anchored by the Eiffel Tower.",
      isFeatured: true,
    },
  });
  const bangkok = await prisma.destination.upsert({
    where: { slug: "bangkok" },
    update: {},
    create: {
      name: "Bangkok",
      slug: "bangkok",
      country: "Thailand",
      countryCode: "TH",
      latitude: 13.7563,
      longitude: 100.5018,
      timezone: "Asia/Bangkok",
      currencyCode: "THB",
      description:
        "Thailand's capital is a large city known for ornate shrines and vibrant street life.",
      isFeatured: true,
    },
  });
  const rome = await prisma.destination.upsert({
    where: { slug: "rome" },
    update: {},
    create: {
      name: "Rome",
      slug: "rome",
      country: "Italy",
      countryCode: "IT",
      latitude: 41.9028,
      longitude: 12.4964,
      timezone: "Europe/Rome",
      currencyCode: "EUR",
      description:
        "The Eternal City, rich with nearly 3,000 years of globally influential art, architecture, and culture.",
      isFeatured: true,
    },
  });
  const mexicoCity = await prisma.destination.upsert({
    where: { slug: "mexico-city" },
    update: {},
    create: {
      name: "Mexico City",
      slug: "mexico-city",
      country: "Mexico",
      countryCode: "MX",
      latitude: 19.4326,
      longitude: -99.1332,
      timezone: "America/Mexico_City",
      currencyCode: "MXN",
      description:
        "Mexico's sprawling capital, known for Aztec ruins, world-class museums, and incredible food.",
      isFeatured: true,
    },
  });

  // Destination-Language links
  const destLangs = [
    { destId: tokyo.id, langId: japanese.id, isPrimary: true },
    { destId: paris.id, langId: french.id, isPrimary: true },
    { destId: bangkok.id, langId: thai.id, isPrimary: true },
    { destId: rome.id, langId: italian.id, isPrimary: true },
    { destId: mexicoCity.id, langId: spanish.id, isPrimary: true },
  ];
  for (const dl of destLangs) {
    await prisma.destinationLanguage.upsert({
      where: {
        destinationId_languageId: {
          destinationId: dl.destId,
          languageId: dl.langId,
        },
      },
      update: {},
      create: {
        destinationId: dl.destId,
        languageId: dl.langId,
        isPrimary: dl.isPrimary,
      },
    });
  }

  // Places — 3 per destination
  const places = [
    // Tokyo
    {
      destId: tokyo.id,
      name: "Senso-ji Temple",
      slug: "sensoji-temple",
      category: "ATTRACTION" as const,
      lat: 35.7148,
      lng: 139.7967,
      description:
        "Tokyo's oldest temple, located in Asakusa. The iconic Kaminarimon gate is a must-see.",
      isCurated: true,
      rating: 4.7,
    },
    {
      destId: tokyo.id,
      name: "Tsukiji Outer Market",
      slug: "tsukiji-outer-market",
      category: "RESTAURANT" as const,
      lat: 35.6654,
      lng: 139.7707,
      description: "Famous marketplace with fresh sushi, street food stalls, and kitchen supplies.",
      isCurated: true,
      rating: 4.5,
    },
    {
      destId: tokyo.id,
      name: "Shinjuku Gyoen",
      slug: "shinjuku-gyoen",
      category: "NATURE" as const,
      lat: 35.6852,
      lng: 139.71,
      description:
        "One of Tokyo's largest and most beautiful parks, blending Japanese, English, and French gardens.",
      isCurated: true,
      rating: 4.6,
    },
    // Paris
    {
      destId: paris.id,
      name: "Eiffel Tower",
      slug: "eiffel-tower",
      category: "ATTRACTION" as const,
      lat: 48.8584,
      lng: 2.2945,
      description: "Iconic iron lattice tower on the Champ de Mars, symbol of Paris.",
      isCurated: true,
      rating: 4.8,
    },
    {
      destId: paris.id,
      name: "Le Marais",
      slug: "le-marais",
      category: "SHOPPING" as const,
      lat: 48.8566,
      lng: 2.3622,
      description: "Historic district packed with trendy boutiques, galleries, and cafés.",
      isCurated: true,
      rating: 4.4,
    },
    {
      destId: paris.id,
      name: "Café de Flore",
      slug: "cafe-de-flore",
      category: "CAFE" as const,
      lat: 48.854,
      lng: 2.3325,
      description: "One of the oldest and most prestigious coffeehouses in Paris.",
      isCurated: true,
      rating: 4.3,
    },
    // Bangkok
    {
      destId: bangkok.id,
      name: "Grand Palace",
      slug: "grand-palace",
      category: "ATTRACTION" as const,
      lat: 13.75,
      lng: 100.4914,
      description: "Former royal residence and home to the sacred Temple of the Emerald Buddha.",
      isCurated: true,
      rating: 4.6,
    },
    {
      destId: bangkok.id,
      name: "Chatuchak Weekend Market",
      slug: "chatuchak-market",
      category: "SHOPPING" as const,
      lat: 13.7999,
      lng: 100.5504,
      description: "One of the world's largest weekend markets with over 15,000 stalls.",
      isCurated: true,
      rating: 4.5,
    },
    {
      destId: bangkok.id,
      name: "Khao San Road",
      slug: "khao-san-road",
      category: "NIGHTLIFE" as const,
      lat: 13.7589,
      lng: 100.497,
      description: "Famous backpacker street with bars, street food, and budget accommodation.",
      isCurated: true,
      rating: 4.1,
    },
    // Rome
    {
      destId: rome.id,
      name: "Colosseum",
      slug: "colosseum",
      category: "ATTRACTION" as const,
      lat: 41.8902,
      lng: 12.4922,
      description: "Ancient amphitheatre, one of the most iconic landmarks of the Roman Empire.",
      isCurated: true,
      rating: 4.8,
    },
    {
      destId: rome.id,
      name: "Trastevere",
      slug: "trastevere",
      category: "RESTAURANT" as const,
      lat: 41.8867,
      lng: 12.47,
      description: "Charming neighborhood known for authentic Roman cuisine and lively nightlife.",
      isCurated: true,
      rating: 4.5,
    },
    {
      destId: rome.id,
      name: "Vatican Museums",
      slug: "vatican-museums",
      category: "ATTRACTION" as const,
      lat: 41.9065,
      lng: 12.4536,
      description: "World-renowned museum complex including the Sistine Chapel.",
      isCurated: true,
      rating: 4.7,
    },
    // Mexico City
    {
      destId: mexicoCity.id,
      name: "Chapultepec Castle",
      slug: "chapultepec-castle",
      category: "ATTRACTION" as const,
      lat: 19.4204,
      lng: -99.1818,
      description: "Historic castle and museum set in the hilltop of Chapultepec Park.",
      isCurated: true,
      rating: 4.7,
    },
    {
      destId: mexicoCity.id,
      name: "Mercado de San Juan",
      slug: "mercado-san-juan",
      category: "RESTAURANT" as const,
      lat: 19.4296,
      lng: -99.1429,
      description: "Gourmet market famous for exotic meats, fresh seafood, and artisanal products.",
      isCurated: true,
      rating: 4.4,
    },
    {
      destId: mexicoCity.id,
      name: "Xochimilco",
      slug: "xochimilco",
      category: "NATURE" as const,
      lat: 19.2573,
      lng: -99.1038,
      description:
        "UNESCO site with colorful trajinera boats floating through ancient Aztec canals.",
      isCurated: true,
      rating: 4.5,
    },
  ];

  for (const p of places) {
    await prisma.place.upsert({
      where: { destinationId_slug: { destinationId: p.destId, slug: p.slug } },
      update: {},
      create: {
        destinationId: p.destId,
        name: p.name,
        slug: p.slug,
        category: p.category,
        latitude: p.lat,
        longitude: p.lng,
        description: p.description,
        isCurated: p.isCurated,
        rating: p.rating,
      },
    });
  }

  // Phrases — 3 per destination
  const phrases = [
    // Tokyo / Japanese
    {
      destId: tokyo.id,
      langId: japanese.id,
      category: "GREETINGS" as const,
      original: "こんにちは",
      latin: "Konnichiwa",
      english: "Hello",
    },
    {
      destId: tokyo.id,
      langId: japanese.id,
      category: "FOOD_AND_DRINK" as const,
      original: "お会計お願いします",
      latin: "Okaikei onegaishimasu",
      english: "Check, please",
    },
    {
      destId: tokyo.id,
      langId: japanese.id,
      category: "DIRECTIONS" as const,
      original: "駅はどこですか？",
      latin: "Eki wa doko desu ka?",
      english: "Where is the station?",
    },
    // Paris / French
    {
      destId: paris.id,
      langId: french.id,
      category: "GREETINGS" as const,
      original: "Bonjour",
      latin: null,
      english: "Hello / Good morning",
    },
    {
      destId: paris.id,
      langId: french.id,
      category: "FOOD_AND_DRINK" as const,
      original: "L'addition, s'il vous plaît",
      latin: null,
      english: "The bill, please",
    },
    {
      destId: paris.id,
      langId: french.id,
      category: "DIRECTIONS" as const,
      original: "Où est la station de métro ?",
      latin: null,
      english: "Where is the metro station?",
    },
    // Bangkok / Thai
    {
      destId: bangkok.id,
      langId: thai.id,
      category: "GREETINGS" as const,
      original: "สวัสดี",
      latin: "Sawasdee",
      english: "Hello",
    },
    {
      destId: bangkok.id,
      langId: thai.id,
      category: "FOOD_AND_DRINK" as const,
      original: "เก็บเงินด้วย",
      latin: "Gep ngern duay",
      english: "Check, please",
    },
    {
      destId: bangkok.id,
      langId: thai.id,
      category: "TRANSPORT" as const,
      original: "ไปที่นี่ได้ไหม",
      latin: "Bpai tee nee dai mai",
      english: "Can you go here?",
    },
    // Rome / Italian
    {
      destId: rome.id,
      langId: italian.id,
      category: "GREETINGS" as const,
      original: "Buongiorno",
      latin: null,
      english: "Good morning",
    },
    {
      destId: rome.id,
      langId: italian.id,
      category: "FOOD_AND_DRINK" as const,
      original: "Il conto, per favore",
      latin: null,
      english: "The bill, please",
    },
    {
      destId: rome.id,
      langId: italian.id,
      category: "DIRECTIONS" as const,
      original: "Dov'è la fermata della metro?",
      latin: null,
      english: "Where is the metro stop?",
    },
    // Mexico City / Spanish
    {
      destId: mexicoCity.id,
      langId: spanish.id,
      category: "GREETINGS" as const,
      original: "¡Hola!",
      latin: null,
      english: "Hello!",
    },
    {
      destId: mexicoCity.id,
      langId: spanish.id,
      category: "FOOD_AND_DRINK" as const,
      original: "La cuenta, por favor",
      latin: null,
      english: "The bill, please",
    },
    {
      destId: mexicoCity.id,
      langId: spanish.id,
      category: "EMERGENCIES" as const,
      original: "¡Ayuda!",
      latin: null,
      english: "Help!",
    },
  ];

  for (const ph of phrases) {
    const existing = await prisma.phrase.findFirst({
      where: {
        destinationId: ph.destId,
        languageId: ph.langId,
        originalText: ph.original,
      },
    });
    if (!existing) {
      await prisma.phrase.create({
        data: {
          destinationId: ph.destId,
          languageId: ph.langId,
          category: ph.category,
          originalText: ph.original,
          latinSpelling: ph.latin,
          englishText: ph.english,
          isEssential: true,
        },
      });
    }
  }

  console.log("Seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
