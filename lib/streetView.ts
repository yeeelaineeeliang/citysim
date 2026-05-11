import { createSupabaseAdminClient, hasSupabaseCredentials } from "@/lib/supabase";
import { getCoordinateBySlug, getAllCoordinates } from "@/lib/neighborhoodCoordinates";

const CITY_SLUG = "chicago";
const STREET_VIEW_SIZE = "1280x720";
const STREET_VIEW_FOV = 80;
const STREET_VIEW_HEADING = 0;
const STREET_VIEW_PITCH = 0;

type CityRow = {
  id: string;
};

type CommunityAreaRow = {
  id: string;
  community_area_number: number;
  name: string;
  slug: string;
  centroid_lat: number | null;
  centroid_lng: number | null;
};

type StreetViewCacheRow = {
  image_url: string | null;
};

export type StreetViewImage = {
  imageUrl: string;
  latitude: number;
  longitude: number;
  source: "cache" | "created";
};

function getGoogleMapsApiKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
}

function buildStreetViewStaticUrl(latitude: number, longitude: number, apiKey: string) {
  const url = new URL("https://maps.googleapis.com/maps/api/streetview");
  url.searchParams.set("size", STREET_VIEW_SIZE);
  url.searchParams.set("location", `${latitude},${longitude}`);
  url.searchParams.set("fov", String(STREET_VIEW_FOV));
  url.searchParams.set("heading", String(STREET_VIEW_HEADING));
  url.searchParams.set("pitch", String(STREET_VIEW_PITCH));
  url.searchParams.set("key", apiKey);
  return url.toString();
}

function hasCoordinate(area: CommunityAreaRow) {
  return Number.isFinite(area.centroid_lat) && Number.isFinite(area.centroid_lng);
}

async function getChicagoCityId() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("cities").select("id").eq("slug", CITY_SLUG).single<CityRow>();
  if (error || !data) return null;
  return data.id;
}

export async function getStreetViewImageForCommunityArea(slug = "hyde-park"): Promise<StreetViewImage | null> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey || !hasSupabaseCredentials()) return null;

  try {
    const supabase = createSupabaseAdminClient();
    const cityId = await getChicagoCityId();
    if (!cityId) return null;

    const { data: area, error: areaError } = await supabase
      .from("community_areas")
      .select("id, community_area_number, name, slug, centroid_lat, centroid_lng")
      .eq("city_id", cityId)
      .eq("slug", slug)
      .single<CommunityAreaRow>();

    if (areaError || !area) return null;

    const { data: cached } = await supabase
      .from("street_view_cache")
      .select("image_url")
      .eq("city_id", cityId)
      .eq("community_area_id", area.id)
      .maybeSingle<StreetViewCacheRow>();

    if (cached?.image_url) {
      const coord = getCoordinateBySlug(slug);
      const latitude = area.centroid_lat ?? coord?.lat ?? 0;
      const longitude = area.centroid_lng ?? coord?.lng ?? 0;
      return { imageUrl: cached.image_url, latitude, longitude, source: "cache" };
    }

    const coord = getCoordinateBySlug(slug);
    const latitude = hasCoordinate(area) ? Number(area.centroid_lat) : coord?.lat;
    const longitude = hasCoordinate(area) ? Number(area.centroid_lng) : coord?.lng;
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return null;
    }

    if (!hasCoordinate(area)) {
      await supabase
        .from("community_areas")
        .update({ centroid_lat: latitude, centroid_lng: longitude })
        .eq("id", area.id);
    }

    const imageUrl = buildStreetViewStaticUrl(latitude, longitude, apiKey);

    const { error: cacheError } = await supabase.from("street_view_cache").insert({
      city_id: cityId,
      community_area_id: area.id,
      latitude,
      longitude,
      heading: STREET_VIEW_HEADING,
      pitch: STREET_VIEW_PITCH,
      fov: STREET_VIEW_FOV,
      image_url: imageUrl,
      metadata: {
        source: "google_street_view_static",
        community_area_number: area.community_area_number,
        community_area_name: area.name,
      },
    });

    if (cacheError) return null;

    return { imageUrl, latitude, longitude, source: "created" };
  } catch {
    return null;
  }
}

export async function cacheStreetViewImagesForAllCommunityAreas() {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing.");
  }

  const supabase = createSupabaseAdminClient();
  const cityId = await getChicagoCityId();
  if (!cityId) {
    throw new Error("Chicago city row is missing. Run supabase/schema.sql first.");
  }

  const { data: areas, error: areasError } = await supabase
    .from("community_areas")
    .select("id, community_area_number, name, slug, centroid_lat, centroid_lng")
    .eq("city_id", cityId)
    .returns<CommunityAreaRow[]>();

  if (areasError) throw new Error(`Failed to query community areas: ${areasError.message}`);

  const allCoords = getAllCoordinates();
  const areasByNumber = new Map((areas ?? []).map((area) => [area.community_area_number, area]));

  const { data: existingRows, error: existingError } = await supabase
    .from("street_view_cache")
    .select("community_area_id, image_url")
    .eq("city_id", cityId)
    .returns<Array<{ community_area_id: string; image_url: string | null }>>();

  if (existingError) throw new Error(`Failed to query street view cache: ${existingError.message}`);

  const cachedCommunityAreaIds = new Set(
    (existingRows ?? []).filter((row) => row.image_url).map((row) => row.community_area_id),
  );

  let updatedCentroids = 0;
  const rowsToInsert = [];

  for (const centroid of allCoords) {
    const area = areasByNumber.get(centroid.communityAreaNumber);
    if (!area) continue;

    if (!hasCoordinate(area)) {
      const { error } = await supabase
        .from("community_areas")
        .update({ centroid_lat: centroid.lat, centroid_lng: centroid.lng })
        .eq("id", area.id);
      if (error) throw new Error(`Failed to update centroid for ${area.name}: ${error.message}`);
      updatedCentroids += 1;
    }

    if (cachedCommunityAreaIds.has(area.id)) continue;

    rowsToInsert.push({
      city_id: cityId,
      community_area_id: area.id,
      latitude: centroid.lat,
      longitude: centroid.lng,
      heading: STREET_VIEW_HEADING,
      pitch: STREET_VIEW_PITCH,
      fov: STREET_VIEW_FOV,
      image_url: buildStreetViewStaticUrl(centroid.lat, centroid.lng, apiKey),
      metadata: {
        source: "google_street_view_static",
        community_area_number: centroid.communityAreaNumber,
        community_area_name: centroid.name,
      },
    });
  }

  if (rowsToInsert.length > 0) {
    const { error } = await supabase
      .from("street_view_cache")
      .upsert(rowsToInsert, { onConflict: "city_id,community_area_id", ignoreDuplicates: true });
    if (error) throw new Error(`Failed to cache Street View URLs: ${error.message}`);
  }

  return {
    communityAreasInCsv: allCoords.length,
    cachedBefore: cachedCommunityAreaIds.size,
    cachedNow: rowsToInsert.length,
    updatedCentroids,
  };
}
