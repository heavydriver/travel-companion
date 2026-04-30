import {
  buildPromptMessages,
  buildSystemPrompt,
  summarizeThread,
} from "@/llm/promptBuilder";

describe("promptBuilder", () => {
  it("builds a travel-scoped system prompt with trip context", () => {
    const prompt = buildSystemPrompt({
      mode: "assist",
      userName: "Varun",
      threadSummary: "User wants a relaxed city break with great food.",
      activeTrip: {
        title: "Tokyo Adventure",
        startDate: "2026-07-01",
        endDate: "2026-07-05",
        destination: {
          name: "Tokyo",
          countryCode: "JP",
        },
      },
      itineraryItems: [
        { title: "Shibuya Sky", date: "2026-07-01" },
        { title: "Tsukiji breakfast", date: "2026-07-02" },
      ],
    });

    expect(prompt).toContain("You are Roamie");
    expect(prompt).toContain("Traveler name: Varun");
    expect(prompt).toContain("Tokyo Adventure");
    expect(prompt).toContain("Shibuya Sky");
    expect(prompt).toContain("Respond in Markdown for general travel queries.");
    expect(prompt).toContain(
      `If the user asks for something off-topic, reply exactly with: "I'm your travel companion`,
    );
  });

  it("makes planner mode JSON-only", () => {
    const prompt = buildSystemPrompt({
      mode: "plan",
      userName: "Varun",
      threadSummary: "",
      activeTrip: null,
      itineraryItems: [],
      groundingContext: "Connectivity status: online.",
    });

    expect(prompt).toContain("Return JSON only.");
    expect(prompt).toContain("followUpQuestions");
    expect(prompt).not.toContain("<planner_json>");
  });

  it("limits history to the last ten messages and summarizes recent user prompts", () => {
    const messages = Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: `message-${index + 1}`,
    }));

    const promptMessages = buildPromptMessages({
      systemPrompt: "system",
      thread: {
        mode: "assist",
        summary: "",
        messages,
      },
      userMessage: "latest-question",
    });

    expect(promptMessages).toHaveLength(12);
    expect(promptMessages[0]).toEqual({ role: "system", content: "system" });
    expect(promptMessages[1].content).toBe("message-3");
    expect(promptMessages[10].content).toBe("message-12");
    expect(promptMessages[11]).toEqual({
      role: "user",
      content: "latest-question",
    });

    expect(
      summarizeThread([
        { role: "assistant", content: "ignore me" },
        { role: "user", content: "Find me brunch in Rome" },
        { role: "user", content: "Keep it under $30 a person" },
        { role: "user", content: "Near the Pantheon if possible" },
      ]),
    ).toBe(
      "Find me brunch in Rome | Keep it under $30 a person | Near the Pantheon if possible",
    );
  });
});
