/**
 * Transit → transit_monthly. Sources:
 *   - L stops (8pix-ypme): station coordinates → community area via point-in-polygon
 *   - L station entries daily totals (5neh-572f): monthly ridership sums per station
 *
 * bus_ridership stays 0 for every area: the citywide bus dataset (jyb9-n7fm) is
 * route-level with no geography, so attributing bus rides to community areas
 * would be fabrication. The route_summary note carries that caveat into the LLM.
 */

import { createSupabaseAdminClient } from "../../lib/supabase";
import {
  YEAR,
  YEAR_START,
  YEAR_END,
  findAreaForPoint,
  getAreaContext,
  isCliInvocation,
  loadBoundaries,
  socrataFetchAll,
  upsertChunks,
} from "./shared";

const STOPS_DATASET = "8pix-ypme";
const ENTRIES_DATASET = "5neh-572f";

type StopRow = {
  map_id?: string;
  station_name?: string;
  station_descriptive_name?: string;
  red?: boolean | string;
  blue?: boolean | string;
  g?: boolean | string;
  brn?: boolean | string;
  p?: boolean | string;
  pexp?: boolean | string;
  y?: boolean | string;
  pnk?: boolean | string;
  o?: boolean | string;
  location?: { latitude?: string; longitude?: string };
};

type EntriesRow = { station_id?: string; stationname?: string; month?: string; rides?: string };

const LINE_FLAGS: Array<[keyof StopRow, string]> = [
  ["red", "Red"],
  ["blue", "Blue"],
  ["g", "Green"],
  ["brn", "Brown"],
  ["p", "Purple"],
  ["pexp", "Purple Express"],
  ["y", "Yellow"],
  ["pnk", "Pink"],
  ["o", "Orange"],
];

function isTrue(value: boolean | string | undefined): boolean {
  return value === true || value === "true" || value === "True";
}

function crowdingFromQuartile(value: number, sortedValues: number[]): string {
  if (sortedValues.length === 0 || value <= 0) return "low";
  const rank = sortedValues.filter((v) => v <= value).length / sortedValues.length;
  if (rank <= 0.25) return "low";
  if (rank <= 0.5) return "moderate";
  if (rank <= 0.8) return "high";
  return "very_high";
}

const BUS_NOTE =
  "Citywide CTA bus ridership (jyb9-n7fm) is route-level with no geography; bus totals are not attributed to community areas.";

export async function run(): Promise<void> {
  console.log(`transit: pulling L stops from ${STOPS_DATASET}…`);
  const stopRows = (await socrataFetchAll(STOPS_DATASET, {
    $order: "stop_id",
  })) as StopRow[];

  const boundaries = loadBoundaries();

  // Dedupe to one row per station (map_id); collect lines + locate in an area.
  const stations = new Map<string, { name: string; lines: Set<string>; area: number | null }>();
  for (const row of stopRows) {
    const mapId = row.map_id;
    if (!mapId) continue;
    const lat = Number(row.location?.latitude);
    const lng = Number(row.location?.longitude);
    const existing = stations.get(mapId);
    const lines = existing?.lines ?? new Set<string>();
    for (const [flag, label] of LINE_FLAGS) {
      if (isTrue(row[flag] as boolean | string | undefined)) lines.add(label);
    }
    const area =
      existing?.area ??
      (Number.isFinite(lat) && Number.isFinite(lng) ? findAreaForPoint(lat, lng, boundaries) : null);
    stations.set(mapId, {
      name: existing?.name ?? row.station_name ?? row.station_descriptive_name ?? `Station ${mapId}`,
      lines,
      area,
    });
  }
  const located = [...stations.values()].filter((s) => s.area !== null).length;
  console.log(`transit: ${stations.size} stations, ${located} located in a community area`);

  console.log(`transit: pulling ${YEAR} monthly station entries from ${ENTRIES_DATASET}…`);
  const entryRows = (await socrataFetchAll(ENTRIES_DATASET, {
    $select: "station_id, stationname, date_extract_m(date) as month, sum(rides) as rides",
    $where: `date between '${YEAR_START}' and '${YEAR_END}'`,
    $group: "station_id, stationname, month",
    $order: "station_id, month",
  })) as EntriesRow[];
  console.log(`transit: ${entryRows.length} station-month rows`);

  // (area, month) → { rides, stations involved }
  const areaMonth = new Map<string, { rides: number; stations: Map<string, Set<string>> }>();
  for (const row of entryRows) {
    const station = row.station_id ? stations.get(row.station_id) : undefined;
    if (!station || station.area === null) continue;
    const month = Number(row.month);
    const rides = Number(row.rides);
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isFinite(rides)) continue;
    const key = `${station.area}:${month}`;
    if (!areaMonth.has(key)) areaMonth.set(key, { rides: 0, stations: new Map() });
    const entry = areaMonth.get(key)!;
    entry.rides += rides;
    entry.stations.set(station.name, station.lines);
  }

  const supabase = createSupabaseAdminClient();
  const { cityId, byNumber } = await getAreaContext(supabase);

  const upserts: Record<string, unknown>[] = [];
  for (let month = 1; month <= 12; month++) {
    // Quartiles computed across areas *with* stations for this month.
    const monthValues = [...byNumber.keys()]
      .map((areaNumber) => areaMonth.get(`${areaNumber}:${month}`)?.rides ?? 0)
      .filter((v) => v > 0)
      .sort((a, b) => a - b);

    for (const [areaNumber, area] of byNumber) {
      const entry = areaMonth.get(`${areaNumber}:${month}`);
      const lRidership = Math.round(entry?.rides ?? 0);
      const stopSummary = entry
        ? [...entry.stations.entries()].map(([name, lines]) => ({ name, lines: [...lines].sort() }))
        : [];
      const lLines = entry
        ? [...new Set([...entry.stations.values()].flatMap((lines) => [...lines]))].sort()
        : [];

      upserts.push({
        city_id: cityId,
        community_area_id: area.id,
        year: YEAR,
        month,
        bus_ridership: 0,
        l_ridership: lRidership,
        metra_ridership: 0,
        crowding_level: crowdingFromQuartile(lRidership, monthValues),
        route_summary: {
          l_lines: lLines,
          bus_note: BUS_NOTE,
          crowding_basis: "quartile of monthly L station entries across areas with stations",
        },
        stop_summary: stopSummary,
        source: `CTA L station entries (${ENTRIES_DATASET}) + L stops (${STOPS_DATASET})`,
      });
    }
  }

  const written = await upsertChunks(supabase, "transit_monthly", upserts, "city_id,community_area_id,year,month");
  console.log(`transit: upserted ${written} rows into transit_monthly`);
}

if (isCliInvocation(import.meta.url)) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
