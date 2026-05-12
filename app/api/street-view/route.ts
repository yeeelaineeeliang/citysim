import { NextRequest, NextResponse } from "next/server";
import { getStreetViewImageForCommunityArea } from "@/lib/streetView";
import { NEIGHBORHOOD_COORDINATES } from "@/lib/neighborhoodCoordinates";

export async function GET(req: NextRequest) {
  const neighborhood = req.nextUrl.searchParams.get("neighborhood") ?? "";
  const entry = NEIGHBORHOOD_COORDINATES.find(
    (c) => c.name.toLowerCase() === neighborhood.toLowerCase(),
  );

  if (!entry) {
    return NextResponse.json({ imageUrl: null });
  }

  const result = await getStreetViewImageForCommunityArea(entry.slug);
  return NextResponse.json(
    { imageUrl: result?.imageUrl ?? null },
    {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
