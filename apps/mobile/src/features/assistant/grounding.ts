import { client } from "@/api/client";
import { buildOfflineCurrencyTable, sliceOfflineWeatherData } from "@/features/offline/pack";
import type { OfflinePackData } from "@/features/offline/types";
import { useOfflineStore } from "@/store/offlineStore";

type DestinationSummary = {
  id: string;
  name: string;
  country: string;
  countryCode?: string;
  slug?: string;
  description?: string | null;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  currencyCode?: string;
};

type PlaceSummary = {
  id: string;
  destinationId: string;
  name: string;
  category: string;
  description?: string | null;
  rating?: number | null;
  isCurated?: boolean;
  isFeatured?: boolean;
  address?: string | null;
  city?: string | null;
  priceLevel?: number | null;
  websiteUrl?: string | null;
  phoneNumber?: string | null;
};

export type AssistantReference = {
  type: "destination" | "place";
  id: string;
  name: string;
  href: string;
  destinationId?: string | null;
  category?: string | null;
};

export type AssistantGrounding = {
  connectivity: "online" | "offline";
  matchedDestination: DestinationSummary | null;
  relatedDestinations: DestinationSummary[];
  relatedPlaces: PlaceSummary[];
  weatherSummary: string | null;
  currencySummary: string | null;
  promptContext: string;
};

const DESTINATION_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "best",
  "can",
  "do",
  "for",
  "from",
  "fun",
  "get",
  "give",
  "here",
  "historic",
  "how",
  "i",
  "in",
  "is",
  "it",
  "local",
  "me",
  "my",
  "near",
  "next",
  "of",
  "on",
  "or",
  "pack",
  "places",
  "should",
  "some",
  "summer",
  "the",
  "things",
  "this",
  "to",
  "today",
  "trip",
  "vacation",
  "visit",
  "what",
  "where",
  "with",
]);

const HISTORIC_TERMS = [
  "historic",
  "history",
  "ancient",
  "museum",
  "monument",
  "landmark",
  "temple",
  "church",
  "cathedral",
  "castle",
  "palace",
  "ruins",
];

const FOOD_TERMS = ["food", "restaurant", "eat", "brunch", "dinner", "lunch", "breakfast", "cafe"];
const NATURE_TERMS = ["park", "garden", "nature", "green", "outdoor", "scenic"];
const SHOPPING_TERMS = ["shop", "shopping", "market", "boutique"];
const NIGHTLIFE_TERMS = ["nightlife", "bar", "club", "late", "cocktail"];

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(message: string) {
  return normalize(message)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function sentenceHasAny(message: string, terms: string[]) {
  const normalized = normalize(message);
  return terms.some((term) => normalized.includes(term));
}

function extractSearchPhrases(message: string) {
  const normalized = normalize(message);
  const phrases = new Set<string>();
  const prepositionMatches = Array.from(
    normalized.matchAll(/\b(?:in|to|for|around|near|from|visit|visiting)\s+([a-z][a-z\s-]{1,40})/g),
  );

  for (const match of prepositionMatches) {
    const candidate = match[1]?.trim();
    if (candidate) {
      const words = candidate
        .split(" ")
        .filter((word) => !DESTINATION_STOP_WORDS.has(word))
        .slice(0, 3);
      if (words.length) {
        phrases.add(words.join(" "));
      }
    }
  }

  const tokens = tokenize(message).filter((token) => token.length >= 3);
  for (let size = 3; size >= 1; size -= 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      const parts = tokens.slice(index, index + size);
      if (parts.every((part) => DESTINATION_STOP_WORDS.has(part))) {
        continue;
      }
      const candidate = parts.join(" ");
      if (candidate.length >= 3) {
        phrases.add(candidate);
      }
      if (phrases.size >= 10) {
        return [...phrases];
      }
    }
  }

  return [...phrases];
}

async function fetchPopularDestinations() {
  const res = await client.api.v1.destinations.popular.get();
  if (res.error) {
    throw new Error("Could not load destinations");
  }
  return (res.data?.destinations ?? []) as DestinationSummary[];
}

