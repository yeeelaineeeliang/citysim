import { NextRequest, NextResponse } from "next/server";
import { getStreetViewImageForCommunityArea } from "@/lib/streetView";
import { NEIGHBORHOOD_COORDINATES } from "@/lib/neighborhoodCoordinates";
import {
  jsonError,
  RATE_LIMITS,
  rateLimitRequest,
  requireApiUser,
  validateNeighborhoodQuery,
} from "@/lib/apiSecurity";

export async function GET(req: NextRequest) {
  const authResult = await requireApiUser();
  if (!authResult.ok) return authResult.response;

  const rateLimited = rateLimitRequest(req, authResult.userId, RATE_LIMITS.lookup);
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

  const result = await getStreetViewImageForCommunityArea(entry.slug);
  return NextResponse.json(
    { imageUrl: result?.imageUrl ?? null, lat: result?.latitude ?? null, lng: result?.longitude ?? null },
    {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
