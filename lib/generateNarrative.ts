import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import type { StructuredSimulationData } from "@/lib/querySimulationData";

const NARRATIVE_PROMPT = (structuredData: StructuredSimulationData) => `
You are writing a first-person simulation for CityLiving Sim — a tool that helps people feel what living in a neighborhood would actually be like, before they sign a lease.

The reader is a UChicago student considering Hyde Park. They want to know: will commuting feel easy or stressful? Will October be manageable or exhausting?

Your job is to translate raw civic data into what daily life FEELS like. Not to report statistics.

Translation guide — use these to convert numbers into feelings:
- Route 6 avg daily rides > 3,000 → reliable, rarely wait more than 8 minutes at peak
- Route 6 avg daily rides 1,500–3,000 → decent service, some waiting during off-peak
- Route 6 avg daily rides < 1,500 → infrequent — plan around the schedule
- Peak day rides > 700 → expect to stand for most of your ride that day
- Peak day rides 400–700 → crowded, but you'll usually find a seat
- Peak day rides < 400 → comfortable, rarely crowded
- Week 3 (Oct 15–21) = UChicago midterms → weave in the academic weight naturally
- Week-over-week percentage changes → ignore entirely, do not mention

Rules:
- Write in second person ("you," "your commute," "your mornings")
- Do NOT quote raw numbers, ride counts, or percentages in the output
- 3–4 sentences, vivid and concrete — make it feel like memory, not analysis
- Every sentence should answer: what will I actually experience?
- Use the data only to inform the feeling — never expose the source numbers

Data:
${JSON.stringify(structuredData, null, 2)}
`.trim();

async function generateWithGroq(structuredData: StructuredSimulationData): Promise<string> {
  const client = new Groq();
  const completion = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 350,
    messages: [{ role: "user", content: NARRATIVE_PROMPT(structuredData) }],
  });
  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("Groq returned empty response");
  return text.trim();
}

async function generateWithAnthropic(structuredData: StructuredSimulationData): Promise<string> {
  const client = new Anthropic();
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 350,
    messages: [{ role: "user", content: NARRATIVE_PROMPT(structuredData) }],
  });
  const content = message.content[0];
  if (content.type !== "text") throw new Error("Anthropic returned unexpected response type");
  return content.text.trim();
}

function generateDeterministic(structuredData: StructuredSimulationData): string {
  const { highlightedRoute, weeklyBreakdown } = structuredData;
  const { averageDailyRides, peakRides } = highlightedRoute;

  const waitTime =
    averageDailyRides > 3000
      ? "rarely wait more than 8 minutes at peak"
      : averageDailyRides > 1500
        ? "count on 10–15 minutes between buses at peak"
        : "plan around the schedule — service runs infrequently";

  const crowding =
    peakRides > 700
      ? "expect to stand hip-to-hip for most of the ride"
      : peakRides > 400
        ? "crowded, but you'll usually find a seat"
        : "comfortable — you almost always get a seat";

  const busiestWeek = [...weeklyBreakdown].sort((a, b) => b.route6Rides - a.route6Rides)[0];
  const midtermsIsBusiest = busiestWeek.week === 3;

  const midSentence = midtermsIsBusiest
    ? `Midterms week was the obvious crunch — every bus filled up and the #${highlightedRoute.route} felt like it was carrying the whole university at once.`
    : `Your busiest stretch fell in ${busiestWeek.label} — ${crowding}. Most other weeks felt manageable.`;

  return [
    `The #${highlightedRoute.route} campus connector is your October workhorse — you'd ${waitTime}, making it dependable for class commutes.`,
    midSentence,
    `Outside the peak weeks, Hyde Park transit is the kind of commute you stop thinking about after the first few days — reliable enough to plan your morning around, with one rough patch when the whole campus is on the move.`,
  ].join(" ");
}

export async function generateNarrative(structuredData: StructuredSimulationData): Promise<string> {
  if (process.env.GROQ_API_KEY) {
    try {
      return await generateWithGroq(structuredData);
    } catch {
      // fall through
    }
  }

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await generateWithAnthropic(structuredData);
    } catch {
      // fall through
    }
  }

  return generateDeterministic(structuredData);
}