async function searchDestinations(query: string) {
  const res = await client.api.v1.destinations.get({
    query: { q: query, limit: 5 },
  });
  if (res.error) {
    return [] as DestinationSummary[];
  }
  return (res.data?.destinations ?? []) as DestinationSummary[];
}

function destinationMentionedInMessage(
  destination: Pick<DestinationSummary, "name"> & Partial<Pick<DestinationSummary, "country" | "slug">>,
  message: string,
) {
  const normalizedMessage = normalize(message);
  const aliases = [destination.name, destination.country ?? "", destination.slug ?? ""]
    .map((value) => normalize(value))
    .filter((value): value is string => Boolean(value));
  return aliases.some((value) => normalizedMessage.includes(value));
}

async function resolveDestinationFromMessage(
  message: string,
  activeTripDestination?: { id: string; name: string; countryCode: string } | null,
) {
  const popularDestinations = await fetchPopularDestinations();

  const matchedPopular = popularDestinations.find((destination) =>
    destinationMentionedInMessage(destination, message),
  );
  if (matchedPopular) {
    return {
      matchedDestination: matchedPopular,
      relatedDestinations: popularDestinations.slice(0, 6),
    };
  }

  if (activeTripDestination && destinationMentionedInMessage(activeTripDestination, message)) {
    const exact = popularDestinations.find((destination) => destination.id === activeTripDestination.id);
    return {
      matchedDestination:
        exact ?? {
          ...activeTripDestination,
          country: "",
        },
      relatedDestinations: popularDestinations.slice(0, 6),
    };
  }

  const searchPhrases = extractSearchPhrases(message);
  const seen = new Set<string>();
  const searchMatches: DestinationSummary[] = [];

  for (const phrase of searchPhrases) {
    const results = await searchDestinations(phrase);
    for (const result of results) {
      if (seen.has(result.id)) continue;
      seen.add(result.id);
      searchMatches.push(result);
    }
    if (searchMatches.length >= 5) {
      break;
    }
  }

  const matchedDestination =
    searchMatches.find((destination) => destinationMentionedInMessage(destination, message)) ??
    (activeTripDestination
      ? {
          ...activeTripDestination,
          country: "",
        }
      : null) ??
    searchMatches[0] ??
    null;

  return {
    matchedDestination,
    relatedDestinations: searchMatches.length ? searchMatches : popularDestinations.slice(0, 6),
  };
}

async function fetchDestinationPlaceList(destinationId: string) {
  const res = await client.api.v1.destinations({ destId: destinationId }).places.get();
  if (res.error || !res.data?.places) {
    return [] as PlaceSummary[];
  }
  return res.data.places as PlaceSummary[];
}

async function fetchPlaceDetail(placeId: string) {
  const res = await client.api.v1.places({ id: placeId }).get();
  if (res.error || !res.data?.place) {
    return null;
  }
  return res.data.place as {
    websiteUrl?: string | null;
    phoneNumber?: string | null;
    priceLevel?: number | null;
  };
}

async function loadOfflinePack(destinationId: string) {
  return (await useOfflineStore.getState().getPackData(destinationId)) as OfflinePackData | null;
}

