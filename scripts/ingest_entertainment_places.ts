import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

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

function normalizeCategory(value: unknown): Category {
  const text = String(value ?? "").toLowerCase();
  if (/bar|tavern|liquor/.test(text)) return "bar";
  if (/museum|library|school|theater|theatre|gallery/.test(text)) return "civic";
  if (/park|recreation|garden/.test(text)) return "park";
  if (/music|venue|arts|book/.test(text)) return "entertainment";
  return "food";
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
    if (!name || lat === null || lng === null) return [];
    return [{
      id: String(record.id ?? `${slug(name)}-${index}`),
      name,
      category: normalizeCategory(record.category ?? record.facility_type),
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
  url.searchParams.set("$select", "dba_name,aka_name,facility_type,address,latitude,longitude,community_area");
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
    if (!name || lat === null || lng === null) return [];
    const key = `${slug(name)}:${lat.toFixed(5)}:${lng.toFixed(5)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      id: `${key}:${index}`,
      name,
      category: normalizeCategory(row.facility_type),
      address: typeof row.address === "string" ? row.address : undefined,
      lat,
      lng,
      source: "Chicago Food Inspections",
      description: typeof row.facility_type === "string" ? row.facility_type : undefined,
    }];
  });
}

async function main() {
  const source = argValue("--source");
  const limit = Number(argValue("--limit") ?? 5000);
  const outFile = path.resolve(argValue("--out") ?? DEFAULT_CACHE_FILE);
  let places: PlaceOut[];

  if (source) {
    const file = path.resolve(source);
    if (!existsSync(file)) throw new Error(`Source file not found: ${file}`);
    places = parseLocalJson(file);
  } else {
    places = await fetchFoodInspections(Number.isFinite(limit) ? limit : 5000);
  }

  mkdirSync(path.dirname(outFile), { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(places, null, 2)}\n`);
  console.log(`Wrote ${places.length} entertainment places to ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
