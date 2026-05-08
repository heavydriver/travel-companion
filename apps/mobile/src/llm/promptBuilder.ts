type MinimalTrip = {
  id?: string;
  title: string;
  startDate: string;
  endDate: string;
  destination: {
    id?: string;
    name: string;
    countryCode: string;
  };
};

type MinimalItineraryItem = {
  title: string;
  date: string;
};

type MinimalThread = {
  mode: "assist" | "plan";
  summary?: string | null;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

type MinimalTripTimelineItem = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: "active" | "upcoming" | "past";
  destination: {
    id?: string;
    name: string;
    countryCode: string;
  };
};

const OFF_TOPIC_REPLY =
  "I'm your travel companion — I'm best equipped to help with travel questions.";

function estimateTokens(value: string) {
  return Math.ceil(value.length / 4);
}

function trimToTokenBudget(lines: string[], maxTokens: number) {
  const selected: string[] = [];
  let total = 0;

  for (const line of lines) {
    const next = estimateTokens(line);
    if (total + next > maxTokens) break;
    selected.push(line);
    total += next;
  }

  return selected;
}

function trimTextToTokenBudget(value: string, maxTokens: number) {
  if (!value.trim()) {
    return "";
  }
  const maxChars = Math.max(0, maxTokens * 4);
  if (value.length <= maxChars) {
    return value.trim();
  }
  return `${value.slice(0, Math.max(0, maxChars - 16)).trim()}\n...[truncated]`;
}

function compressHistoryMessage(content: string, maxChars: number) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  const head = normalized.slice(0, Math.floor(maxChars * 0.65)).trim();
  const tail = normalized.slice(-Math.floor(maxChars * 0.25)).trim();
  return `${head} ...[truncated]... ${tail}`.trim();
}