function scorePlace(place: PlaceSummary, message: string) {
  const normalizedMessage = normalize(message);
  const combinedText = `${place.name} ${place.category} ${place.description ?? ""}`.toLowerCase();
  let score = 0;

  if (place.isCurated) score += 40;
  if (place.isFeatured) score += 20;
  if (typeof place.rating === "number") score += place.rating * 8;

  if (sentenceHasAny(normalizedMessage, HISTORIC_TERMS)) {
    if (place.category === "ATTRACTION" || place.category === "CULTURE") score += 80;
    if (HISTORIC_TERMS.some((term) => combinedText.includes(term))) score += 40;
  }

  if (sentenceHasAny(normalizedMessage, FOOD_TERMS)) {
    if (["RESTAURANT", "CAFE", "FAST_FOOD"].includes(place.category)) score += 70;
    if (FOOD_TERMS.some((term) => combinedText.includes(term))) score += 30;
  }

  if (sentenceHasAny(normalizedMessage, NATURE_TERMS)) {
    if (place.category === "NATURE") score += 70;
  }

  if (sentenceHasAny(normalizedMessage, SHOPPING_TERMS)) {
    if (place.category === "SHOPPING") score += 70;
  }

  if (sentenceHasAny(normalizedMessage, NIGHTLIFE_TERMS)) {
    if (place.category === "NIGHTLIFE") score += 70;
  }

  if (normalizedMessage.includes("fun") || normalizedMessage.includes("today")) {
    if (["ATTRACTION", "NATURE", "SHOPPING", "NIGHTLIFE", "CAFE", "RESTAURANT"].includes(place.category)) {
      score += 20;
    }
  }

  const messageTokens = tokenize(message).filter((token) => token.length >= 4);
  for (const token of messageTokens) {
    if (combinedText.includes(token)) {
      score += 12;
    }
  }

  return score;
}

function selectRelevantPlaces(places: PlaceSummary[], message: string) {
  return [...places]
    .sort((a, b) => scorePlace(b, message) - scorePlace(a, message))
    .slice(0, 6);
}

function describeWeatherCode(code?: number | null) {
  switch (code) {
    case 0:
      return "clear";
    case 1:
    case 2:
    case 3:
      return "partly cloudy";
    case 45:
    case 48:
      return "foggy";
    case 51:
    case 53:
    case 55:
    case 61:
    case 63:
    case 65:
    case 80:
    case 81:
    case 82:
      return "rainy";
    case 71:
    case 73:
    case 75:
    case 85:
    case 86:
      return "snowy";
    case 95:
    case 96:
    case 99:
      return "stormy";
    default:
      return "mixed conditions";
  }
}

function extractRateTable(body: Record<string, unknown>, base: string): Record<string, number> {
  const inner = body[base.toLowerCase()];
  if (!inner || typeof inner !== "object") return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(inner as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      out[key.toUpperCase()] = value;
    }
  }
  return out;
}

function parseCurrencyCodes(message: string) {
  const matches = normalize(message).toUpperCase().match(/\b[A-Z]{3}\b/g);
  return Array.from(new Set(matches ?? []));
}

