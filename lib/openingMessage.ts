import Groq from "groq-sdk";
import type { ChatResponse, UserProfile } from "@/lib/tools/types";

const MODEL = "llama-3.3-70b-versatile";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export interface OpeningRequest {
  neighborhood: string;
  month: number;
  year?: number;
  profile: UserProfile;
}

function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? "this month";
}

function topPriority(profile: UserProfile): string {
  return (
    Object.entries(profile.priorities)
      .sort((a, b) => b[1] - a[1])[0]?.[0]
      ?.replaceAll(/([A-Z])/g, " $1")
      .toLowerCase() ?? "quality of life"
  );
}

function buildOpeningPrompt(req: OpeningRequest): string {
  const month = monthName(req.month);
  const year = req.year ?? 2024;

  return `You are Sam, a long-time resident of ${req.neighborhood}. Generate a single scene-setting opening line for ${month} ${year} in this neighborhood.

User profile:
- Monthly budget: ${req.profile.budgetRange}
- Workplace: ${req.profile.workplace}
- Commute preference: ${req.profile.commutePref}
- Top priority: ${topPriority(req.profile)}

Rules:
- Maximum 2 sentences
- First person or direct address ("It's January..." or "January in ${req.neighborhood}...")
- Must reference something specific and sensory about this month in this neighborhood: weather feel, street atmosphere, or something that changes this month
- Do not summarize data. Do not answer a question.
- Do not mention crime rates, transit numbers, rent estimates, incidents, or any statistics.
- End with an implicit or explicit invitation to ask something, so the user feels like Sam is present and ready.
- Tone: the way a neighbor talks, not the way a tour guide talks.
- Do not say "Welcome" or call yourself a guide.`;
}

function twoSentenceLimit(text: string): string {
  const normalized = text
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, " ");
  const sentences = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  return sentences.slice(0, 2).join(" ").trim();
}

function hasReportLanguage(text: string): boolean {
  return /\d|crime|rate|transit|rent|estimate|incident|statistic|reported|ridership|affordable unit/i.test(text);
}

export function deterministicOpeningMessage(req: OpeningRequest): string {
  const neighborhood = req.neighborhood;
  const month = monthName(req.month);

  const fallbackByMonth = [
    `${month} in ${neighborhood} feels tucked in and cold, with people moving quickly between warm buildings. Ask me what you want to understand about living here.`,
    `${month} in ${neighborhood} is quiet in that deep-winter way, the kind of month where errands get shorter and indoor routines matter more. Tell me what you want to size up first.`,
    `${month} in ${neighborhood} still carries winter on the sidewalks, but you start to feel the neighborhood waking back up. Ask me anything about how it feels to live here.`,
    `${month} in ${neighborhood} has that early-spring restlessness, with people lingering outside a little longer even when the air is still sharp. What do you want to know?`,
    `${month} in ${neighborhood} opens up fast, with greener blocks and more people out after work. Ask me what you want to understand about living here.`,
    `${month} in ${neighborhood} starts to feel lived-in outdoors, with warmer evenings and more street life around the corners people actually use. Ask me anything.`,
    `${month} in ${neighborhood} has full summer energy, the sidewalks busier and the evenings slower. Tell me what you want to know about the month here.`,
    `${month} in ${neighborhood} feels like late summer, warm and a little worn in around the edges. Ask me what you want to figure out before picturing yourself here.`,
    `${month} in ${neighborhood} shifts into fall mode, with routines tightening up and the air starting to turn. What do you want to know about living here?`,
    `${month} in ${neighborhood} has that crisp fall feel, leaves underfoot and evenings arriving faster than you expect. Ask me anything you want to size up here.`,
    `${month} in ${neighborhood} gets quieter and grayer, with people choosing familiar routes and warmer rooms. Ask me what you want to understand first.`,
    `${month} in ${neighborhood} settles into winter, with colder blocks and a softer pace after dark. Tell me what you want to know about being here.`,
  ];

  return fallbackByMonth[req.month - 1] ?? fallbackByMonth[0];
}

export async function generateOpeningMessage(req: OpeningRequest): Promise<ChatResponse> {
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === "your_key_here") {
    return { response: deterministicOpeningMessage(req), toolsUsed: [] };
  }

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.55,
      max_tokens: 90,
      messages: [
        { role: "system", content: buildOpeningPrompt(req) },
        {
          role: "user",
          content: `Open ${monthName(req.month)} in ${req.neighborhood} with one short neighborly line.`,
        },
      ],
    });

    const response = twoSentenceLimit(completion.choices[0]?.message?.content ?? "");
    if (!response || hasReportLanguage(response)) {
      return { response: deterministicOpeningMessage(req), toolsUsed: [] };
    }

    return { response, toolsUsed: [] };
  } catch {
    return { response: deterministicOpeningMessage(req), toolsUsed: [] };
  }
}
