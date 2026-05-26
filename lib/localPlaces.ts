import entertainmentPlacesCache from "@/data/entertainment-places.json";
import { createSupabaseAdminClient, hasSupabaseCredentials } from "@/lib/supabase";
import { getFallbackCommunityAreas } from "@/lib/communityAreaMap";
import type {
  EntertainmentPlace,
  EntertainmentPlaceCategory,
  MapPoint,
} from "@/lib/tools/types";

export type PlacesSource = "supabase" | "local_cache" | "unavailable";

export interface PlacesQuery {
  neighborhood?: string;
  center?: MapPoint;
  categories?: EntertainmentPlaceCategory[];
  limit?: number;
}

export interface PlacesResult {
  places: EntertainmentPlace[];
  summary: {
    total: number;
    byCategory: Record<EntertainmentPlaceCategory, number>;
  };
  source: PlacesSource;
}

const CATEGORY_VALUES: EntertainmentPlaceCategory[] = [
  "food",
  "bar",
  "park",
  "civic",
  "entertainment",
];

function normalizeName(value: string) {
  return value.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, " ");
}

function asCategory(value: unknown): EntertainmentPlaceCategory | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase().trim();
  if (normalized === "restaurant" || normalized === "cafe" || normalized === "coffee") return "food";
  if (normalized === "library" || normalized === "museum") return "civic";
  if (CATEGORY_VALUES.includes(normalized as EntertainmentPlaceCategory)) {
    return normalized as EntertainmentPlaceCategory;
  }
  return null;
}

function validNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function parsePlace(value: unknown, index: number): EntertainmentPlace | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const name = typeof item.name === "string"
    ? item.name
    : typeof item.dba_name === "string"
      ? item.dba_name
      : "";
  const category = asCategory(item.category ?? item.type ?? item.facility_type);
  const lat = typeof item.lat === "number" ? item.lat : Number(item.latitude);
  const lng = typeof item.lng === "number" ? item.lng : Number(item.longitude);

  if (!name.trim() || !category || !validNumber(lat, -90, 90) || !validNumber(lng, -180, 180)) {
    return null;
  }

  const neighborhood = typeof item.neighborhood === "string"
    ? item.neighborhood
    : typeof item.community_area_name === "string"
      ? item.community_area_name
      : undefined;

  return {
    id: typeof item.id === "string" && item.id.trim()
      ? item.id.trim()
      : `${normalizeName(name)}-${lat.toFixed(5)}-${lng.toFixed(5)}-${index}`,
    name: name.trim(),
    category,
    lat,
    lng,
    ...(neighborhood ? { neighborhood: neighborhood.trim() } : {}),
    ...(typeof item.address === "string" && item.address.trim() ? { address: item.address.trim() } : {}),
    ...(typeof item.source === "string" && item.source.trim() ? { source: item.source.trim() } : {}),
    ...(typeof item.description === "string" && item.description.trim() ? { description: item.description.trim() } : {}),
  };
}

function readLocalPlaces(): EntertainmentPlace[] {
  const raw = entertainmentPlacesCache as unknown;
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { places?: unknown }).places)
      ? (raw as { places: unknown[] }).places
      : [];
  return rows
    .map(parsePlace)
    .filter((place): place is EntertainmentPlace => Boolean(place));
}

function distanceMiles(a: MapPoint, b: MapPoint): number {
  const radiusMiles = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng *
      sinLng;
  return radiusMiles * 2 * Math.asin(Math.sqrt(h));
}

function neighborhoodCenter(neighborhood?: string): MapPoint | null {
  if (!neighborhood) return null;
  const normalized = normalizeName(neighborhood);
  const area = getFallbackCommunityAreas().find((item) => normalizeName(item.name) === normalized);
  return area ? { lat: area.lat, lng: area.lng } : null;
}

function filterPlaces(places: EntertainmentPlace[], query: PlacesQuery): EntertainmentPlace[] {
  const categorySet = query.categories?.length ? new Set(query.categories) : null;
  const normalizedNeighborhood = query.neighborhood ? normalizeName(query.neighborhood) : "";
  const center = query.center ?? neighborhoodCenter(query.neighborhood);
  const limit = Math.min(Math.max(query.limit ?? 80, 1), 160);

  return places
    .filter((place) => !categorySet || categorySet.has(place.category))
    .filter((place) => {
      if (!normalizedNeighborhood) return true;
      if (place.neighborhood && normalizeName(place.neighborhood) === normalizedNeighborhood) return true;
      return center ? distanceMiles(center, place) <= 2.25 : false;
    })
    .sort((a, b) => {
      if (!center) return a.name.localeCompare(b.name);
      return distanceMiles(center, a) - distanceMiles(center, b);
    })
    .slice(0, limit);
}

function summarize(places: EntertainmentPlace[]): PlacesResult["summary"] {
  const byCategory = Object.fromEntries(CATEGORY_VALUES.map((category) => [category, 0])) as Record<
    EntertainmentPlaceCategory,
    number
  >;
  places.forEach((place) => {
    byCategory[place.category] += 1;
  });
  return { total: places.length, byCategory };
}

async function loadSupabasePlaces(): Promise<EntertainmentPlace[] | null> {
  if (!hasSupabaseCredentials()) return null;
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("entertainment_places")
      .select("id, name, category, latitude, longitude, neighborhood, address, source, description")
      .limit(5000);
    if (error || !data) return null;
    const places = data
      .map((item, index) =>
        parsePlace(
          {
            ...item,
            lat: item.latitude,
            lng: item.longitude,
          },
          index,
        ),
      )
      .filter((place): place is EntertainmentPlace => Boolean(place));
    return places.length ? places : null;
  } catch {
    return null;
  }
}

export function parsePlaceCategories(value: string | null): EntertainmentPlaceCategory[] | undefined {
  if (!value) return undefined;
  const parsed = value
    .split(",")
    .map((item) => asCategory(item))
    .filter((category): category is EntertainmentPlaceCategory => Boolean(category));
  return parsed.length ? [...new Set(parsed)] : undefined;
}

export async function queryLocalEntertainmentPlaces(query: PlacesQuery): Promise<PlacesResult> {
  const supabasePlaces = await loadSupabasePlaces();
  const source: PlacesSource = supabasePlaces ? "supabase" : "local_cache";
  const places = filterPlaces(supabasePlaces ?? readLocalPlaces(), query);

  return {
    places,
    summary: summarize(places),
    source: places.length ? source : "unavailable",
  };
}
