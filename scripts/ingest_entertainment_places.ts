import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createSupabaseAdminClient } from "../lib/supabase";
import { findAreaForPoint, getAreaContext, loadBoundaries } from "./ingest/shared";

type Category = "food" | "bar" | "park" | "civic" | "entertainment";

interface PlaceOut {
  id: string;
  name: string;
  category: Category;
  neighborhood?: string;
  address?: string;
  lat: number;
  lng: number;
  source: string;
  description?: string;
}

const OUT_DIR = path.join(process.cwd(), "CityData", "filtered");
const DEFAULT_CACHE_FILE = path.join(process.cwd(), "data", "entertainment-places.json");
const FOOD_INSPECTIONS_ENDPOINT = "https://data.cityofchicago.org/resource/4ijn-s7e5.json";
// Same datasets scripts/ingest/entertainment_2024.ts uses for entertainment_metrics.
const PARKS_ENDPOINT = "https://data.cityofchicago.org/resource/ejsh-fztr.json";
const LIBRARIES_ENDPOINT = "https://data.cityofchicago.org/resource/x8fc-8rcq.json";

function argValue(name: string): string | null {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function slug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parseNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCategory(value: unknown): Category | null {
  const text = String(value ?? "").toLowerCase();
  if (/bar|tavern|liquor/.test(text)) return "bar";
  if (/museum|library|school|theater|theatre|gallery/.test(text)) return "civic";
  if (/park|recreation|garden/.test(text)) return "park";
  if (/music|venue|arts|book/.test(text)) return "entertainment";
  if (/restaurant|grocery|bakery|mobile food|catering|food/.test(text)) return "food";
  return null; // don't guess — exclude anything unrecognized rather than mislabel it
}

function parseLocalJson(file: string): PlaceOut[] {
  const raw = JSON.parse(readFileSync(file, "utf8")) as unknown;
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { places?: unknown }).places)
      ? (raw as { places: unknown[] }).places
      : [];

  return rows.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const name = String(record.name ?? record.dba_name ?? record.aka_name ?? "").trim();
    const lat = parseNumber(record.lat ?? record.latitude);
    const lng = parseNumber(record.lng ?? record.longitude);
    const category = normalizeCategory(record.category ?? record.facility_type);
    if (!name || lat === null || lng === null || !category) return [];
    return [{
      id: String(record.id ?? `${slug(name)}-${index}`),
      name,
      category,
      neighborhood: typeof record.neighborhood === "string" ? record.neighborhood : undefined,
      address: typeof record.address === "string" ? record.address : undefined,
      lat,
      lng,
      source: typeof record.source === "string" ? record.source : `local file ${path.basename(file)}`,
      description: typeof record.description === "string" ? record.description : undefined,
    }];
  });
}

async function fetchFoodInspections(limit: number): Promise<PlaceOut[]> {
  const url = new URL(FOOD_INSPECTIONS_ENDPOINT);
  url.searchParams.set("$limit", String(limit));
  url.searchParams.set("$select", "dba_name,aka_name,facility_type,address,latitude,longitude");
  url.searchParams.set("$where", "latitude IS NOT NULL AND longitude IS NOT NULL");
  url.searchParams.set("$order", "inspection_date DESC");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Chicago Food Inspections request failed: ${res.status}`);
  const rows = (await res.json()) as Array<Record<string, unknown>>;
  const seen = new Set<string>();

  return rows.flatMap((row, index) => {
    const name = String(row.aka_name ?? row.dba_name ?? "").trim();
    const lat = parseNumber(row.latitude);
    const lng = parseNumber(row.longitude);
    const category = normalizeCategory(row.facility_type);
    if (!name || lat === null || lng === null || !category) return [];
    const key = `${slug(name)}:${lat.toFixed(5)}:${lng.toFixed(5)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      id: `${key}:${index}`,
      name,
      category,
      address: typeof row.address === "string" ? row.address : undefined,
      lat,
      lng,
      source: "Chicago Food Inspections",
      description: typeof row.facility_type === "string" ? row.facility_type : undefined,
    }];
  });
}

