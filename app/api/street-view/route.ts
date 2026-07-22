import { NextRequest, NextResponse } from "next/server";
import { getStreetViewImageForSeason } from "@/lib/streetView";
import { NEIGHBORHOOD_COORDINATES } from "@/lib/neighborhoodCoordinates";
import {
  jsonError,
  RATE_LIMITS,
  rateLimitRequest,
  requireApiUser,
  validateNeighborhoodQuery,
} from "@/lib/apiSecurity";
import type { ActSeason } from "@/app/sim/types";

const VALID_SEASONS: ActSeason[] = ["spring", "summer", "autumn", "winter"];

export async function GET(req: NextRequest) {
  const authResult = await requireApiUser();
  if (!authResult.ok) return authResult.response;

  const rateLimited = await rateLimitRequest(req, authResult.userId, RATE_LIMITS.lookup);
  if (rateLimited) return rateLimited;

  const validated = validateNeighborhoodQuery(req.nextUrl.searchParams.get("neighborhood"));
  if (!validated.ok) return jsonError(validated.error, 400);

  const neighborhood = validated.value;
  const entry = NEIGHBORHOOD_COORDINATES.find(
    (c) => c.name.toLowerCase() === neighborhood.toLowerCase(),
  );

  if (!entry) {
    return NextResponse.json({ imageUrl: null });
  }

  const rawSeason = req.nextUrl.searchParams.get("season") ?? "spring";
  const season: ActSeason = (VALID_SEASONS as string[]).includes(rawSeason)
    ? (rawSeason as ActSeason)
    : "spring";

  const result = await getStreetViewImageForSeason(entry.slug, season);
  return NextResponse.json(
    { imageUrl: result?.imageUrl ?? null, lat: result?.latitude ?? null, lng: result?.longitude ?? null },
    {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
