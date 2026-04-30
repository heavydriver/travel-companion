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

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function normalizeJsonCandidate(raw: string) {
  return raw
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();
}

export function extractPlannerProposal(text: string): PlannerProposal | null {
  const taggedMatch = text.match(/<planner_json>([\s\S]*?)<\/planner_json>/i);
  const candidates = [
    taggedMatch?.[1],
    ...Array.from(text.matchAll(/```json([\s\S]*?)```/gi)).map((match) => match[1]),
    text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1),
  ].filter((candidate): candidate is string => Boolean(candidate?.trim()));

  for (const candidate of candidates) {
    const parsed = safeJsonParse(normalizeJsonCandidate(candidate));
    const result = plannerProposalSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
  }

  return null;
}

export function proposalCanBeConfirmed(proposal: PlannerProposal) {
  return Boolean(proposal.destinationName && proposal.startDate && proposal.endDate);
}
