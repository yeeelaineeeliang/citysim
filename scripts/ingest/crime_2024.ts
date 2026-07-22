/**
 * Crime → crime_monthly. Source: Crimes 2001–present (ijzp-q8t2).
 * One grouped SoQL pull for the full year: (community_area, month, primary_type, count).
 */

import { createSupabaseAdminClient } from "../../lib/supabase";
import {
  YEAR,
  YEAR_START,
  YEAR_END,
  getAreaContext,
  isCliInvocation,
  parseAreaNumber,
  socrataFetchAll,
  upsertChunks,
} from "./shared";

const DATASET = "ijzp-q8t2";

// FBI-style classification of Chicago primary_type values. Types in neither
// set (narcotics, weapons, deceptive practice, …) count toward the total only.
const VIOLENT_TYPES = new Set([
  "HOMICIDE",
  "CRIMINAL SEXUAL ASSAULT",
  "CRIM SEXUAL ASSAULT",
  "ROBBERY",
  "BATTERY",
  "ASSAULT",
  "KIDNAPPING",
  "INTIMIDATION",
]);
const PROPERTY_TYPES = new Set([
  "THEFT",
  "BURGLARY",
  "MOTOR VEHICLE THEFT",
  "ARSON",
  "CRIMINAL DAMAGE",
  "CRIMINAL TRESPASS",
]);

type GroupedRow = { community_area?: string; month?: string; primary_type?: string; n?: string };

function trendLabel(current: number, previous: number | null): string {
  if (previous === null) return "start of year";
  if (previous === 0) return current > 0 ? "up from previous month" : "steady";
  const change = (current - previous) / previous;
  if (change > 0.08) return "up from previous month";
  if (change < -0.08) return "down from previous month";
  return "steady";
}

export async function run(): Promise<void> {
  console.log(`crime: pulling ${YEAR} grouped counts from ${DATASET}…`);
  const rows = (await socrataFetchAll(DATASET, {
    $select: "community_area, date_extract_m(date) as month, primary_type, count(*) as n",
    $where: `date between '${YEAR_START}' and '${YEAR_END}' and community_area IS NOT NULL`,
    $group: "community_area, month, primary_type",
    $order: "community_area, month, primary_type",
  })) as GroupedRow[];
  console.log(`crime: ${rows.length} grouped rows`);

  // (area, month) → per-type counts
  const byAreaMonth = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const area = parseAreaNumber(row.community_area);
    const month = Number(row.month);
    const count = Number(row.n);
    const type = (row.primary_type ?? "").trim();
    if (area === null || !Number.isInteger(month) || month < 1 || month > 12) continue;
    if (!type || !Number.isFinite(count)) continue;
    const key = `${area}:${month}`;
    if (!byAreaMonth.has(key)) byAreaMonth.set(key, new Map());
    const typeMap = byAreaMonth.get(key)!;
    typeMap.set(type, (typeMap.get(type) ?? 0) + count);
  }

  const supabase = createSupabaseAdminClient();
  const { cityId, byNumber } = await getAreaContext(supabase);

  const upserts: Record<string, unknown>[] = [];
  for (const [areaNumber, area] of byNumber) {
    let previousTotal: number | null = null;
    for (let month = 1; month <= 12; month++) {
      const typeMap = byAreaMonth.get(`${areaNumber}:${month}`) ?? new Map<string, number>();
      let total = 0;
      let violent = 0;
      let property = 0;
      for (const [type, count] of typeMap) {
        total += count;
        if (VIOLENT_TYPES.has(type)) violent += count;
        if (PROPERTY_TYPES.has(type)) property += count;
      }

      // Top 5 types lowercased + "other" — matches the stub shape the tools read.
      const sorted = [...typeMap.entries()].sort((a, b) => b[1] - a[1]);
      const byType: Record<string, number> = {};
      let otherCount = 0;
      sorted.forEach(([type, count], index) => {
        if (index < 5) byType[type.toLowerCase()] = count;
        else otherCount += count;
      });
      if (otherCount > 0) byType.other = otherCount;

      upserts.push({
        city_id: cityId,
        community_area_id: area.id,
        year: YEAR,
        month,
        incident_count: total,
        by_type: byType,
        violent_count: violent,
        property_count: property,
        trend_label: trendLabel(total, previousTotal),
        source: `Chicago Data Portal Crimes (${DATASET})`,
      });
      previousTotal = total;
    }
  }

  const written = await upsertChunks(supabase, "crime_monthly", upserts, "city_id,community_area_id,year,month");
  console.log(`crime: upserted ${written} rows into crime_monthly`);
}

if (isCliInvocation(import.meta.url)) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
