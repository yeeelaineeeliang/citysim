/**
 * Shared helpers for the civic-data ingestion scripts.
 * All scripts: Socrata (Chicago Data Portal) → aggregate → upsert to Supabase.
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY; SOCRATA_APP_TOKEN optional
 * (raises the rate limits considerably — set it for full-year pulls).
 */

import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createSupabaseAdminClient } from "../../lib/supabase";
import { NEIGHBORHOOD_COORDINATES } from "../../lib/neighborhoodCoordinates";

dotenv.config({ path: ".env.local" });
dotenv.config();

export const YEAR = 2024;
export const YEAR_START = `${YEAR}-01-01T00:00:00`;
export const YEAR_END = `${YEAR}-12-31T23:59:59`;

const SOCRATA_BASE = "https://data.cityofchicago.org/resource";
const MAX_RETRIES = 4;

export type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

function socrataHeaders(): Record<string, string> {
  const token = process.env.SOCRATA_APP_TOKEN;
  return token ? { "X-App-Token": token } : {};
}

export async function socrataFetch(datasetId: string, params: Record<string, string>): Promise<unknown[]> {
  const url = new URL(`${SOCRATA_BASE}/${datasetId}.json`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, { headers: socrataHeaders() });
    if (response.ok) {
      return (await response.json()) as unknown[];
    }
    if (response.status === 429 || response.status >= 500) {
      const backoff = 1000 * 2 ** attempt;
      console.warn(`  socrata ${datasetId}: HTTP ${response.status}, retrying in ${backoff}ms`);
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }
    const body = await response.text().catch(() => "");
    throw new Error(`Socrata ${datasetId} failed: HTTP ${response.status} ${body.slice(0, 300)}`);
  }
  throw new Error(`Socrata ${datasetId} failed after ${MAX_RETRIES} retries`);
}

/** Page through a query with $limit/$offset. `params` must include a stable $order for paging to be correct. */
export async function socrataFetchAll(
  datasetId: string,
  params: Record<string, string>,
  pageSize = 50_000,
  maxRows = 2_000_000,
): Promise<unknown[]> {
  if (!params.$order) throw new Error("socrataFetchAll requires a stable $order param");
  const all: unknown[] = [];
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const page = await socrataFetch(datasetId, {
      ...params,
      $limit: String(pageSize),
      $offset: String(offset),
    });
    all.push(...page);
    if (page.length < pageSize) break;
  }
  return all;
}

export interface AreaContext {
  cityId: string;
  byNumber: Map<number, { id: string; name: string; slug: string }>;
}

export async function getAreaContext(supabase: SupabaseAdmin): Promise<AreaContext> {
  const { data: city, error: cityError } = await supabase
    .from("cities")
    .select("id")
    .eq("slug", "chicago")
    .single();
  if (cityError || !city) throw new Error("Chicago city row missing — run supabase/schema.sql first");

  const { data: areas, error: areasError } = await supabase
    .from("community_areas")
    .select("id, community_area_number, name, slug")
    .eq("city_id", city.id);
  if (areasError || !areas?.length) throw new Error("community_areas rows missing");

  const byNumber = new Map<number, { id: string; name: string; slug: string }>();
  for (const area of areas as Array<{ id: string; community_area_number: number; name: string; slug: string }>) {
    byNumber.set(area.community_area_number, { id: area.id, name: area.name, slug: area.slug });
  }
  return { cityId: city.id, byNumber };
}

// ─── Point-in-polygon over the 77 static community-area boundaries ────────────

// Same normalizer as lib/communityAreaStaticBoundaries.ts (copied — scripts use
// relative imports and the lib pulls in "@/"-aliased JSON).
function normalizeCommunityName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

type Ring = [number, number][]; // GeoJSON positions: [lng, lat]

export interface AreaPolygon {
  communityAreaNumber: number;
  rings: Ring[]; // outer ring + holes
}

export function loadBoundaries(): AreaPolygon[] {
  const raw = readFileSync(path.join(process.cwd(), "data", "chicago-community-areas.json"), "utf8");
  const collection = JSON.parse(raw) as {
    features: Array<{ properties?: { community?: string }; geometry?: { type: string; coordinates: unknown } }>;
  };

  const numberByName = new Map(
    NEIGHBORHOOD_COORDINATES.map((area) => [normalizeCommunityName(area.name), area.communityAreaNumber]),
  );

  const polygons: AreaPolygon[] = [];
  for (const feature of collection.features) {
    const name = feature.properties?.community;
    const geometry = feature.geometry;
    if (!name || !geometry) continue;
    const communityAreaNumber = numberByName.get(normalizeCommunityName(name));
    if (communityAreaNumber === undefined) continue;

    if (geometry.type === "Polygon") {
      polygons.push({ communityAreaNumber, rings: geometry.coordinates as Ring[] });
    } else if (geometry.type === "MultiPolygon") {
      for (const poly of geometry.coordinates as Ring[][]) {
        polygons.push({ communityAreaNumber, rings: poly });
      }
    }
  }
  return polygons;
}

function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function findAreaForPoint(lat: number, lng: number, polygons: AreaPolygon[]): number | null {
  for (const polygon of polygons) {
    const [outer, ...holes] = polygon.rings;
    if (!outer || !pointInRing(lng, lat, outer)) continue;
    if (holes.some((hole) => pointInRing(lng, lat, hole))) continue;
    return polygon.communityAreaNumber;
  }
  return null;
}

// ─── Upserts ──────────────────────────────────────────────────────────────────

export async function upsertChunks(
  supabase: SupabaseAdmin,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  chunkSize = 500,
): Promise<number> {
  let written = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`upsert into ${table} failed: ${error.message}`);
    written += chunk.length;
  }
  return written;
}

export function parseAreaNumber(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 77) return null;
  return n;
}

export function isCliInvocation(moduleUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return moduleUrl.endsWith(path.basename(entry));
}
