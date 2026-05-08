import { PrismaPg } from "@prisma/adapter-pg";
import { PhraseCategory, PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function seedPhrases() {
  // Constants for your provided IDs to ensure relational integrity
  const IDS = {
    languages: {
      japanese: "cmmoms0g30000c8tvm1bj6jjw",
      french: "cmmoms0kh0001c8tv4m98rsgf",
      thai: "cmmoms0ol0002c8tvd8k33oxm",
      italian: "cmmoms0sq0003c8tv9ijapy8h",
      spanish: "cmmoms0wr0004c8tvpk38o18p",
    },
    destinations: {
      tokyo: "cmmoms1120005c8tvew7crcvk",
      paris: "cmmoms15b0006c8tvu6em65vy",
      bangkok: "cmmoms19h0007c8tvfefnn0i4",
      rome: "cmmoms1dp0008c8tvrw1p9l0n",
      mexicoCity: "cmmoms1hz0009c8tvnrnyvbmr",
    },
  };

  const phraseData = [
    // --- TOKYO / JAPANESE ---
    {
      destId: IDS.destinations.tokyo,
      langId: IDS.languages.japanese,
      cat: PhraseCategory.GREETINGS,
      orig: "お疲れ様です",
      lat: "Otsukaresama desu",
      eng: "Thank you for your hard work / Hello",
    },
    {
      destId: IDS.destinations.tokyo,
      langId: IDS.languages.japanese,
      cat: PhraseCategory.GREETINGS,
      orig: "はじめまして",
      lat: "Hajimemashite",
      eng: "Nice to meet you",
    },
    {
      destId: IDS.destinations.tokyo,
      langId: IDS.languages.japanese,
      cat: PhraseCategory.DIRECTIONS,
      orig: "まっすぐ行ってください",
      lat: "Massugu itte kudasai",
      eng: "Please go straight",
    },
    {
      destId: IDS.destinations.tokyo,
      langId: IDS.languages.japanese,
      cat: PhraseCategory.DIRECTIONS,
      orig: "左に曲がってください",
      lat: "Hidari ni magatte kudasai",
      eng: "Please turn left",
    },
    {
      destId: IDS.destinations.tokyo,
      langId: IDS.languages.japanese,
      cat: PhraseCategory.FOOD_AND_DRINK,
      orig: "いただきます",
      lat: "Itadakimasu",
      eng: "Let's eat (grace before meals)",
    },
    {
      destId: IDS.destinations.tokyo,
      langId: IDS.languages.japanese,
      cat: PhraseCategory.FOOD_AND_DRINK,
      orig: "お水をお願いします",
      lat: "Omizu o onegaishimasu",
      eng: "Water, please",
    },
    {
      destId: IDS.destinations.tokyo,
      langId: IDS.languages.japanese,
      cat: PhraseCategory.SHOPPING,
      orig: "これはいくらですか？",
      lat: "Kore wa ikura desu ka?",
      eng: "How much is this?",
    },
    {
      destId: IDS.destinations.tokyo,
      langId: IDS.languages.japanese,
      cat: PhraseCategory.SHOPPING,
      orig: "クレジットカードは使えますか？",
      lat: "Kurejitto kādo wa tsukaemasu ka?",
      eng: "Can I use a credit card?",
    },
    {
      destId: IDS.destinations.tokyo,
      langId: IDS.languages.japanese,
      cat: PhraseCategory.TRANSPORT,
      orig: "切符売り場はどこですか？",
      lat: "Kippu uriba wa doko desu ka?",
      eng: "Where is the ticket office?",
    },
    {
      destId: IDS.destinations.tokyo,
      langId: IDS.languages.japanese,
      cat: PhraseCategory.NUMBERS,
      orig: "一、二、三、四、五",
      lat: "Ichi, ni, san, yon, go",
      eng: "1, 2, 3, 4, 5",
    },
    {
      destId: IDS.destinations.tokyo,
      langId: IDS.languages.japanese,
      cat: PhraseCategory.EMERGENCIES,
      orig: "警察を呼んでください！",
      lat: "Keisatsu o yonde kudasai!",
      eng: "Please call the police!",
    },
    {
      destId: IDS.destinations.tokyo,
      langId: IDS.languages.japanese,
      cat: PhraseCategory.GENERAL,
      orig: "すみません",
      lat: "Sumimasen",
      eng: "Excuse me / I'm sorry",
    },

    // --- PARIS / FRENCH ---
    {
      destId: IDS.destinations.paris,
      langId: IDS.languages.french,
      cat: PhraseCategory.GREETINGS,
      orig: "Enchanté(e)",
      lat: null,
      eng: "Nice to meet you",
    },
    {
      destId: IDS.destinations.paris,
      langId: IDS.languages.french,
      cat: PhraseCategory.GREETINGS,
      orig: "Bonne soirée",
      lat: null,
      eng: "Have a good evening",
    },
    {
      destId: IDS.destinations.paris,
      langId: IDS.languages.french,
      cat: PhraseCategory.DIRECTIONS,
      orig: "C'est à gauche",
      lat: null,
      eng: "It's on the left",
    },
    {
      destId: IDS.destinations.paris,
      langId: IDS.languages.french,
      cat: PhraseCategory.FOOD_AND_DRINK,
      orig: "Une table pour deux, s'il vous plaît",
      lat: null,
      eng: "A table for two, please",
    },
    {
      destId: IDS.destinations.paris,
      langId: IDS.languages.french,
      cat: PhraseCategory.FOOD_AND_DRINK,
      orig: "Je suis végétarien(ne)",
      lat: null,
      eng: "I am a vegetarian",
    },
    {
      destId: IDS.destinations.paris,
      langId: IDS.languages.french,
      cat: PhraseCategory.SHOPPING,
      orig: "Je ne fais que regarder",
      lat: null,
      eng: "I'm just looking",
    },
    {
      destId: IDS.destinations.paris,
      langId: IDS.languages.french,
      cat: PhraseCategory.SHOPPING,
      orig: "C'est trop cher",
      lat: null,
      eng: "It's too expensive",
    },
    {
      destId: IDS.destinations.paris,
      langId: IDS.languages.french,
      cat: PhraseCategory.TRANSPORT,
      orig: "À quelle heure part le bus ?",
      lat: null,
      eng: "What time does the bus leave?",
    },
    {
      destId: IDS.destinations.paris,
      langId: IDS.languages.french,
      cat: PhraseCategory.NUMBERS,
      orig: "Un, deux, trois, quatre, cinq",
      lat: null,
      eng: "1, 2, 3, 4, 5",
    },
    {
      destId: IDS.destinations.paris,
      langId: IDS.languages.french,
      cat: PhraseCategory.ACCOMMODATION,
      orig: "J'ai une réservation",
      lat: null,
      eng: "I have a reservation",
    },
    {
      destId: IDS.destinations.paris,
      langId: IDS.languages.french,
      cat: PhraseCategory.EMERGENCIES,
      orig: "Appelez une ambulance !",
      lat: null,
      eng: "Call an ambulance!",
    },
    {
      destId: IDS.destinations.paris,
      langId: IDS.languages.french,
      cat: PhraseCategory.GENERAL,
      orig: "Merci beaucoup",
      lat: null,
      eng: "Thank you very much",
    },

    // --- BANGKOK / THAI ---
    {
      destId: IDS.destinations.bangkok,
      langId: IDS.languages.thai,
      cat: PhraseCategory.GREETINGS,
      orig: "ขอบคุณ",
      lat: "Khop khun",
      eng: "Thank you",
    },
    {
      destId: IDS.destinations.bangkok,
      langId: IDS.languages.thai,
      cat: PhraseCategory.DIRECTIONS,
      orig: "เลี้ยวซ้าย",
      lat: "Liao sai",
      eng: "Turn left",
    },
    {
      destId: IDS.destinations.bangkok,
      langId: IDS.languages.thai,
      cat: PhraseCategory.FOOD_AND_DRINK,
      orig: "ไม่เผ็ด",
      lat: "Mai phet",
      eng: "Not spicy",
    },
    {
      destId: IDS.destinations.bangkok,
      langId: IDS.languages.thai,
      cat: PhraseCategory.FOOD_AND_DRINK,
      orig: "อร่อยมาก",
      lat: "Aroi mak",
      eng: "Very delicious",
    },
    {
      destId: IDS.destinations.bangkok,
      langId: IDS.languages.thai,
      cat: PhraseCategory.SHOPPING,
      orig: "ลดราคาได้ไหม",
      lat: "Lot ra-ka dai mai",
      eng: "Can you give a discount?",
    },
    {
      destId: IDS.destinations.bangkok,
      langId: IDS.languages.thai,
      cat: PhraseCategory.SHOPPING,
      orig: "แพงไป",
      lat: "Phaeng pai",
      eng: "Too expensive",
    },
    {
      destId: IDS.destinations.bangkok,
      langId: IDS.languages.thai,
      cat: PhraseCategory.TRANSPORT,
      orig: "เปิดมิเตอร์ด้วย",
      lat: "Perd meter duay",
      eng: "Please turn on the meter",
    },
    {
      destId: IDS.destinations.bangkok,
      langId: IDS.languages.thai,
      cat: PhraseCategory.NUMBERS,
      orig: "หนึ่ง สอง สาม สี่ ห้า",
      lat: "Neung, song, sam, si, ha",
      eng: "1, 2, 3, 4, 5",
    },
    {
      destId: IDS.destinations.bangkok,
      langId: IDS.languages.thai,
      cat: PhraseCategory.ACCOMMODATION,
      orig: "มีห้องว่างไหม",
      lat: "Mee hong wang mai",
      eng: "Do you have any rooms available?",
    },
    {
      destId: IDS.destinations.bangkok,
      langId: IDS.languages.thai,
      cat: PhraseCategory.EMERGENCIES,
      orig: "ช่วยด้วย",
      lat: "Chuay duay",
      eng: "Help!",
    },
    {
      destId: IDS.destinations.bangkok,
      langId: IDS.languages.thai,
      cat: PhraseCategory.GENERAL,
      orig: "ใช่ / ไม่ใช่",
      lat: "Chai / Mai chai",
      eng: "Yes / No",
    },

    // --- ROME / ITALIAN ---
    {
      destId: IDS.destinations.rome,
      langId: IDS.languages.italian,
      cat: PhraseCategory.GREETINGS,
      orig: "Arrivederci",
      lat: null,
      eng: "Goodbye",
    },
    {
      destId: IDS.destinations.rome,
      langId: IDS.languages.italian,
      cat: PhraseCategory.GREETINGS,
      orig: "Piacere di conoscerti",
      lat: null,
      eng: "Pleased to meet you",
    },
    {
      destId: IDS.destinations.rome,
      langId: IDS.languages.italian,
      cat: PhraseCategory.DIRECTIONS,
      orig: "Vada dritto",
      lat: null,
      eng: "Go straight",
    },
    {
      destId: IDS.destinations.rome,
      langId: IDS.languages.italian,
      cat: PhraseCategory.FOOD_AND_DRINK,
      orig: "Un caffè, per favore",
      lat: null,
      eng: "A coffee, please",
    },
    {
      destId: IDS.destinations.rome,
      langId: IDS.languages.italian,
      cat: PhraseCategory.FOOD_AND_DRINK,
      orig: "Sono allergico ai crostacei",
      lat: null,
      eng: "I'm allergic to shellfish",
    },
    {
      destId: IDS.destinations.rome,
      langId: IDS.languages.italian,
      cat: PhraseCategory.SHOPPING,
      orig: "Posso provarlo?",
      lat: null,
      eng: "Can I try it on?",
    },
    {
      destId: IDS.destinations.rome,
      langId: IDS.languages.italian,
      cat: PhraseCategory.TRANSPORT,
      orig: "Un biglietto andata e ritorno",
      lat: null,
      eng: "A round-trip ticket",
    },
    {
      destId: IDS.destinations.rome,
      langId: IDS.languages.italian,
      cat: PhraseCategory.NUMBERS,
      orig: "Uno, due, tre, quattro, cinque",
      lat: null,
      eng: "1, 2, 3, 4, 5",
    },
    {
      destId: IDS.destinations.rome,
      langId: IDS.languages.italian,
      cat: PhraseCategory.ACCOMMODATION,
      orig: "C'è il Wi-Fi in camera?",
      lat: null,
      eng: "Is there Wi-Fi in the room?",
    },
    {
      destId: IDS.destinations.rome,
      langId: IDS.languages.italian,
      cat: PhraseCategory.EMERGENCIES,
      orig: "Mi hanno rubato la borsa",
      lat: null,
      eng: "My bag was stolen",
    },
    {
      destId: IDS.destinations.rome,
      langId: IDS.languages.italian,
      cat: PhraseCategory.GENERAL,
      orig: "Non capisco",
      lat: null,
      eng: "I don't understand",
    },

    // --- MEXICO CITY / SPANISH ---
    {
      destId: IDS.destinations.mexicoCity,
      langId: IDS.languages.spanish,
      cat: PhraseCategory.GREETINGS,
      orig: "¿Cómo estás?",
      lat: null,
      eng: "How are you?",
    },
    {
      destId: IDS.destinations.mexicoCity,
      langId: IDS.languages.spanish,
      cat: PhraseCategory.DIRECTIONS,
      orig: "Está cerca / Está lejos",
      lat: null,
      eng: "It's near / It's far",
    },
    {
      destId: IDS.destinations.mexicoCity,
      langId: IDS.languages.spanish,
      cat: PhraseCategory.FOOD_AND_DRINK,
      orig: "¿Qué recomienda?",
      lat: null,
      eng: "What do you recommend?",
    },
    {
      destId: IDS.destinations.mexicoCity,
      langId: IDS.languages.spanish,
      cat: PhraseCategory.FOOD_AND_DRINK,
      orig: "Soy vegano/a",
      lat: null,
      eng: "I am vegan",
    },
    {
      destId: IDS.destinations.mexicoCity,
      langId: IDS.languages.spanish,
      cat: PhraseCategory.SHOPPING,
      orig: "¿Cuánto cuesta?",
      lat: null,
      eng: "How much does it cost?",
    },
    {
      destId: IDS.destinations.mexicoCity,
      langId: IDS.languages.spanish,
      cat: PhraseCategory.TRANSPORT,
      orig: "¿Dónde está la parada de autobús?",
      lat: null,
      eng: "Where is the bus stop?",
    },
    {
      destId: IDS.destinations.mexicoCity,
      langId: IDS.languages.spanish,
      cat: PhraseCategory.NUMBERS,
      orig: "Uno, dos, tres, cuatro, cinco",
      lat: null,
      eng: "1, 2, 3, 4, 5",
    },
    {
      destId: IDS.destinations.mexicoCity,
      langId: IDS.languages.spanish,
      cat: PhraseCategory.ACCOMMODATION,
      orig: "Quisiera dejar mi equipaje",
      lat: null,
      eng: "I would like to leave my luggage",
    },
    {
      destId: IDS.destinations.mexicoCity,
      langId: IDS.languages.spanish,
      cat: PhraseCategory.EMERGENCIES,
      orig: "Necesito ir al hospital",
      lat: null,
      eng: "I need to go to the hospital",
    },
    {
      destId: IDS.destinations.mexicoCity,
      langId: IDS.languages.spanish,
      cat: PhraseCategory.GENERAL,
      orig: "De nada",
      lat: null,
      eng: "You're welcome",
    },
  ];

  console.log(
    "Seeding phrases with specific destination and language links...",
  );

  for (const p of phraseData) {
    // 1. Check if the phrase already exists for this destination/language/text combo
    const existing = await prisma.phrase.findFirst({
      where: {
        destinationId: p.destId,
        languageId: p.langId,
        originalText: p.orig,
      },
    });

    // 2. Only create if it doesn't exist
    if (!existing) {
      await prisma.phrase.create({
        data: {
          destinationId: p.destId,
          languageId: p.langId,
          category: p.cat,
          originalText: p.orig,
          latinSpelling: p.lat,
          englishText: p.eng,
          isEssential: true,
        },
      });
    }
  }

  console.log("Seeding complete.");
}

seedPhrases()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
