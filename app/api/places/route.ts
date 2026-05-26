import { NextRequest, NextResponse } from "next/server";
import { parsePlaceCategories, queryLocalEntertainmentPlaces } from "@/lib/localPlaces";
import {
  jsonError,
  RATE_LIMITS,
  rateLimitPublicRequest,
} from "@/lib/apiSecurity";

export const dynamic = "force-dynamic";

function parseCoordinate(value: string | null, label: string, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return { ok: false as const, error: `${label} must be a valid coordinate` };
  }
  return { ok: true as const, value: parsed };
}

function parseLimit(value: string | null) {
  if (!value) return { ok: true as const, value: 80 };
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 160) {
    return { ok: false as const, error: "limit must be an integer between 1 and 160" };
  }
  return { ok: true as const, value: parsed };
}

function optionalNeighborhood(value: string | null) {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.length > 80) return null;
  return trimmed;
}

// Public read-only route: returns non-sensitive local/cached amenity coordinates
// for map display. It does not call paid live Places APIs.
export async function GET(request: NextRequest) {
  const rateLimited = await rateLimitPublicRequest(request, RATE_LIMITS.lookup);
  if (rateLimited) return rateLimited;

  const neighborhood = optionalNeighborhood(request.nextUrl.searchParams.get("neighborhood"));
  if (neighborhood === null) return jsonError("neighborhood must be 80 characters or fewer", 400);
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  if (!limit.ok) return jsonError(limit.error, 400);

  const latParam = request.nextUrl.searchParams.get("lat");
  const lngParam = request.nextUrl.searchParams.get("lng");
  let center: { lat: number; lng: number } | undefined;
  if (latParam || lngParam) {
    if (!latParam || !lngParam) return jsonError("lat and lng must be provided together", 400);
    const lat = parseCoordinate(latParam, "lat", -90, 90);
    if (!lat.ok) return jsonError(lat.error, 400);
    const lng = parseCoordinate(lngParam, "lng", -180, 180);
    if (!lng.ok) return jsonError(lng.error, 400);
    center = { lat: lat.value, lng: lng.value };
  }

  const result = await queryLocalEntertainmentPlaces({
    neighborhood,
    center,
    categories: parsePlaceCategories(request.nextUrl.searchParams.get("categories")),
    limit: limit.value,
  });
  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
  });
}