async function writeToSupabase(places: PlaceOut[]) {
  const boundaries = loadBoundaries();
  const supabase = createSupabaseAdminClient();
  const { cityId, byNumber } = await getAreaContext(supabase);

  const rows = places.flatMap((place) => {
    const areaNumber = findAreaForPoint(place.lat, place.lng, boundaries);
    const area = areaNumber !== null ? byNumber.get(areaNumber) : undefined;
    return [{
      city_id: cityId,
      community_area_id: area?.id ?? null,
      neighborhood: area?.name ?? place.neighborhood ?? null,
      name: place.name,
      category: place.category,
      address: place.address ?? null,
      latitude: place.lat,
      longitude: place.lng,
      source: place.source,
      description: place.description ?? null,
    }];
  });

  // No unique constraint beyond `id` on entertainment_places, and this script
  // regenerates the full list from one source snapshot each run — delete the
  // city's existing rows and insert fresh ones instead of upserting.
  const { error: deleteError } = await supabase.from("entertainment_places").delete().eq("city_id", cityId);
  if (deleteError) throw new Error(`delete from entertainment_places failed: ${deleteError.message}`);

  const chunkSize = 500;
  let written = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("entertainment_places").insert(chunk);
    if (error) throw new Error(`insert into entertainment_places failed: ${error.message}`);
    written += chunk.length;
  }
  console.log(`entertainment_places: wrote ${written} rows to Supabase`);
}

type ParkGeom = { type?: string; coordinates?: unknown };

/** Average of the first ring's vertices — good enough to place a park marker. */
function geomCentroid(geom: ParkGeom | undefined): { lat: number; lng: number } | null {
  if (!geom?.coordinates) return null;
  let ring: unknown;
  if (geom.type === "MultiPolygon") ring = (geom.coordinates as unknown[][][])[0]?.[0];
  else if (geom.type === "Polygon") ring = (geom.coordinates as unknown[][])[0];
  if (!Array.isArray(ring) || ring.length === 0) return null;
  let latSum = 0;
  let lngSum = 0;
  let count = 0;
  for (const position of ring as [number, number][]) {
    const [lng, lat] = position;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    latSum += lat;
    lngSum += lng;
    count += 1;
  }
  if (count === 0) return null;
  return { lat: latSum / count, lng: lngSum / count };
}

async function fetchParks(): Promise<PlaceOut[]> {
  const url = new URL(PARKS_ENDPOINT);
  url.searchParams.set("$limit", "1000");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Chicago Parks request failed: ${res.status}`);
  const rows = (await res.json()) as Array<Record<string, unknown>>;
  return rows.flatMap((row, index) => {
    const name = String(row.label ?? row.park ?? "").trim();
    const centroid = geomCentroid(row.the_geom as ParkGeom | undefined);
    if (!name || !centroid) return [];
    return [{
      id: `park-${slug(name)}-${index}`,
      name,
      category: "park" as const,
      lat: centroid.lat,
      lng: centroid.lng,
      source: "Chicago Park District",
      description: "Public park",
    }];
  });
}

async function fetchLibraries(): Promise<PlaceOut[]> {
  const url = new URL(LIBRARIES_ENDPOINT);
  url.searchParams.set("$limit", "500");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Chicago Libraries request failed: ${res.status}`);
  const rows = (await res.json()) as Array<Record<string, unknown>>;
  return rows.flatMap((row, index) => {
    const rawName = String(row.branch_ ?? row.name_ ?? row.name ?? "").trim();
    const location = row.location as { latitude?: string; longitude?: string } | undefined;
    const lat = parseNumber(location?.latitude);
    const lng = parseNumber(location?.longitude);
    if (!rawName || lat === null || lng === null) return [];
    const name = /librar/i.test(rawName) ? rawName : `${rawName} Library`;
    return [{
      id: `library-${slug(rawName)}-${index}`,
      name,
      category: "civic" as const,
      address: typeof row.address === "string" ? row.address : undefined,
      lat,
      lng,
      source: "Chicago Public Library",
      description: "Public library branch",
    }];
  });
}

async function main() {
  const source = argValue("--source");
  const limit = Number(argValue("--limit") ?? 5000);
  const outFile = path.resolve(argValue("--out") ?? DEFAULT_CACHE_FILE);
  const skipDb = process.argv.includes("--skip-db");
  let places: PlaceOut[];

  if (source) {
    const file = path.resolve(source);
    if (!existsSync(file)) throw new Error(`Source file not found: ${file}`);
    places = parseLocalJson(file);
  } else {
    places = await fetchFoodInspections(Number.isFinite(limit) ? limit : 5000);
    // Parks and libraries fill the park/civic categories the food-inspections
    // feed can't provide; their failure shouldn't sink the food ingestion.
    for (const [label, fetcher] of [["parks", fetchParks], ["libraries", fetchLibraries]] as const) {
      try {
        const extra = await fetcher();
        places = places.concat(extra);
        console.log(`Fetched ${extra.length} ${label}`);
      } catch (error) {
        console.warn(`${label} pull failed (${(error as Error).message.slice(0, 120)}) — continuing without them`);
      }
    }
  }

  mkdirSync(path.dirname(outFile), { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(places, null, 2)}\n`);
  console.log(`Wrote ${places.length} entertainment places to ${outFile}`);

  if (skipDb) {
    console.log("entertainment_places: --skip-db set, not writing to Supabase");
    return;
  }
  await writeToSupabase(places);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