async function fetchWeatherSummary(destination: DestinationSummary) {
  if (destination.latitude == null || destination.longitude == null) {
    return null;
  }

  const res = await client.api.v1.weather.forecast.get({
    query: {
      latitude: destination.latitude,
      longitude: destination.longitude,
      timezone: destination.timezone ?? "auto",
      forecastDays: 3,
    },
  });

  if (res.error || !res.data) {
    return null;
  }

  const data = res.data as {
    current?: {
      temperature_2m?: number;
      apparent_temperature?: number;
      weather_code?: number;
      wind_speed_10m?: number;
    };
    daily?: {
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_probability_max?: number[];
    };
  };

  const current = data.current ?? {};
  const daily = data.daily ?? {};
  const temp = typeof current.temperature_2m === "number" ? `${Math.round(current.temperature_2m)}C` : null;
  const feelsLike =
    typeof current.apparent_temperature === "number"
      ? `${Math.round(current.apparent_temperature)}C`
      : null;
  const high =
    typeof daily.temperature_2m_max?.[0] === "number"
      ? `${Math.round(daily.temperature_2m_max[0])}C`
      : null;
  const low =
    typeof daily.temperature_2m_min?.[0] === "number"
      ? `${Math.round(daily.temperature_2m_min[0])}C`
      : null;
  const rain =
    typeof daily.precipitation_probability_max?.[0] === "number"
      ? `${Math.round(daily.precipitation_probability_max[0])}%`
      : null;

  return [
    `Live weather for ${destination.name}: ${describeWeatherCode(current.weather_code)}.`,
    temp ? `Current temperature ${temp}.` : null,
    feelsLike ? `Feels like ${feelsLike}.` : null,
    high && low ? `Today's range ${low} to ${high}.` : null,
    rain ? `Precipitation chance up to ${rain}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

async function fetchCurrencySummary(destination: DestinationSummary, message: string) {
  const destinationCurrency = destination.currencyCode?.toUpperCase();
  if (!destinationCurrency) {
    return null;
  }

  const explicitCodes = parseCurrencyCodes(message);
  let base = "USD";
  let quote = destinationCurrency;

  if (explicitCodes.length >= 2) {
    [base, quote] = explicitCodes;
  } else if (explicitCodes.length === 1) {
    if (explicitCodes[0] === destinationCurrency) {
      base = "USD";
      quote = destinationCurrency;
    } else {
      base = explicitCodes[0];
      quote = destinationCurrency;
    }
  }

  const res = await client.api.v1.currency.rates({ base }).get();
  if (res.error || !res.data) {
    return `Stored destination currency for ${destination.name}: ${destinationCurrency}.`;
  }

  const table = extractRateTable(res.data as Record<string, unknown>, base);
  const rate = table[quote];
  if (!rate) {
    return `Stored destination currency for ${destination.name}: ${destinationCurrency}.`;
  }

  return `Live currency data: 1 ${base} = ${rate.toFixed(4)} ${quote}. Destination currency for ${destination.name} is ${destinationCurrency}.`;
}

function fetchOfflineWeatherSummary(destination: DestinationSummary, pack: OfflinePackData) {
  const data = sliceOfflineWeatherData(pack, 3) as {
    current?: {
      temperature_2m?: number;
      apparent_temperature?: number;
      weather_code?: number;
    };
    daily?: {
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_probability_max?: number[];
    };
  } | null;

  if (!data) {
    return null;
  }

  const current = data.current ?? {};
  const daily = data.daily ?? {};
  const temp = typeof current.temperature_2m === "number" ? `${Math.round(current.temperature_2m)}C` : null;
  const feelsLike =
    typeof current.apparent_temperature === "number"
      ? `${Math.round(current.apparent_temperature)}C`
      : null;
  const high =
    typeof daily.temperature_2m_max?.[0] === "number"
      ? `${Math.round(daily.temperature_2m_max[0])}C`
      : null;
  const low =
    typeof daily.temperature_2m_min?.[0] === "number"
      ? `${Math.round(daily.temperature_2m_min[0])}C`
      : null;
  const rain =
    typeof daily.precipitation_probability_max?.[0] === "number"
      ? `${Math.round(daily.precipitation_probability_max[0])}%`
      : null;

  return [
    `Stored offline weather for ${destination.name}: ${describeWeatherCode(current.weather_code)}.`,
    temp ? `Current temperature ${temp}.` : null,
    feelsLike ? `Feels like ${feelsLike}.` : null,
    high && low ? `Today's range ${low} to ${high}.` : null,
    rain ? `Precipitation chance up to ${rain}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function fetchOfflineCurrencySummary(destination: DestinationSummary, message: string, pack: OfflinePackData) {
  const destinationCurrency = destination.currencyCode?.toUpperCase();
  if (!destinationCurrency || !pack.currency) {
    return null;
  }

  const explicitCodes = parseCurrencyCodes(message);
  let base = "USD";
  let quote = destinationCurrency;

  if (explicitCodes.length >= 2) {
    [base, quote] = explicitCodes;
  } else if (explicitCodes.length === 1) {
    if (explicitCodes[0] === destinationCurrency) {
      base = "USD";
      quote = destinationCurrency;
    } else {
      base = explicitCodes[0];
      quote = destinationCurrency;
    }
  }

  const table = buildOfflineCurrencyTable(pack, base);
  const rate = table[quote];
  if (!rate) {
    return `Stored destination currency for ${destination.name}: ${destinationCurrency}.`;
  }

  return `Stored offline currency data: 1 ${base} = ${rate.toFixed(4)} ${quote}. Destination currency for ${destination.name} is ${destinationCurrency}.`;
}

function buildPromptContext(input: {
  connectivity: "online" | "offline";
  matchedDestination: DestinationSummary | null;
  relatedDestinations: DestinationSummary[];
  relatedPlaces: PlaceSummary[];
  weatherSummary: string | null;
  currencySummary: string | null;
}) {
  const lines = [
    `Connectivity status: ${input.connectivity}.`,
    input.connectivity === "offline"
      ? "Do not imply live lookups succeeded. Use stored trip and destination context only."
      : "Use the grounded app data below before falling back to general travel knowledge.",
  ];

  if (input.matchedDestination) {
    lines.push(
      `Matched destination in app data: ${input.matchedDestination.name}, ${input.matchedDestination.country}${input.matchedDestination.countryCode ? ` (${input.matchedDestination.countryCode})` : ""}. destinationId=${input.matchedDestination.id}.`,
    );
    if (input.matchedDestination.description) {
      lines.push(`Destination summary: ${input.matchedDestination.description}`);
    }
    if (input.matchedDestination.currencyCode) {
      lines.push(`Destination currency code: ${input.matchedDestination.currencyCode}.`);
    }
    if (input.matchedDestination.timezone) {
      lines.push(`Destination timezone: ${input.matchedDestination.timezone}.`);
    }
  }

  if (input.relatedPlaces.length) {
    lines.push("Relevant places from app data:");
    for (const place of input.relatedPlaces.slice(0, 4)) {
      const bits = [
        place.name,
        `placeId=${place.id}`,
        `destinationId=${place.destinationId}`,
        place.category,
        typeof place.rating === "number" ? `rating ${place.rating.toFixed(1)}` : null,
        typeof place.priceLevel === "number" ? `priceLevel ${place.priceLevel}` : null,
        place.city ? `city ${place.city}` : null,
        place.address ? `address ${place.address}` : null,
        place.websiteUrl ? "hasWebsite" : null,
        place.description ?? null,
      ].filter(Boolean);
      lines.push(`- ${bits.join(" · ")}`);
    }
  }

  if (input.relatedDestinations.length) {
    lines.push("Destination records available in the app:");
    for (const destination of input.relatedDestinations.slice(0, 6)) {
      lines.push(
        `- ${destination.name}, ${destination.country} · destinationId=${destination.id}${destination.countryCode ? ` · countryCode=${destination.countryCode}` : ""}`,
      );
    }
  }

  if (input.weatherSummary) {
    lines.push(input.weatherSummary);
  }
  if (input.currencySummary) {
    lines.push(input.currencySummary);
    lines.push("Use live currency summary above. Do not invent or rely on remembered exchange rates.");
  }
  if (input.weatherSummary) {
    lines.push("Use live weather summary above. Do not invent weather details.");
  }

  lines.push(
    "If you mention a place or destination from the grounded app data, use its exact name so the app can link it.",
  );
  lines.push(
    "If user asks what to visit or what to do for matched destination, prefer grounded places first before generic suggestions.",
  );
  lines.push(
    "Schema hints: trip uses {id,title,startDate,endDate,destination{id,name,countryCode}}. itinerary item uses {title,date,startTime,endTime,notes,placeId}.",
  );
  lines.push(
    "In planner outputs, include destinationId/placeId when grounded IDs are available; otherwise use null.",
  );

  return lines.join("\n");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function entityAppearsInText(text: string, name: string) {
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(name)}(?=[^a-z0-9]|$)`, "i");
  return pattern.test(text);
}

