import { NextResponse } from "next/server";
import {
  jsonError,
  RATE_LIMITS,
  rateLimitRequest,
  rejectOversizedRequest,
  requireApiUser,
  validateSimRunBody,
} from "@/lib/apiSecurity";
import { listSimRuns, saveSimRun } from "@/lib/simRuns";
import type { DataSummary } from "@/lib/tools/types";
import type { SimAct } from "@/app/sim/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authResult = await requireApiUser();
  if (!authResult.ok) return authResult.response;

  const rateLimited = await rateLimitRequest(request, authResult.userId, RATE_LIMITS.standard);
  if (rateLimited) return rateLimited;

  const tooLarge = rejectOversizedRequest(request);
  if (tooLarge) return tooLarge;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonError("request body must be valid JSON", 400);
  }

  const validated = validateSimRunBody(rawBody);
  if (!validated.ok) return jsonError(validated.error, 400);

  const { neighborhood, year, profile, actSummaries } = validated.value;
  const id = await saveSimRun(
    authResult.userId,
    neighborhood,
    year,
    profile,
    actSummaries as Partial<Record<SimAct, DataSummary>>,
  );

  if (!id) return jsonError("Saving runs is unavailable right now", 503);
  return NextResponse.json({ id });
}

export async function GET(request: Request) {
  const authResult = await requireApiUser();
  if (!authResult.ok) return authResult.response;

  const rateLimited = await rateLimitRequest(request, authResult.userId, RATE_LIMITS.standard);
  if (rateLimited) return rateLimited;

  const runs = await listSimRuns(authResult.userId);
  return NextResponse.json({ runs });
}
