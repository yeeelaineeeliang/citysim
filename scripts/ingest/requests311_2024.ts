/**
 * 311 → service_requests_311_monthly. Source: 311 Service Requests (v6vf-nfxy).
 * Counts via grouped SoQL; avg response days via SoQL date_diff_d when the
 * endpoint supports it, else client-side sampling.
 */

import { createSupabaseAdminClient } from "../../lib/supabase";
import {
  YEAR,
  YEAR_START,
  YEAR_END,
  getAreaContext,
  isCliInvocation,
  parseAreaNumber,
  socrataFetch,
  socrataFetchAll,
  upsertChunks,
} from "./shared";

const DATASET = "v6vf-nfxy";

type CountRow = { community_area?: string; month?: string; sr_type?: string; n?: string };
type AvgRow = { community_area?: string; month?: string; avg_days?: string };
type SampleRow = { community_area?: string; created_date?: string; closed_date?: string };

async function fetchCounts(where: string): Promise<CountRow[]> {
  return (await socrataFetchAll(DATASET, {
    $select: "community_area, date_extract_m(created_date) as month, sr_type, count(*) as n",
    $where: where,
    $group: "community_area, month, sr_type",
    $order: "community_area, month, sr_type",
  })) as CountRow[];
}

async function fetchAvgResponseDaysSoql(where: string): Promise<Map<string, number> | null> {
  try {
    const rows = (await socrataFetchAll(DATASET, {
      $select:
        "community_area, date_extract_m(created_date) as month, avg(date_diff_d(closed_date, created_date)) as avg_days",
      $where: `${where} and closed_date IS NOT NULL`,
      $group: "community_area, month",
      $order: "community_area, month",
    })) as AvgRow[];

    const result = new Map<string, number>();
    for (const row of rows) {
      const area = parseAreaNumber(row.community_area);
      const month = Number(row.month);
      const days = Number(row.avg_days);
      if (area === null || !Number.isInteger(month) || !Number.isFinite(days)) continue;
      result.set(`${area}:${month}`, Math.min(365, Math.max(0, days)));
    }
    return result;
  } catch (error) {
    console.warn(`311: SoQL date_diff_d unsupported (${(error as Error).message.slice(0, 120)}) — falling back to sampling`);
    return null;
  }
}

async function fetchAvgResponseDaysSampled(): Promise<Map<string, number>> {
  const sums = new Map<string, { total: number; count: number }>();

  for (let month = 1; month <= 12; month++) {
    const start = `${YEAR}-${String(month).padStart(2, "0")}-01T00:00:00`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? YEAR + 1 : YEAR;
    const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01T00:00:00`;

    const rows = (await socrataFetch(DATASET, {
      $select: "community_area, created_date, closed_date",
      $where: `created_date >= '${start}' and created_date < '${end}' and closed_date IS NOT NULL and community_area IS NOT NULL`,
      $order: "created_date",
      $limit: "20000",
    })) as SampleRow[];

    for (const row of rows) {
      const area = parseAreaNumber(row.community_area);
      if (area === null || !row.created_date || !row.closed_date) continue;
      const days = (Date.parse(row.closed_date) - Date.parse(row.created_date)) / 86_400_000;
      if (!Number.isFinite(days) || days < 0 || days > 365) continue;
      const key = `${area}:${month}`;
      const entry = sums.get(key) ?? { total: 0, count: 0 };
      entry.total += days;
      entry.count += 1;
      sums.set(key, entry);
    }
    console.log(`311: sampled month ${month} (${rows.length} closed requests)`);
  }

  const result = new Map<string, number>();
  for (const [key, { total, count }] of sums) {
    if (count > 0) result.set(key, total / count);
  }
  return result;
}

export async function run(): Promise<void> {
  console.log(`311: pulling ${YEAR} grouped counts from ${DATASET}…`);
  const baseWhere = `created_date between '${YEAR_START}' and '${YEAR_END}' and community_area IS NOT NULL`;

  // The duplicate flag exists on this dataset but tolerate its absence.
  let counts: CountRow[];
  let usedDuplicateFilter = true;
  try {
    counts = await fetchCounts(`${baseWhere} and duplicate = false`);
  } catch {
    usedDuplicateFilter = false;
    counts = await fetchCounts(baseWhere);
  }
  console.log(`311: ${counts.length} grouped rows (duplicate filter: ${usedDuplicateFilter})`);

  const byAreaMonth = new Map<string, Map<string, number>>();
  for (const row of counts) {
    const area = parseAreaNumber(row.community_area);
    const month = Number(row.month);
    const count = Number(row.n);
    const type = (row.sr_type ?? "").trim();
    if (area === null || !Number.isInteger(month) || month < 1 || month > 12) continue;
    if (!type || !Number.isFinite(count)) continue;
    const key = `${area}:${month}`;
    if (!byAreaMonth.has(key)) byAreaMonth.set(key, new Map());
    const typeMap = byAreaMonth.get(key)!;
    typeMap.set(type, (typeMap.get(type) ?? 0) + count);
  }

  const avgWhere = `created_date between '${YEAR_START}' and '${YEAR_END}' and community_area IS NOT NULL`;
  const soqlAvg = await fetchAvgResponseDaysSoql(avgWhere);
  const avgDays = soqlAvg ?? (await fetchAvgResponseDaysSampled());
  const avgSource = soqlAvg ? "" : " (response days sampled)";

  const supabase = createSupabaseAdminClient();
  const { cityId, byNumber } = await getAreaContext(supabase);

  const upserts: Record<string, unknown>[] = [];
  for (const [areaNumber, area] of byNumber) {
    for (let month = 1; month <= 12; month++) {
      const key = `${areaNumber}:${month}`;
      const typeMap = byAreaMonth.get(key) ?? new Map<string, number>();
      let total = 0;
      for (const count of typeMap.values()) total += count;

      const sorted = [...typeMap.entries()].sort((a, b) => b[1] - a[1]);
      const byType: Record<string, number> = {};
      let otherCount = 0;
      sorted.forEach(([type, count], index) => {
        if (index < 6) byType[type.toLowerCase()] = count;
        else otherCount += count;
      });
      if (otherCount > 0) byType.other = otherCount;

      const avg = avgDays.get(key);
      upserts.push({
        city_id: cityId,
        community_area_id: area.id,
        year: YEAR,
        month,
        total_requests: total,
        by_type: byType,
        avg_response_days: avg !== undefined ? Number(avg.toFixed(2)) : null,
        source: `Chicago Data Portal 311 (${DATASET})${avgSource}`,
      });
    }
  }

  const written = await upsertChunks(
    supabase,
    "service_requests_311_monthly",
    upserts,
    "city_id,community_area_id,year,month",
  );
  console.log(`311: upserted ${written} rows into service_requests_311_monthly`);
}

if (isCliInvocation(import.meta.url)) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
