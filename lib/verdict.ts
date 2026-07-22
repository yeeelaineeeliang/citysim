import type { DataSummary, UserProfile } from "@/lib/tools/types";
import type { SimAct } from "@/app/sim/types";

// Bump when the heuristics below change — saved runs freeze the verdict they
// were computed with, so the version tells future readers which rules applied.
export const VERDICT_VERSION = 1;

export interface VerdictSignal {
  key: "budget" | "commute" | "lifestyle";
  label: string;
  verdict: string;
  detail: string;
  caveat?: string;
}

function avg(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => typeof v === "number" && v !== null);
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function computeVerdict(
  neighborhood: string,
  profile: UserProfile,
  actDataSummaries: Partial<Record<SimAct, DataSummary>>,
): VerdictSignal[] {
  const summaries = Object.values(actDataSummaries).filter(Boolean) as DataSummary[];

  const avgRent = avg(summaries.map((s) => s.avgRent));
  const avgCommute = avg(summaries.map((s) => s.commuteMinutes));
  const avg311 = avg(summaries.map((s) => s.requests311));

  const budget = profile.monthlyBudget ?? 0;

  let budgetLabel: string;
  let budgetDetail: string;
  let budgetCaveat: string | undefined;
  if (avgRent === null) {
    budgetLabel = "Rent data unavailable";
    budgetDetail = "Not enough housing data was collected during the simulation.";
  } else {
    budgetCaveat = "Rent is a market estimate from neighborhood averages, not live listings.";
    if (budget > 0 && avgRent <= budget * 0.95) {
      // monthlyBudget is the "Monthly rent budget" slider value — compare rent to it
      // directly, not via an income-percentage rule.
      budgetLabel = "Fits comfortably";
      budgetDetail = `Estimated rent (~$${Math.round(avgRent)}/mo) is well within your $${budget}/mo rent budget.`;
    } else if (budget > 0 && avgRent <= budget * 1.10) {
      budgetLabel = "Tight but manageable";
      budgetDetail = `Estimated rent (~$${Math.round(avgRent)}/mo) is a stretch against your $${budget}/mo rent budget.`;
    } else {
      budgetLabel = "Over budget";
      budgetDetail = `Estimated rent (~$${Math.round(avgRent)}/mo) exceeds your $${budget}/mo rent budget.`;
    }
  }

  let commuteLabel: string;
  let commuteDetail: string;
  if (avgCommute === null) {
    commuteLabel = "Commute data unavailable";
    commuteDetail = "Commute estimates weren't available for this simulation.";
  } else if (avgCommute < 25) {
    commuteLabel = "Smooth commute";
    commuteDetail = `Average commute ~${Math.round(avgCommute)} min — one of the shorter ones in the city.`;
  } else if (avgCommute < 45) {
    commuteLabel = "Manageable commute";
    commuteDetail = `Average commute ~${Math.round(avgCommute)} min — typical for Chicago, worth accounting for.`;
  } else {
    commuteLabel = "Heavy commute friction";
    commuteDetail = `Average commute ~${Math.round(avgCommute)} min — longer than average. Factor this into your day.`;
  }

  const cityServicesPriority = profile.priorities.cityServices ?? 3;
  let lifestyleLabel: string;
  let lifestyleDetail: string;
  if (avg311 === null) {
    lifestyleLabel = "Services data unavailable";
    lifestyleDetail = "City service request data wasn't captured during the simulation.";
  } else if (cityServicesPriority >= 3 && avg311 < 170) {
    lifestyleLabel = "Strong services match";
    lifestyleDetail = `${neighborhood} averaged ~${Math.round(avg311)} 311 requests/month — responsive for a priority you rated highly.`;
  } else if (avg311 < 200) {
    lifestyleLabel = "Partial match";
    lifestyleDetail = `Service request volume (~${Math.round(avg311)}/month) is moderate. Seasonal variation was visible.`;
  } else {
    lifestyleLabel = "Some gaps";
    lifestyleDetail = `Higher service request load (~${Math.round(avg311)}/month) could reflect maintenance backlog. Worth watching.`;
  }

  return [
    { key: "budget", label: "Budget fit", verdict: budgetLabel, detail: budgetDetail, caveat: budgetCaveat },
    { key: "commute", label: "Commute reality", verdict: commuteLabel, detail: commuteDetail },
    { key: "lifestyle", label: "Lifestyle match", verdict: lifestyleLabel, detail: lifestyleDetail },
  ];
}
