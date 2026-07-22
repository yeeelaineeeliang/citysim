/**
 * Verifies the civic ingestion: row counts per table, areas missing rows,
 * and a Hyde Park spot-check to eyeball against known magnitudes.
 */

import dotenv from "dotenv";
import { createSupabaseAdminClient } from "../lib/supabase";

dotenv.config({ path: ".env.local" });
dotenv.config();

const YEAR = 2024;
const MONTHLY_TABLES = ["crime_monthly", "transit_monthly", "service_requests_311_monthly"] as const;
const YEARLY_TABLES = ["housing_metrics", "entertainment_metrics"] as const;

async function main() {
  const supabase = createSupabaseAdminClient();

  const { data: areas } = await supabase.from("community_areas").select("id, name, community_area_number");
  const areaCount = areas?.length ?? 0;
  console.log(`community_areas: ${areaCount} rows`);

  let failed = false;

  for (const table of MONTHLY_TABLES) {
    const { count } = await supabase.from(table).select("*", { count: "exact", head: true }).eq("year", YEAR);
    const expected = areaCount * 12;
    const ok = (count ?? 0) >= expected;
    if (!ok) failed = true;
    console.log(`${ok ? "✓" : "✗"} ${table}: ${count ?? 0} rows (expected ≥ ${expected})`);
  }

  for (const table of YEARLY_TABLES) {
    const { count } = await supabase.from(table).select("*", { count: "exact", head: true }).eq("year", YEAR);
    const ok = (count ?? 0) >= areaCount;
    if (!ok) failed = true;
    console.log(`${ok ? "✓" : "✗"} ${table}: ${count ?? 0} rows (expected ≥ ${areaCount})`);
  }

  // Hyde Park spot-check
  const hydePark = areas?.find((a) => (a.name as string).toLowerCase() === "hyde park");
  if (hydePark) {
    const [crime, svc, transit, housing, ent] = await Promise.all([
      supabase.from("crime_monthly").select("incident_count, violent_count, trend_label").eq("community_area_id", hydePark.id).eq("year", YEAR).eq("month", 1).maybeSingle(),
      supabase.from("service_requests_311_monthly").select("total_requests, avg_response_days").eq("community_area_id", hydePark.id).eq("year", YEAR).eq("month", 10).maybeSingle(),
      supabase.from("transit_monthly").select("l_ridership, crowding_level").eq("community_area_id", hydePark.id).eq("year", YEAR).eq("month", 10).maybeSingle(),
      supabase.from("housing_metrics").select("affordable_units, avg_rent_estimate").eq("community_area_id", hydePark.id).eq("year", YEAR).maybeSingle(),
      supabase.from("entertainment_metrics").select("restaurants, bars, farmers_markets").eq("community_area_id", hydePark.id).eq("year", YEAR).maybeSingle(),
    ]);
    console.log("\nHyde Park spot-check:");
    console.log("  crime Jan:", crime.data ?? "MISSING");
    console.log("  311 Oct:", svc.data ?? "MISSING");
    console.log("  transit Oct:", transit.data ?? "MISSING");
    console.log("  housing:", housing.data ?? "MISSING");
    console.log("  entertainment:", ent.data ?? "MISSING");
  }

  if (failed) {
    console.error("\nVerification FAILED — some tables are under-populated.");
    process.exit(1);
  }
  console.log("\nVerification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