export function buildAssistantReferences(text: string, grounding: AssistantGrounding | null) {
  if (!grounding) return [] as AssistantReference[];

  const references: AssistantReference[] = [];
  for (const destination of grounding.relatedDestinations) {
    if (entityAppearsInText(text, destination.name)) {
      references.push({
        type: "destination",
        id: destination.id,
        name: destination.name,
        href: `/destination/${destination.id}`,
      });
    }
  }

  for (const place of grounding.relatedPlaces) {
    if (entityAppearsInText(text, place.name)) {
      references.push({
        type: "place",
        id: place.id,
        name: place.name,
        href: `/place/${place.id}`,
        destinationId: place.destinationId,
        category: place.category,
      });
    }
  }

  return references.filter(
    (reference, index, list) =>
      list.findIndex((candidate) => candidate.type === reference.type && candidate.id === reference.id) === index,
  );
}

export async function buildAssistantGrounding(input: {
  message: string;
  isConnected: boolean;
  activeTripDestination?: { id: string; name: string; countryCode: string } | null;
}) {
  const connectivity = input.isConnected ? "online" : "offline";

  if (!input.isConnected) {
    const offlinePack = input.activeTripDestination?.id
      ? await loadOfflinePack(input.activeTripDestination.id)
      : null;
    const matchedDestination = offlinePack?.destination
      ? {
          ...offlinePack.destination,
        }
      : input.activeTripDestination
        ? {
            ...input.activeTripDestination,
            country: "",
          }
        : null;
    const relatedPlaces = offlinePack?.places
      ? selectRelevantPlaces(offlinePack.places as PlaceSummary[], input.message)
      : [];
    const wantsWeather = normalize(input.message).includes("weather");
    const wantsCurrency =
      normalize(input.message).includes("currency") ||
      normalize(input.message).includes("exchange") ||
      Boolean(parseCurrencyCodes(input.message).length);
    const weatherSummary =
      wantsWeather && matchedDestination && offlinePack
        ? fetchOfflineWeatherSummary(matchedDestination, offlinePack)
        : null;
    const currencySummary =
      wantsCurrency && matchedDestination && offlinePack
        ? fetchOfflineCurrencySummary(matchedDestination, input.message, offlinePack)
        : null;

    const grounding: AssistantGrounding = {
      connectivity,
      matchedDestination,
      relatedDestinations: matchedDestination ? [matchedDestination] : [],
      relatedPlaces,
      weatherSummary,
      currencySummary,
      promptContext: buildPromptContext({
        connectivity,
        matchedDestination,
        relatedDestinations: matchedDestination ? [matchedDestination] : [],
        relatedPlaces,
        weatherSummary,
        currencySummary,
      }),
    };
    return grounding;
  }

  const { matchedDestination, relatedDestinations } = await resolveDestinationFromMessage(
    input.message,
    input.activeTripDestination,
  );

  let relatedPlaces: PlaceSummary[] = [];
  if (matchedDestination?.id) {
    const placeList = await fetchDestinationPlaceList(matchedDestination.id);
    const shortlisted = selectRelevantPlaces(placeList, input.message).slice(0, 4);
    const detailed = await Promise.all(
      shortlisted.map(async (place) => {
        const detail = await fetchPlaceDetail(place.id);
        return detail ? { ...place, ...detail } : place;
      }),
    );
    relatedPlaces = detailed;
  }

  const wantsWeather = normalize(input.message).includes("weather");
  const wantsCurrency =
    normalize(input.message).includes("currency") ||
    normalize(input.message).includes("exchange") ||
    Boolean(parseCurrencyCodes(input.message).length);

  const [weatherSummary, currencySummary] = await Promise.all([
    wantsWeather && matchedDestination
      ? fetchWeatherSummary(matchedDestination)
      : Promise.resolve(null),
    wantsCurrency && matchedDestination
      ? fetchCurrencySummary(matchedDestination, input.message)
      : Promise.resolve(null),
  ]);

  const grounding: AssistantGrounding = {
    connectivity,
    matchedDestination: matchedDestination,
    relatedDestinations: matchedDestination
      ? [
          matchedDestination,
          ...relatedDestinations.filter((destination) => destination.id !== matchedDestination.id),
        ]
      : relatedDestinations,
    relatedPlaces,
    weatherSummary,
    currencySummary,
    promptContext: buildPromptContext({
      connectivity,
      matchedDestination: matchedDestination,
      relatedDestinations: matchedDestination
        ? [
            matchedDestination,
            ...relatedDestinations.filter((destination) => destination.id !== matchedDestination.id),
          ]
        : relatedDestinations,
      relatedPlaces,
      weatherSummary,
      currencySummary,
    }),
  };

  return grounding;
}
