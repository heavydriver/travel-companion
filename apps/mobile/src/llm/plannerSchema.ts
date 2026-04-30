import { z } from "zod";

export const plannerItemSchema = z.object({
  title: z.string().min(1).max(100),
  date: z.string().min(1),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  placeQuery: z.string().optional().nullable(),
});

export const plannerProposalSchema = z.object({
  title: z.string().min(1).max(100),
  destinationName: z.string().min(1).max(120),
  country: z.string().optional().nullable(),
  countryCode: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  budget: z.number().optional().nullable(),
  currencyCode: z.string().optional().nullable(),
  summary: z.string().min(1),
  followUpQuestions: z.array(z.string()).optional().default([]),
  itineraryItems: z.array(plannerItemSchema).min(1),
});

export type PlannerProposal = z.infer<typeof plannerProposalSchema>;

export type PlannerTripPreview = {
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  budget: number | null;
  currencyCode: string | null;
  destinationName: string;
  country: string | null;
  countryCode: string | null;
};

export type PlannerItineraryPreviewItem = {
  id: string;
  tripId: string;
  placeId: string | null;
  title: string;
  notes: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  order: number;
  isDone: boolean;
  placeQuery: string | null;
};

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function normalizeJsonCandidate(raw: string) {
  return raw
    .replace(/<planner_json>/gi, "")
    .replace(/<\/planner_json>/gi, "")
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();
}

function normalizeTime(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return trimmed;
  }

  return `${(match[1] ?? "00").padStart(2, "0")}:${match[2] ?? "00"}`;
}

function normalizeBudget(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const numeric = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function parseFlexibleDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoAtBoundary(date: Date, boundary: "start" | "end") {
  const next = new Date(date);
  if (boundary === "start") {
    next.setHours(0, 0, 0, 0);
  } else {
    next.setHours(23, 59, 59, 999);
  }
  return next.toISOString();
}

function atStartOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function diffDays(from: Date, to: Date) {
  return Math.round(
    (atStartOfDay(to).getTime() - atStartOfDay(from).getTime()) / (1000 * 60 * 60 * 24),
  );
}

function normalizeDateString(value: unknown, boundary: "start" | "end") {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = parseFlexibleDate(value);
  return parsed ? isoAtBoundary(parsed, boundary) : null;
}

function normalizeProposalCandidate(value: unknown) {
  if (!value || typeof value !== "object") {
    return value;
  }

  const raw = value as Record<string, unknown>;
  const destination =
    raw.destination && typeof raw.destination === "object"
      ? (raw.destination as Record<string, unknown>)
      : null;
  const itineraryItems = Array.isArray(raw.itineraryItems)
    ? raw.itineraryItems
    : Array.isArray(raw.itinerary)
      ? raw.itinerary
      : [];

  return {
    title:
      typeof raw.title === "string"
        ? raw.title
        : typeof raw.tripTitle === "string"
          ? raw.tripTitle
          : "",
    destinationName:
      typeof raw.destinationName === "string"
        ? raw.destinationName
        : typeof raw.destination === "string"
          ? raw.destination
          : typeof destination?.name === "string"
            ? destination.name
            : "",
    country:
      typeof raw.country === "string"
        ? raw.country
        : typeof destination?.country === "string"
          ? destination.country
          : null,
    countryCode:
      typeof raw.countryCode === "string"
        ? raw.countryCode.toUpperCase()
        : typeof destination?.countryCode === "string"
          ? destination.countryCode.toUpperCase()
          : null,
    startDate: normalizeDateString(raw.startDate, "start"),
    endDate: normalizeDateString(raw.endDate, "end"),
    budget: normalizeBudget(raw.budget),
    currencyCode:
      typeof raw.currencyCode === "string" && raw.currencyCode.trim()
        ? raw.currencyCode.trim().toUpperCase()
        : null,
    summary:
      typeof raw.summary === "string"
        ? raw.summary
        : typeof raw.description === "string"
          ? raw.description
          : "",
    followUpQuestions: Array.isArray(raw.followUpQuestions)
      ? raw.followUpQuestions.filter((item): item is string => typeof item === "string")
      : [],
    itineraryItems: itineraryItems
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .map((item) => ({
        title: typeof item.title === "string" ? item.title : "",
        date: normalizeDateString(item.date, "start"),
        startTime: normalizeTime(item.startTime),
        endTime: normalizeTime(item.endTime),
        notes:
          typeof item.notes === "string"
            ? item.notes
            : typeof item.description === "string"
              ? item.description
              : null,
        placeQuery: typeof item.placeQuery === "string" ? item.placeQuery : null,
      })),
  };
}

export function extractPlannerProposal(text: string): PlannerProposal | null {
  const taggedMatch = text.match(/<planner_json>([\s\S]*?)<\/planner_json>/i);
  const candidates = [
    taggedMatch?.[1],
    ...Array.from(text.matchAll(/```json([\s\S]*?)```/gi)).map((match) => match[1]),
    ...Array.from(text.matchAll(/```([\s\S]*?)```/gi)).map((match) => match[1]),
    text.trim(),
    text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1),
  ].filter((candidate): candidate is string => Boolean(candidate?.trim()));

  for (const candidate of candidates) {
    const parsed = safeJsonParse(normalizeJsonCandidate(candidate));
    const result = plannerProposalSchema.safeParse(normalizeProposalCandidate(parsed));
    if (result.success) {
      return result.data;
    }
  }

  return null;
}