export function buildSystemPrompt(input: {
  mode: "assist" | "plan";
  userName?: string | null;
  threadSummary?: string | null;
  activeTrip?: MinimalTrip | null;
  tripTimeline?: MinimalTripTimelineItem[];
  itineraryItems?: MinimalItineraryItem[];
  groundingContext?: string | null;
}) {
  const isPlanMode = input.mode === "plan";
  const itineraryTokenBudget = isPlanMode ? 160 : 1200;
  const groundingTokenBudget = isPlanMode ? 520 : 1200;
  const tripTimelineLimit = isPlanMode ? 4 : 8;
  const totalPromptBudget = isPlanMode ? 2600 : 4200;

  const lines = [
    "You are Roamie, a personal travel agent built into the Travel Companion app.",
    "Stay in travel domain: destinations, transport, itineraries, weather, currency, language help, nearby places, maps, and trip management.",
    `If the user asks for something off-topic, reply exactly with: "${OFF_TOPIC_REPLY}"`,
    "Source priority rule: grounded app data (trip, itinerary, destination, place, weather, currency, language, maps) > model memory.",
    "When online, prefer app/API data first and use model memory only to fill gaps.",
    "When offline, prefer downloaded offline pack and local trip data first; if pack data is missing, fall back to model memory.",
    "If you must use model memory, explicitly label it as general knowledge and avoid pretending data is live.",
    "If app data conflicts with memory, trust app data.",
    "Be practical, specific, and interactive. Avoid generic filler.",
    `Traveler name: ${input.userName?.trim() || "Traveler"}`,
  ];

  if (input.activeTrip) {
    lines.push(
      `Active trip: ${input.activeTrip.title} to ${input.activeTrip.destination.name} (${input.activeTrip.destination.countryCode}) from ${input.activeTrip.startDate} to ${input.activeTrip.endDate}.${input.activeTrip.destination.id ? ` destinationId=${input.activeTrip.destination.id}.` : ""}`,
    );
  } else {
    lines.push("Active trip: none selected.");
  }

  if ((input.tripTimeline ?? []).length > 0) {
    lines.push(
      "Trip timeline (use this to infer whether user means active, upcoming, or past trips even when they do not name one):",
    );
    for (const trip of (input.tripTimeline ?? []).slice(0, tripTimelineLimit)) {
      lines.push(
        `- [${trip.status}] ${trip.title} | ${trip.startDate} to ${trip.endDate} | ${trip.destination.name} (${trip.destination.countryCode})${trip.id ? ` | tripId=${trip.id}` : ""}${trip.destination.id ? ` | destinationId=${trip.destination.id}` : ""}`,
      );
    }
  }

  if (input.threadSummary?.trim()) {
    lines.push(`Conversation summary: ${input.threadSummary.trim()}`);
  }

  const itineraryLines = trimToTokenBudget(
    (input.itineraryItems ?? []).map(
      (item) => `- ${item.date}: ${item.title}`,
    ),
    itineraryTokenBudget,
  );

  if (itineraryLines.length > 0) {
    lines.push("Current itinerary summary:");
    lines.push(...itineraryLines);
  }

  if (input.groundingContext?.trim()) {
    lines.push("Grounded app and API context:");
    lines.push(trimTextToTokenBudget(input.groundingContext.trim(), groundingTokenBudget));
  }

  lines.push(
    "Trip-reference rule: infer the target trip from recency + timeline status + destination clues; ask one short clarifying question only if ambiguous.",
  );
  lines.push(
    "Entity-link rule: when grounded entities include IDs, keep exact entity names and preserve IDs in structured outputs.",
  );

  if (input.mode === "plan") {
    lines.push(
      "Return JSON only. Do not add markdown, code fences, prose, or tags.",
      "Do not output any text before or after JSON.",
      "The JSON must include: title, destinationName, country, countryCode, destinationId, startDate, endDate, budget, currencyCode, summary, followUpQuestions, itineraryItems[].",
      "Use ISO date strings when possible.",
      "Each itinerary item must include: title, date, optional startTime, optional endTime, optional notes, optional placeQuery, optional placeId.",
      "For itinerary density, target 3-4 items per full day unless user preference or trip constraints suggest fewer or more.",
      "Keep notes short and useful. Skip notes when unnecessary.",
      "If destination or place appears in grounded app data, include destinationId/placeId exactly as given. Otherwise set destinationId/placeId to null.",
      "If you are missing important trip facts like destination or dates, still return valid JSON and put the missing details into followUpQuestions.",
      "Make summary user-friendly, date-aware, and ready for trip creation + itinerary editing.",
      "If the user asks to modify an existing plan, return the full updated JSON plan reflecting the latest request rather than only partial changes.",
    );
  } else {
    lines.push(
      "Respond in Markdown.",
      "Tone: personal travel concierge, energetic but concise, concrete recommendations.",
      "Default structure: quick answer, then actionable bullets, then one optional follow-up question that improves personalization.",
      "Do not be generic. Mention concrete places, neighborhoods, routes, timing, prices, or trade-offs when possible.",
    );
  }

  return trimTextToTokenBudget(lines.join("\n"), totalPromptBudget);
}

export function buildPromptMessages(input: {
  thread: MinimalThread;
  userMessage: string;
  systemPrompt: string;
}) {
  const historyWindow = input.thread.mode === "plan" ? 4 : 10;
  const maxHistoryMessageChars = input.thread.mode === "plan" ? 520 : 900;
  const history = input.thread.messages.slice(-historyWindow).map((message) => ({
    role: message.role,
    content: compressHistoryMessage(message.content, maxHistoryMessageChars),
  }));
  const compactUserMessage = compressHistoryMessage(
    input.userMessage,
    input.thread.mode === "plan" ? 700 : 1200,
  );

  return [
    { role: "system" as const, content: input.systemPrompt },
    ...history,
    { role: "user" as const, content: compactUserMessage },
  ];
}

export function summarizeThread(messages: Array<{ role: "user" | "assistant"; content: string }>) {
  const userPrompts = messages
    .filter((message) => message.role === "user")
    .slice(-3)
    .map((message) => message.content.trim())
    .filter(Boolean);

  if (userPrompts.length === 0) {
    return "";
  }

  return userPrompts.join(" | ").slice(0, 240);
}
