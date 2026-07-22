/**
 * Entertainment → entertainment_metrics. Sources:
 *   - Business Licenses, current active (uupf-x98q): restaurants + bars
 *   - CPD Parks (ejsh-fztr): park names per area
 *   - Libraries (x8fc-8rcq): branch names per area
 *   - Farmers markets: dataset id churns yearly — static area list fallback
 *
 * Licenses/parks/libraries are located via lat/lng point-in-polygon against the
 * 77 static community-area boundaries.
 */

import { createSupabaseAdminClient } from "../../lib/supabase";
import {
  YEAR,
  findAreaForPoint,
  getAreaContext,
  isCliInvocation,
  loadBoundaries,
  socrataFetchAll,
  upsertChunks,
  type AreaPolygon,
} from "./shared";

const LICENSES_DATASET = "uupf-x98q";
const PARKS_DATASET = "ejsh-fztr";
const LIBRARIES_DATASET = "x8fc-8rcq";
// Chicago's farmers-market dataset id changes yearly; update when known.
const FARMERS_MARKET_DATASET_ID: string | null = null;

// Fallback: areas with a recurring farmers market (documented manual list).
const FARMERS_MARKET_AREAS = new Set([
  6,  // Lake View
  7,  // Lincoln Park
  22, // Logan Square
  24, // West Town (Wicker Park)
  28, // Near West Side
  32, // Loop
  33, // Near South Side
  41, // Hyde Park
  77, // Edgewater
]);

const RESTAURANT_LICENSE = "Retail Food Establishment";
// "Bars" = on-premises consumption licenses. Package Goods (liquor stores) excluded.
const BAR_LICENSES = new Set(["Tavern", "Consumption on Premises - Incidental Activity", "Late Hour"]);

type LicenseRow = {
  license_description?: string;
  doing_business_as_name?: string;
  address?: string;
  latitude?: string;
  longitude?: string;
};
type ParkRow = {
  park?: string;
  label?: string;
  acres?: string;
  the_geom?: { type?: string; coordinates?: unknown };
};
type LibraryRow = { name_?: string; name?: string; location?: { latitude?: string; longitude?: string } };
type MarketRow = { latitude?: string; longitude?: string; location?: { latitude?: string; longitude?: string } };

function locate(latRaw: unknown, lngRaw: unknown, boundaries: AreaPolygon[]): number | null {
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return findAreaForPoint(lat, lng, boundaries);
}