export function deriveProposalRange(proposal: PlannerProposal) {
  const startDate =
    parseFlexibleDate(proposal.startDate) ??
    proposal.itineraryItems.map((item) => parseFlexibleDate(item.date)).find(Boolean) ??
    null;
  const endDate =
    parseFlexibleDate(proposal.endDate) ??
    [...proposal.itineraryItems]
      .reverse()
      .map((item) => parseFlexibleDate(item.date))
      .find(Boolean) ??
    startDate;

  return {
    startDate,
    endDate: endDate ?? startDate,
  };
}

export function applyProposalDateWindow(proposal: PlannerProposal, startDate: Date, endDate: Date) {
  const safeEndDate = endDate < startDate ? startDate : endDate;
  const originalRange = deriveProposalRange(proposal);
  const originalStart = originalRange.startDate ?? startDate;

  return {
    ...proposal,
    startDate: isoAtBoundary(startDate, "start"),
    endDate: isoAtBoundary(safeEndDate, "end"),
    itineraryItems: proposal.itineraryItems.map((item) => {
      const originalItemDate = parseFlexibleDate(item.date);
      const offsetDays = originalItemDate ? diffDays(originalStart, originalItemDate) : 0;
      return {
        ...item,
        date: isoAtBoundary(addDays(startDate, offsetDays), "start"),
      };
    }),
  };
}

export function plannerProposalToTripPreview(proposal: PlannerProposal): PlannerTripPreview {
  return {
    title: proposal.title,
    description: proposal.summary,
    startDate: proposal.startDate ?? new Date().toISOString(),
    endDate: proposal.endDate ?? proposal.startDate ?? new Date().toISOString(),
    budget: proposal.budget ?? null,
    currencyCode: proposal.currencyCode?.toUpperCase() ?? null,
    destinationName: proposal.destinationName,
    country: proposal.country ?? null,
    countryCode: proposal.countryCode?.toUpperCase() ?? null,
  };
}

export function plannerProposalToItineraryPreview(
  proposal: PlannerProposal,
): PlannerItineraryPreviewItem[] {
  return proposal.itineraryItems.map((item, index) => ({
    id: `planner-item:${index}`,
    tripId: "planner-preview",
    placeId: null,
    title: item.title,
    notes: item.notes ?? null,
    date: item.date,
    startTime: item.startTime ?? null,
    endTime: item.endTime ?? null,
    order: index,
    isDone: false,
    placeQuery: item.placeQuery ?? null,
  }));
}

export function proposalCanBeConfirmed(proposal: PlannerProposal) {
  return Boolean(proposal.destinationName && proposal.startDate && proposal.endDate);
}
