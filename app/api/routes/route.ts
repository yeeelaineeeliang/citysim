import { NextResponse } from "next/server";
import { computeGoogleRouteOptions } from "@/lib/googleMaps";
import {
  jsonError,
  RATE_LIMITS,
  rateLimitRequest,
  rejectOversizedRequest,
  requireApiUser,
} from "@/lib/apiSecurity";
import type { MapPoint, UserProfile } from "@/lib/tools/types";

export const dynamic = "force-dynamic";

const MODES = ["driving", "transit", "walking", "biking"] as const;

function isPoint(value: unknown): value is MapPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.lat === "number" &&
    typeof point.lng === "number" &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

function parseModes(value: unknown): UserProfile["commutePref"][] {
  if (!Array.isArray(value)) return [...MODES];
  const parsed = value.filter((mode): mode is UserProfile["commutePref"] => MODES.includes(mode));
  return parsed.length > 0 ? [...new Set(parsed)] : [...MODES];
}

export async function POST(request: Request) {
  const authResult = await requireApiUser();
  if (!authResult.ok) return authResult.response;

  const rateLimited = rateLimitRequest(request, authResult.userId, RATE_LIMITS.lookup);
  if (rateLimited) return rateLimited;

  const tooLarge = rejectOversizedRequest(request);
  if (tooLarge) return tooLarge;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("request body must be valid JSON", 400);
  }

  if (!body || typeof body !== "object") return jsonError("request body must be an object", 400);
  const record = body as Record<string, unknown>;
  if (!isPoint(record.origin)) return jsonError("origin must include valid lat/lng", 400);
  if (!isPoint(record.destination)) return jsonError("destination must include valid lat/lng", 400);

  const options = await computeGoogleRouteOptions(record.origin, record.destination, parseModes(record.modes));
  return NextResponse.json({ options });
}
