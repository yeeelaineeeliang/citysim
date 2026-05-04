import Groq from "groq-sdk";
import { querySimulationData } from "@/lib/querySimulationData";

export const dynamic = "force-dynamic";

const MODEL = "llama-3.3-70b-versatile";

type SimulationRequest = {
  question?: unknown;
  month?: unknown;
  neighborhood?: unknown;
  persona?: {
    workplace?: unknown;
    monthlyBudget?: unknown;
    priority?: unknown;
  };
};

function normalizeString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeBudget(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 1400;
}

function buildSystemPrompt({
  month,
  neighborhood,
  workplace,
  monthlyBudget,
  priority,
  dataContext,
  extraRule,
}: {
  month: string;
  neighborhood: string;
  workplace: string;
  monthlyBudget: number;
  priority: string;
  dataContext: object;
  extraRule?: string;
}) {
  return `
You are a neighborhood simulation agent for CityLiving Sim.
You place the user inside a specific month of living in a
Chicago neighborhood and answer questions in second-person
present tense, as if they are currently living there.

RULES - follow these strictly:
- Answer ONLY from the DATA CONTEXT provided below.
- The data covers CTA transit only. If asked about crime, 311 services, housing costs,
  or anything else not in the data, say exactly: "I don't have data on that for this month."
- Cite at least one specific value from the data in every transit-related answer.
- Write in second-person present tense:
  "You wait..." not "Residents wait..."
- 3-5 sentences maximum. Specific and grounded, not generic.
- Do not use bullet points. Prose only.
${extraRule ? `- ${extraRule}` : ""}

USER PERSONA:
- Workplace: ${workplace}
- Monthly budget: $${monthlyBudget.toLocaleString()}
- Priority: ${priority}

SIMULATION CONTEXT:
- Neighborhood: ${neighborhood}
- Month: ${month}

DATA CONTEXT:
${JSON.stringify(dataContext, null, 2)}

Answer the user's question using only the above data.
`.trim();
}

function buildGroundingValues(dataContext: ReturnType<typeof buildDataContext>): string[] {
  return [
    dataContext.transit.route.replace("CTA Route ", ""),
    dataContext.transit.avg_daily_rides.toString(),
    dataContext.transit.peak_rides.toString(),
    ...dataContext.transit.weekly_breakdown.flatMap((w) => [w.label, w.route6_rides.toString()]),
  ];
}

function weekCrowdingLabel(rides: number, maxRides: number): string {
  if (rides > maxRides * 0.8) return "standing room only";
  if (rides > maxRides * 0.6) return "crowded";
  if (rides > maxRides * 0.4) return "moderate";
  return "comfortable";
}

function buildDataContext(simData: Awaited<ReturnType<typeof querySimulationData>>) {
  const maxRides = Math.max(...simData.weeklyBreakdown.map((w) => w.route6Rides));
  return {
    transit: {
      route: `CTA Route ${simData.highlightedRoute.route}`,
      avg_daily_rides: simData.highlightedRoute.averageDailyRides,
      peak_date: simData.highlightedRoute.peakDate,
      peak_rides: simData.highlightedRoute.peakRides,
      weekly_breakdown: simData.weeklyBreakdown.map((w) => ({
        label: w.label,
        context: w.context || null,
        route6_rides: w.route6Rides,
        crowding: weekCrowdingLabel(w.route6Rides, maxRides),
      })),
    },
  };
}

function responseCitesDataValue(text: string, groundingValues: string[]) {
  const normalized = text.replaceAll(",", "");
  return groundingValues.some((value) => normalized.includes(value));
}

async function askGroq({
  client,
  question,
  systemPrompt,
}: {
  client: Groq;
  question: string;
  systemPrompt: string;
}) {
  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    max_tokens: 240,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: question },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("Groq returned an empty response.");
  return text;
}

export async function POST(request: Request) {
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === "your_key_here") {
    return new Response("GROQ_API_KEY is missing. Add it to .env.local before running the simulation.", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  try {
    const body = (await request.json()) as SimulationRequest;
    const question = normalizeString(body.question, "");

    if (!question) {
      return new Response("Question is required.", {
        status: 400,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    const month = normalizeString(body.month, "October 2024");
    const neighborhood = normalizeString(body.neighborhood, "Hyde Park");
    const workplace = normalizeString(body.persona?.workplace, "UChicago - 5600 S University Ave");
    const monthlyBudget = normalizeBudget(body.persona?.monthlyBudget);
    const priority = normalizeString(body.persona?.priority, "transit reliability");

    const simData = await querySimulationData();
    const dataContext = buildDataContext(simData);
    const groundingValues = buildGroundingValues(dataContext);

    const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const basePrompt = buildSystemPrompt({ month, neighborhood, workplace, monthlyBudget, priority, dataContext });
    const firstResponse = await askGroq({ client, question, systemPrompt: basePrompt });

    if (responseCitesDataValue(firstResponse, groundingValues)) {
      return new Response(firstResponse, {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    const stricterPrompt = buildSystemPrompt({
      month,
      neighborhood,
      workplace,
      monthlyBudget,
      priority,
      dataContext,
      extraRule:
        "Your previous answer would be invalid if it did not cite at least one specific value from DATA CONTEXT. Include one exact value from the transit data in this answer.",
    });
    const retryResponse = await askGroq({ client, question, systemPrompt: stricterPrompt });

    if (!responseCitesDataValue(retryResponse, groundingValues)) {
      return new Response(`Grounding check failed. Model response did not cite a data value:\n\n${retryResponse}`, {
        status: 502,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    return new Response(retryResponse, {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Simulation failed.";

    return new Response(message, {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}
