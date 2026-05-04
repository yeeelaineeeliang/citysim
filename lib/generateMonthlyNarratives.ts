import Groq from "groq-sdk";
import Anthropic from "@anthropic-ai/sdk";
import { unstable_cache } from "next/cache";
import type { MonthData } from "@/lib/buildMonthlySimulation";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const NARRATIVES_PROMPT = (months: MonthData[]) => `
You are writing monthly simulation narratives for CityLiving Sim.

The reader is a UChicago student commuter considering Hyde Park. They want to know what each month of living there would actually feel like — the commute, the neighborhood services, the safety texture.

Translation guide — never quote raw numbers, always translate to feelings:
- High transit crowding month: "buses were packed most mornings" / "you'd often have to wait for the next one"
- Low transit crowding month: "the commute was easy" / "you almost always got a seat"
- 311 resolution faster than city average: "the city was responsive when things broke" / "requests closed quickly"
- 311 resolution slower than city average: "potholes stayed open for weeks" / "city services moved slowly"
- Low crime month: "the neighborhood felt quiet" / "nothing stood out"
- High crime month: "it was a rougher stretch" / "you'd hear more about incidents on your block"
- Winter (Dec–Feb): cold and sparse, fewer people out, shorter days affect the feel
- Summer (Jun–Aug): lively, more foot traffic, longer evenings
- Fall (Sep–Nov): the rhythm of the academic year, midterms in October
- Spring (Mar–May): the city waking up, energy picking up

Rules:
- Write in second person ("you," "your commute," "your mornings")
- 2–3 sentences per month — vivid and concrete, not generic
- Each month must feel distinct from the others — vary the focus (sometimes lead with transit, sometimes with the neighborhood feel, sometimes with a specific texture)
- October must reference UChicago academic rhythm (midterms, campus energy)
- Do NOT quote ride counts, incident numbers, or resolution days
- Make it feel like memory, not analysis

Here are the 12 months of data:
${JSON.stringify(
  months.map((m) => ({
    month: MONTH_NAMES[m.monthNumber - 1],
    transit: {
      crowdingSignal: m.transit.crowdingSignal,
      avgDailyWeekdayRides: m.transit.avgDailyWeekdayRides,
      peakDayRides: m.transit.peakDayRides,
    },
    services311: m.services311
      ? {
          requestCount: m.services311.requestCount,
          avgResolutionDays: m.services311.avgResolutionDays,
          cityAvgResolutionDays: m.services311.cityAvgResolutionDays,
          serviceSignal: m.services311.serviceSignal,
          topTypes: m.services311.topTypes,
        }
      : null,
    crime: m.crime
      ? {
          incidentCount: m.crime.incidentCount,
          topType: m.crime.topType,
          crimeSignal: m.crime.crimeSignal,
        }
      : null,
  })),
  null,
  2,
)}

Return ONLY valid JSON in this exact format — no markdown, no explanation:
{"narratives": ["<January narrative>", "<February narrative>", "<March narrative>", "<April narrative>", "<May narrative>", "<June narrative>", "<July narrative>", "<August narrative>", "<September narrative>", "<October narrative>", "<November narrative>", "<December narrative>"]}
`.trim();

const VERDICT_PROMPT = (months: MonthData[], narratives: string[]) => `
You are a trusted advisor helping a UChicago student commuter decide whether Hyde Park is right for them.

The student profile:
- Workplace: UChicago campus, 5600 S University Ave
- Transit is the top priority — they do not own a car
- Budget is tight — every dollar of rent matters
- They care about feeling safe on their block

You have just run a full 12-month simulation of their year in Hyde Park. Here are the monthly narratives:
${narratives.map((n, i) => `${MONTH_NAMES[i]}: ${n}`).join("\n")}

Key signals from the data:
- Transit crowding was high (signal = -1) in months: ${months.filter((m) => m.transit.crowdingSignal === -1).map((m) => MONTH_NAMES[m.monthNumber - 1]).join(", ") || "none"}
- Crime was elevated (signal = -2) in months: ${months.filter((m) => m.crime?.crimeSignal === -2).map((m) => MONTH_NAMES[m.monthNumber - 1]).join(", ") || "none"}
- 311 was slow (signal = -1) in months: ${months.filter((m) => m.services311?.serviceSignal === -1).map((m) => MONTH_NAMES[m.monthNumber - 1]).join(", ") || "none"}

Write a verdict paragraph of 2–4 sentences. Rules:
- Open with a direct judgment: "Hyde Park works for you because..." or "Hyde Park is a reasonable choice, but..." or "Hyde Park is a harder sell for you specifically because..."
- Name the one real caveat that matters most for this persona
- If there is a genuine tradeoff (e.g., great transit but rough winter crime), name it explicitly
- Reference specific months or patterns — not generic praise/criticism
- Never use a score or number as your verdict
- Tone: calm, direct, intelligent, slightly literary — a knowledgeable friend who has no incentive to sell them anything

Return only the verdict paragraph, no preamble.
`.trim();

