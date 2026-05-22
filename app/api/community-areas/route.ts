import { NextResponse } from "next/server";
import {
  getFallbackCommunityAreas,
  mergeCommunityAreaFallback,
  type CommunityAreaMapArea,
} from "@/lib/communityAreaMap";
import { getStaticCommunityAreaBoundary } from "@/lib/communityAreaStaticBoundaries";
import { createSupabaseAdminClient, hasSupabaseCredentials } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface CommunityAreaRow {
  community_area_number: number;
  name: string;
  slug: string;
  centroid_lat: number | null;
  centroid_lng: number | null;
  descriptors: string[] | null;
  boundary_geojson: GeoJSON.GeoJsonObject | null;
}

function fallbackResponse() {
  return NextResponse.json(
    { areas: getFallbackCommunityAreas().map(withStaticBoundaryFallback) },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
  );
}

function withStaticBoundaryFallback(area: CommunityAreaMapArea): CommunityAreaMapArea {
  return {
    ...area,
    boundaryGeojson:
      area.boundaryGeojson ?? getStaticCommunityAreaBoundary(area.communityAreaNumber),
  };
}

// Public read-only route: exposes non-sensitive Chicago community-area labels,
// centroids, descriptors, and map geometry already covered by public RLS.
export async function GET() {
  if (!hasSupabaseCredentials()) return fallbackResponse();

  try {
    const supabase = createSupabaseAdminClient();
    const { data: city } = await supabase.from("cities").select("id").eq("slug", "chicago").single();
    const cityId = (city as { id?: string } | null)?.id;
    if (!cityId) return fallbackResponse();

    const { data: rows, error } = await supabase
      .from("community_areas")
      .select("community_area_number, name, slug, centroid_lat, centroid_lng, descriptors, boundary_geojson")
      .eq("city_id", cityId)
      .order("community_area_number")
      .returns<CommunityAreaRow[]>();

    if (error || !rows?.length) return fallbackResponse();

    const areas: CommunityAreaMapArea[] = rows.map((row) =>
      withStaticBoundaryFallback(
        mergeCommunityAreaFallback({
          communityAreaNumber: row.community_area_number,
          name: row.name,
          slug: row.slug,
          lat: row.centroid_lat,
          lng: row.centroid_lng,
          descriptors: row.descriptors,
          boundaryGeojson: row.boundary_geojson,
        }),
      ),
    );

    return NextResponse.json(
      { areas },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
    );
  } catch {
    return fallbackResponse();
  }
}
