/**
 * Housing → housing_metrics. Source: Affordable Rental Housing Developments (s6ha-ppgi).
 * Rent estimates come from RENT_ESTIMATES_2024 (documented heuristics) — the
 * civic dataset has no market rents; areas without an estimate get null.
 */

import { createSupabaseAdminClient } from "../../lib/supabase";
import { YEAR, getAreaContext, isCliInvocation, parseAreaNumber, socrataFetchAll, upsertChunks } from "./shared";
import { RENT_ESTIMATES_2024 } from "./rentEstimates2024";

const DATASET = "s6ha-ppgi";

type HousingRow = { community_area_number?: string; community_area?: string; units?: string };

export async function run(): Promise<void> {
  console.log(`housing: pulling developments from ${DATASET}…`);
  const rows = (await socrataFetchAll(DATASET, {
    $order: ":id",
  })) as HousingRow[];
  console.log(`housing: ${rows.length} development rows`);

  const byArea = new Map<number, { units: number; developments: number }>();
  for (const row of rows) {
    const area = parseAreaNumber(row.community_area_number ?? row.community_area);
    if (area === null) continue;
    const units = Number(row.units);
    const entry = byArea.get(area) ?? { units: 0, developments: 0 };
    entry.units += Number.isFinite(units) ? units : 0;
    entry.developments += 1;
    byArea.set(area, entry);
  }

  const supabase = createSupabaseAdminClient();
  const { cityId, byNumber } = await getAreaContext(supabase);

  const upserts: Record<string, unknown>[] = [];
  for (const [areaNumber, area] of byNumber) {
    const civic = byArea.get(areaNumber) ?? { units: 0, developments: 0 };
    const estimate = RENT_ESTIMATES_2024[areaNumber] ?? null;
    upserts.push({
      city_id: cityId,
      community_area_id: area.id,
      year: YEAR,
      affordable_units: Math.round(civic.units),
      affordable_developments: civic.developments,
      avg_rent_estimate: estimate?.avg ?? null,
      median_rent_estimate: estimate?.median ?? null,
      source: `Affordable Rental Housing Developments (${DATASET}); rent = market estimate where available`,
    });
  }

  const written = await upsertChunks(supabase, "housing_metrics", upserts, "city_id,community_area_id,year");
  console.log(`housing: upserted ${written} rows into housing_metrics (${Object.keys(RENT_ESTIMATES_2024).length} with rent estimates)`);
}

if (isCliInvocation(import.meta.url)) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
