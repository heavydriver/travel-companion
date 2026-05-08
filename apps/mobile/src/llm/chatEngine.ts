import type { PlannerProposal } from "./plannerSchema";
import { extractPlannerProposal } from "./plannerSchema";
import { streamLlamaText } from "./llamaProvider";
import { buildPromptMessages, buildSystemPrompt, summarizeThread } from "./promptBuilder";

type ChatThreadShape = {
  mode: "assist" | "plan";
  summary?: string | null;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

type ActiveTrip = {
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

type ItineraryItem = {
  title: string;
  date: string;
};

export async function runAssistantCompletion(input: {
  modelPath: string;
  userName?: string | null;
  thread: ChatThreadShape;
  userMessage: string;
  activeTrip?: ActiveTrip | null;
  tripTimeline?: Array<{
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
  }>;
  itineraryItems?: ItineraryItem[];
  groundingContext?: string | null;
  onToken?: (token: string, accumulatedText: string) => void;
  abortSignal?: AbortSignal;
}) {
  const systemPrompt = buildSystemPrompt({
    mode: input.thread.mode,
    userName: input.userName,
    threadSummary: input.thread.summary,
    activeTrip: input.activeTrip,
    tripTimeline: input.tripTimeline,
    itineraryItems: input.itineraryItems,
    groundingContext: input.groundingContext,
  });

  const messages = buildPromptMessages({
    thread: input.thread,
    userMessage: input.userMessage,
    systemPrompt,
  });

  const text = await streamLlamaText({
    modelPath: input.modelPath,
    messages,
    onToken: input.onToken,
    abortSignal: input.abortSignal,
  });

  const proposal = input.thread.mode === "plan" ? extractPlannerProposal(text) : null;
  return {
    text,
    proposal,
    nextSummary: summarizeThread([
      ...input.thread.messages,
      { role: "user" as const, content: input.userMessage },
      { role: "assistant" as const, content: text },
    ]),
  };
}

export function plannerProposalToPreview(proposal: PlannerProposal) {
  return proposal.itineraryItems.map((item, index) => ({
    id: `${proposal.destinationName}-${index}`,
    title: item.title,
    date: item.date,
    startTime: item.startTime ?? null,
    endTime: item.endTime ?? null,
    notes: item.notes ?? null,
  }));
}
