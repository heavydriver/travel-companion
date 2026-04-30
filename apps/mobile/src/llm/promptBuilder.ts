type MinimalTrip = {
  title: string;
  startDate: string;
  endDate: string;
  destination: {
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

export function buildSystemPrompt(input: {
  mode: "assist" | "plan";
  userName?: string | null;
  threadSummary?: string | null;
  activeTrip?: MinimalTrip | null;
  itineraryItems?: MinimalItineraryItem[];
  groundingContext?: string | null;
}) {
  const lines = [
    "You are Roamie, an on-device travel assistant inside a travel companion app.",
    "Only discuss travel, destinations, food, culture, logistics, trip planning, weather, currency, safety, local etiquette, transportation, and itinerary building.",
    `If the user asks for something off-topic, reply exactly with: "${OFF_TOPIC_REPLY}"`,
    "Prefer grounded, practical recommendations. Be explicit when something may be stale or based on general knowledge instead of live data.",
    "When grounded app data is provided, treat it as more reliable than your general memory.",
    `Traveler name: ${input.userName?.trim() || "Traveler"}`,
  ];

  if (input.activeTrip) {
    lines.push(
      `Current trip: ${input.activeTrip.title} to ${input.activeTrip.destination.name} (${input.activeTrip.destination.countryCode}) from ${input.activeTrip.startDate} to ${input.activeTrip.endDate}.`,
    );
  } else {
    lines.push("Current trip: none selected.");
  }

  if (input.threadSummary?.trim()) {
    lines.push(`Conversation summary: ${input.threadSummary.trim()}`);
  }

  const itineraryLines = trimToTokenBudget(
    (input.itineraryItems ?? []).map(
      (item) => `- ${item.date}: ${item.title}`,
    ),
    1200,
  );

  if (itineraryLines.length > 0) {
    lines.push("Current itinerary summary:");
    lines.push(...itineraryLines);
  }

  if (input.groundingContext?.trim()) {
    lines.push("Grounded app and API context:");
    lines.push(input.groundingContext.trim());
  }

  if (input.mode === "plan") {
    lines.push(
      "Return JSON only. Do not add markdown, code fences, prose, or tags.",
      "The JSON must include: title, destinationName, country, countryCode, startDate, endDate, budget, currencyCode, summary, followUpQuestions, itineraryItems[].",
      "Use ISO date strings when possible. Each itinerary item should include title, date, optional startTime, optional endTime, optional notes, and optional placeQuery.",
      "If you are missing important trip facts like destination or dates, still return valid JSON and put the missing details into followUpQuestions.",
      "Make the summary user-friendly and itinerary items realistic, date-aware, and easy to turn into a trip.",
      "If the user asks to modify an existing plan, return the full updated JSON plan reflecting the latest request rather than only partial changes.",
    );
  } else {
    lines.push(
      "Respond in Markdown for general travel queries.",
      "Use short headings or bullets when they improve readability, and keep answers practical and focused on helping the user travel well.",
    );
  }

  return lines.join("\n");
}

export function buildPromptMessages(input: {
  thread: MinimalThread;
  userMessage: string;
  systemPrompt: string;
}) {
  const history = input.thread.messages.slice(-10).map((message) => ({
    role: message.role,
    content: message.content,
  }));

  return [
    { role: "system" as const, content: input.systemPrompt },
    ...history,
    { role: "user" as const, content: input.userMessage },
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
