import dotenv from "dotenv";
import { CTA_RIDERSHIP_TABLE, createSupabaseAdminClient } from "../lib/supabase";
import { querySimulationData } from "../lib/querySimulationData";

dotenv.config({ path: ".env.local" });
dotenv.config();

async function main() {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from(CTA_RIDERSHIP_TABLE)
    .select("route", { count: "exact", head: true });

  if (error) {
    throw new Error(`Supabase count failed: ${error.message}`);
  }

  const structuredData = await querySimulationData();

  console.log(`Supabase rows: ${count ?? 0}`);
  console.log(`October total rides: ${structuredData.totalRidesAcrossRoutes}`);
  console.log(`Highlighted route: ${structuredData.highlightedRoute.route}`);
  console.log(`Peak day: ${structuredData.peakRidershipDay.date}`);
  console.log(`Week-over-week delta: ${structuredData.weekOverWeekDelta.absoluteChange}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
