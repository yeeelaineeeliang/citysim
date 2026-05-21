import { NextRequest, NextResponse } from "next/server";
import { searchNearbyEntertainmentPlaces } from "@/lib/googleMaps";
import {
  jsonError,
  RATE_LIMITS,
  rateLimitRequest,
  requireApiUser,
} from "@/lib/apiSecurity";

export const dynamic = "force-dynamic";

function parseCoordinate(value: string | null, label: string, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return { ok: false as const, error: `${label} must be a valid coordinate` };
  }
  return { ok: true as const, value: parsed };
}

export async function GET(request: NextRequest) {
  const authResult = await requireApiUser();
  if (!authResult.ok) return authResult.response;

  const rateLimited = rateLimitRequest(request, authResult.userId, RATE_LIMITS.lookup);
  if (rateLimited) return rateLimited;

  const lat = parseCoordinate(request.nextUrl.searchParams.get("lat"), "lat", -90, 90);
  if (!lat.ok) return jsonError(lat.error, 400);
  const lng = parseCoordinate(request.nextUrl.searchParams.get("lng"), "lng", -180, 180);
  if (!lng.ok) return jsonError(lng.error, 400);

  const places = await searchNearbyEntertainmentPlaces({ lat: lat.value, lng: lng.value });
  return NextResponse.json({ places });
}
