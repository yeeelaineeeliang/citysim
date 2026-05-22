import { NextRequest, NextResponse } from "next/server";
import { getCommunityAreaPreview, type CommunityAreaPreviewInput } from "@/lib/communityAreaPreview";
import { jsonError, validateNeighborhoodQuery } from "@/lib/apiSecurity";
import type { UserProfile } from "@/lib/tools/types";

export const dynamic = "force-dynamic";

const COMMUTE_PREFS = ["transit", "driving", "walking", "biking"] as const;
const DEFAULT_MONTH = 10;
const DEFAULT_YEAR = 2024;
const PRIORITY_QUERY_KEYS = {
  safety: "prioritySafety",
  transit: "priorityTransit",
  affordability: "priorityAffordability",
  cityServices: "priorityCityServices",
  entertainment: "priorityEntertainment",
} as const;

function optionalString(value: string | null, label: string, maxLength: number) {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length > maxLength) return { ok: false as const, error: `${label} must be ${maxLength} characters or fewer` };
  return { ok: true as const, value: trimmed };
}

function optionalNumber(value: string | null, label: string, min: number, max: number) {
  if (value === null || value.trim() === "") return { ok: true as const, value: undefined };
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return { ok: false as const, error: `${label} is invalid` };
  }
  return { ok: true as const, value: parsed };
}

function optionalInteger(value: string | null, label: string, fallback: number, min: number, max: number) {
  if (value === null || value.trim() === "") return { ok: true as const, value: fallback };
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return { ok: false as const, error: `${label} must be an integer between ${min} and ${max}` };
  }
  return { ok: true as const, value: parsed };
}

function optionalPriorities(
  searchParams: URLSearchParams,
): { ok: true; value: Partial<UserProfile["priorities"]> | undefined } | { ok: false; error: string } {
  const entries = Object.entries(PRIORITY_QUERY_KEYS) as Array<[
    keyof UserProfile["priorities"],
    string,
  ]>;
  const priorities: Partial<UserProfile["priorities"]> = {};
  let hasPriority = false;

  for (const [key, queryKey] of entries) {
    const raw = searchParams.get(queryKey);
    if (raw === null || raw.trim() === "") continue;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) {
      return { ok: false, error: `${queryKey} must be a number between 0 and 10` };
    }
    priorities[key] = parsed;
    hasPriority = true;
  }

  return { ok: true, value: hasPriority ? priorities : undefined };
}

function validatePreviewQuery(searchParams: URLSearchParams): { ok: true; value: CommunityAreaPreviewInput } | { ok: false; error: string } {
  const neighborhood = validateNeighborhoodQuery(searchParams.get("neighborhood"));
  if (!neighborhood.ok) return neighborhood;

  const workplace = optionalString(searchParams.get("workplace"), "workplace", 200);
  if (!workplace.ok) return workplace;

  const budgetRange = optionalString(searchParams.get("budgetRange"), "budgetRange", 40);
  if (!budgetRange.ok) return budgetRange;

  const monthlyBudget = optionalNumber(searchParams.get("monthlyBudget"), "monthlyBudget", 0, 20_000);
  if (!monthlyBudget.ok) return monthlyBudget;

  const workplaceLat = optionalNumber(searchParams.get("workplaceLat"), "workplaceLat", -90, 90);
  if (!workplaceLat.ok) return workplaceLat;

  const workplaceLng = optionalNumber(searchParams.get("workplaceLng"), "workplaceLng", -180, 180);
  if (!workplaceLng.ok) return workplaceLng;

  if ((workplaceLat.value === undefined) !== (workplaceLng.value === undefined)) {
    return { ok: false, error: "workplace coordinates must include both lat and lng" };
  }

  const commutePref = searchParams.get("commutePref") || "transit";
  if (!COMMUTE_PREFS.includes(commutePref as UserProfile["commutePref"])) {
    return { ok: false, error: "commutePref is invalid" };
  }

  const month = optionalInteger(searchParams.get("month"), "month", DEFAULT_MONTH, 1, 12);
  if (!month.ok) return month;

  const year = optionalInteger(searchParams.get("year"), "year", DEFAULT_YEAR, 2001, 2026);
  if (!year.ok) return year;

  const priorities = optionalPriorities(searchParams);
  if (!priorities.ok) return priorities;

  return {
    ok: true,
    value: {
      neighborhood: neighborhood.value,
      workplace: workplace.value,
      workplaceLat: workplaceLat.value,
      workplaceLng: workplaceLng.value,
      commutePref: commutePref as UserProfile["commutePref"],
      budgetRange: budgetRange.value,
      monthlyBudget: monthlyBudget.value,
      month: month.value,
      year: year.value,
      priorities: priorities.value,
    },
  };
}

// Public read-only route: returns aggregate decision-support labels for the
// selected community area. It does not expose private user data or run LLM work.
export async function GET(req: NextRequest) {
  const validated = validatePreviewQuery(req.nextUrl.searchParams);
  if (!validated.ok) return jsonError(validated.error, 400);

  const preview = await getCommunityAreaPreview(validated.value);
  return NextResponse.json(preview, {
    headers: { "Cache-Control": "no-store" },
  });
}
