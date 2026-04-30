import {
  extractPlannerProposal,
  proposalCanBeConfirmed,
} from "@/llm/plannerSchema";

describe("plannerSchema", () => {
  it("extracts planner JSON from tagged assistant output", () => {
    const proposal = extractPlannerProposal(`
      Here is a draft plan for your trip.
      <planner_json>
      {
        "title": "Kyoto Highlights",
        "destinationName": "Kyoto",
        "country": "Japan",
        "countryCode": "JP",
        "startDate": "2026-05-10",
        "endDate": "2026-05-13",
        "budget": 1200,
        "currencyCode": "JPY",
        "summary": "A balanced first-time Kyoto itinerary.",
        "itineraryItems": [
          {
            "title": "Fushimi Inari Shrine",
            "date": "2026-05-10",
            "startTime": "09:00",
            "notes": "Arrive early to avoid crowds."
          }
        ]
      }
      </planner_json>
    `);

    expect(proposal).not.toBeNull();
    expect(proposal).toMatchObject({
      title: "Kyoto Highlights",
      destinationName: "Kyoto",
      countryCode: "JP",
      currencyCode: "JPY",
    });
    expect(proposal.followUpQuestions).toEqual([]);
    expect(proposal.itineraryItems).toHaveLength(1);
  });

  it("requires dates and destination before confirmation", () => {
    expect(
      proposalCanBeConfirmed({
        title: "Weekend ideas",
        destinationName: "Lisbon",
        country: "Portugal",
        countryCode: "PT",
        startDate: "2026-06-01",
        endDate: "2026-06-03",
        budget: null,
        currencyCode: "EUR",
        summary: "A short Lisbon trip.",
        followUpQuestions: [],
        itineraryItems: [{ title: "Alfama walk", date: "2026-06-01" }],
      }),
    ).toBe(true);

    expect(
      proposalCanBeConfirmed({
        title: "Need more info",
        destinationName: "Lisbon",
        country: "Portugal",
        countryCode: "PT",
        startDate: null,
        endDate: null,
        budget: null,
        currencyCode: "EUR",
        summary: "Missing dates.",
        followUpQuestions: ["What dates are you traveling?"],
        itineraryItems: [{ title: "Alfama walk", date: "TBD" }],
      }),
    ).toBe(false);
  });
});
