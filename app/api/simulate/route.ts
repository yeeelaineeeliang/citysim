import Groq from "groq-sdk";

export const dynamic = "force-dynamic";

const MODEL = "llama-3.3-70b-versatile";

const DATA_CONTEXT = {
  transit: {
    route: "CTA Route 6",
    peak_frequency_minutes: "6-8",
    peak_crowding: "moderate to high",
    notable_period: "Midterms week (Oct 12-16)",
    midterms_crowding: "standing room only",
    on_time_rate: "91%",
  },
  service_requests_311: {
    open_requests_on_block: 2,
    request_types: ["pothole", "graffiti"],
    avg_resolution_days: 9.1,
    city_avg_resolution_days: 5.2,
  },
  crime: {
    incidents_in_area: 14,
    most_common_type: "theft",
    change_vs_last_month: "-3%",
    city_avg_incidents: 22,
  },
  housing: {
    median_rent_1br: 1450,
    budget_slack_dollars: -50,
    available_units_in_range: 8,
  },
};

const REQUIRED_DATA_VALUES = ["6-8", "91%", "2", "9.1", "5.2", "14", "22", "1450", "-50", "8"];

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
  extraRule,
}: {
  month: string;
  neighborhood: string;
  workplace: string;
  monthlyBudget: number;
  priority: string;
  extraRule?: string;
}) {
  return `
You are a neighborhood simulation agent for CityLiving Sim.
You place the user inside a specific month of living in a
Chicago neighborhood and answer questions in second-person
present tense, as if they are currently living there.

RULES - follow these strictly:
- Answer ONLY from the DATA CONTEXT provided below.
- Do not invent any fact not present in the data context.
- If the data does not cover the question, say explicitly:
  "I don't have data on that for this month."
- Cite at least one specific number from the data in every answer.
- Use exact numeric values as written in DATA CONTEXT when possible, such as "6-8", "91%", "9.1", "5.2", "14", "22", "$1,450", "-$50", or "8".
- Write in second-person present tense:
  "You wait 6-8 minutes..." not "Residents wait..."
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
${JSON.stringify(DATA_CONTEXT, null, 2)}

Answer the user's question using only the above data.
`.trim();
}

function responseCitesDataNumber(text: string) {
  const normalized = text.replaceAll(",", "");
  return REQUIRED_DATA_VALUES.some((value) => normalized.includes(value));
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

    const month = normalizeString(body.month, "October 2020");
    const neighborhood = normalizeString(body.neighborhood, "Hyde Park");
    const workplace = normalizeString(body.persona?.workplace, "UChicago - 5600 S University Ave");
    const monthlyBudget = normalizeBudget(body.persona?.monthlyBudget);
    const priority = normalizeString(body.persona?.priority, "transit reliability");

    const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const basePrompt = buildSystemPrompt({ month, neighborhood, workplace, monthlyBudget, priority });
    const firstResponse = await askGroq({ client, question, systemPrompt: basePrompt });

    if (responseCitesDataNumber(firstResponse)) {
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
      extraRule:
        'Your previous answer would be invalid if it did not cite at least one exact numeric value from DATA CONTEXT. Include one exact value in this answer, for example "6-8", "91%", "9.1", "5.2", "14", "22", "$1,450", "-$50", or "8".',
    });
    const retryResponse = await askGroq({ client, question, systemPrompt: stricterPrompt });

    if (!responseCitesDataNumber(retryResponse)) {
      return new Response(`Grounding check failed. Model response did not cite a data number:\n\n${retryResponse}`, {
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
