import { NextResponse } from "next/server";
import { jsonError, RATE_LIMITS, rateLimitRequest, requireApiUser } from "@/lib/apiSecurity";
import { getSimRun } from "@/lib/simRuns";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiUser();
  if (!authResult.ok) return authResult.response;

  const rateLimited = await rateLimitRequest(request, authResult.userId, RATE_LIMITS.lookup);
  if (rateLimited) return rateLimited;

  const { id } = await params;
  if (!UUID_RE.test(id)) return jsonError("Run not found", 404);

  const run = await getSimRun(id, authResult.userId);
  if (!run) return jsonError("Run not found", 404);

  return NextResponse.json({ run });
}