function deterministicNarrative(month: MonthData): string {
  const name = MONTH_NAMES[month.monthNumber - 1];
  const crowding =
    month.transit.crowdingSignal === -1
      ? "buses were packed most mornings and you'd sometimes wait for the next one"
      : month.transit.crowdingSignal === 1
        ? "the commute was easy — you almost always got a seat and rarely waited long"
        : "transit ran predictably, nothing remarkable either way";

  const crime =
    month.crime === null
      ? ""
      : month.crime.crimeSignal === -2
        ? " It was a rougher stretch on the streets — you'd hear more about incidents in the neighborhood."
        : month.crime.crimeSignal === 2
          ? " The neighborhood felt notably quiet and settled."
          : "";

  return `In ${name}, ${crowding}.${crime} Hyde Park in ${name} had its own rhythm — familiar enough after the first few weeks.`;
}

function deterministicVerdict(months: MonthData[]): string {
  const badTransitMonths = months.filter((m) => m.transit.crowdingSignal === -1).length;
  const badCrimeMonths = months.filter((m) => m.crime?.crimeSignal === -2).length;

  if (badTransitMonths <= 2 && badCrimeMonths <= 2) {
    return "Hyde Park works for you. The #6 campus connector is reliable enough that you stop thinking about your commute after the first week, and the neighborhood settles into a manageable rhythm across most of the year. The one thing to know going in: October midterms week will test your patience on the bus — plan around it.";
  }
  return "Hyde Park is a reasonable choice for your commute, but go in with realistic expectations. Transit gets genuinely crowded during peak academic periods, and there are months where the neighborhood feels less settled. The campus proximity is a real advantage — just account for the rough patches.";
}

async function generate(months: MonthData[]): Promise<{ narratives: string[]; verdict: string }> {
  const narrativesPrompt = NARRATIVES_PROMPT(months);

  // Try Groq first
  if (process.env.GROQ_API_KEY) {
    try {
      const groq = new Groq();
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: narrativesPrompt }],
      });
      const text = completion.choices[0]?.message?.content ?? "";
      const parsed = JSON.parse(text) as { narratives?: unknown };
      if (Array.isArray(parsed.narratives) && parsed.narratives.length === 12) {
        const narratives = parsed.narratives.map(String);

        const verdictCompletion = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          max_tokens: 300,
          messages: [{ role: "user", content: VERDICT_PROMPT(months, narratives) }],
        });
        const verdict = verdictCompletion.choices[0]?.message?.content?.trim() ?? deterministicVerdict(months);

        return { narratives, verdict };
      }
    } catch {
      // fall through
    }
  }

  // Try Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic();
      const msg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [{ role: "user", content: narrativesPrompt }],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { narratives?: unknown };
        if (Array.isArray(parsed.narratives) && parsed.narratives.length === 12) {
          const narratives = parsed.narratives.map(String);

          const verdictMsg = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 300,
            messages: [{ role: "user", content: VERDICT_PROMPT(months, narratives) }],
          });
          const verdict =
            (verdictMsg.content[0]?.type === "text" ? verdictMsg.content[0].text.trim() : null) ??
            deterministicVerdict(months);

          return { narratives, verdict };
        }
      }
    } catch {
      // fall through
    }
  }

  // Deterministic fallback
  const narratives = months.map(deterministicNarrative);
  return { narratives, verdict: deterministicVerdict(months) };
}

export const generateMonthlyNarratives = unstable_cache(generate, ["v2-narratives-hyde-park-2024"], {
  revalidate: 86400,
});