/** Average of the first ring's vertices — good enough to place a park in its area. */
function geomCentroid(geom: ParkRow["the_geom"]): { lat: number; lng: number } | null {
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

export async function run(): Promise<void> {
  const boundaries = loadBoundaries();

  // ── Licenses ────────────────────────────────────────────────────────────────
  console.log(`entertainment: pulling active food/tavern licenses from ${LICENSES_DATASET}…`);
  const descriptions = [RESTAURANT_LICENSE, ...BAR_LICENSES].map((d) => `'${d.replace(/'/g, "''")}'`).join(",");
  const licenseRows = (await socrataFetchAll(LICENSES_DATASET, {
    $select: "license_description, doing_business_as_name, address, latitude, longitude",
    $where: `license_description in (${descriptions})`,
    $order: ":id",
  })) as LicenseRow[];
  console.log(`entertainment: ${licenseRows.length} license rows`);

  const restaurants = new Map<number, Set<string>>();
  const bars = new Map<number, Set<string>>();
  for (const row of licenseRows) {
    const area = locate(row.latitude, row.longitude, boundaries);
    if (area === null) continue;
    // Dedupe multi-license venues by name+address.
    const venueKey = `${(row.doing_business_as_name ?? "").toLowerCase()}|${(row.address ?? "").toLowerCase()}`;
    if (row.license_description === RESTAURANT_LICENSE) {
      if (!restaurants.has(area)) restaurants.set(area, new Set());
      restaurants.get(area)!.add(venueKey);
    } else if (row.license_description && BAR_LICENSES.has(row.license_description)) {
      if (!bars.has(area)) bars.set(area, new Set());
      bars.get(area)!.add(venueKey);
    }
  }

  // ── Parks ───────────────────────────────────────────────────────────────────
  // Park rows carry MultiPolygon geometry (the_geom), not point coordinates —
  // locate each park by the average of its first ring's vertices, largest first
  // so the 10-per-area cap keeps the parks people actually name.
  console.log(`entertainment: pulling parks from ${PARKS_DATASET}…`);
  const parksByArea = new Map<number, string[]>();
  try {
    const parkRows = (await socrataFetchAll(PARKS_DATASET, { $order: ":id" })) as ParkRow[];
    const sortedParks = [...parkRows].sort((a, b) => Number(b.acres ?? 0) - Number(a.acres ?? 0));
    for (const row of sortedParks) {
      const name = (row.label ?? row.park ?? "").trim();
      if (!name) continue;
      const centroid = geomCentroid(row.the_geom);
      if (!centroid) continue;
      const area = findAreaForPoint(centroid.lat, centroid.lng, boundaries);
      if (area === null) continue;
      if (!parksByArea.has(area)) parksByArea.set(area, []);
      const list = parksByArea.get(area)!;
      if (list.length < 10 && !list.includes(name)) list.push(name);
    }
  } catch (error) {
    console.warn(`entertainment: parks pull failed (${(error as Error).message.slice(0, 120)}) — leaving parks empty`);
  }

  // ── Libraries ───────────────────────────────────────────────────────────────
  console.log(`entertainment: pulling libraries from ${LIBRARIES_DATASET}…`);
  const librariesByArea = new Map<number, string[]>();
  try {
    const libraryRows = (await socrataFetchAll(LIBRARIES_DATASET, { $order: ":id" })) as LibraryRow[];
    for (const row of libraryRows) {
      const name = (row.name_ ?? row.name ?? "").trim();
      if (!name) continue;
      const area = locate(row.location?.latitude, row.location?.longitude, boundaries);
      if (area === null) continue;
      if (!librariesByArea.has(area)) librariesByArea.set(area, []);
      const list = librariesByArea.get(area)!;
      if (!list.includes(name)) list.push(name);
    }
  } catch (error) {
    console.warn(`entertainment: libraries pull failed (${(error as Error).message.slice(0, 120)}) — leaving libraries empty`);
  }

  // ── Farmers markets ─────────────────────────────────────────────────────────
  const marketAreas = new Set(FARMERS_MARKET_AREAS);
  if (FARMERS_MARKET_DATASET_ID) {
    try {
      const marketRows = (await socrataFetchAll(FARMERS_MARKET_DATASET_ID, { $order: ":id" })) as MarketRow[];
      marketAreas.clear();
      for (const row of marketRows) {
        const area =
          locate(row.latitude, row.longitude, boundaries) ??
          locate(row.location?.latitude, row.location?.longitude, boundaries);
        if (area !== null) marketAreas.add(area);
      }
    } catch {
      console.warn("entertainment: farmers-market dataset unavailable — using static area list");
    }
  }

  // ── Write ───────────────────────────────────────────────────────────────────
  const supabase = createSupabaseAdminClient();
  const { cityId, byNumber } = await getAreaContext(supabase);

  const upserts: Record<string, unknown>[] = [];
  for (const [areaNumber, area] of byNumber) {
    upserts.push({
      city_id: cityId,
      community_area_id: area.id,
      year: YEAR,
      restaurants: restaurants.get(areaNumber)?.size ?? 0,
      bars: bars.get(areaNumber)?.size ?? 0,
      parks: parksByArea.get(areaNumber) ?? [],
      libraries: librariesByArea.get(areaNumber) ?? [],
      farmers_markets: marketAreas.has(areaNumber),
      source: `Business Licenses (${LICENSES_DATASET}) + CPD Parks (${PARKS_DATASET}) + Libraries (${LIBRARIES_DATASET})`,
    });
  }

  const written = await upsertChunks(supabase, "entertainment_metrics", upserts, "city_id,community_area_id,year");
  console.log(`entertainment: upserted ${written} rows into entertainment_metrics`);
}

if (isCliInvocation(import.meta.url)) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
