/**
 * Umbrella civic ingestion: runs all five dataset scripts sequentially.
 * Each dataset is independently resumable (npm run ingest:<name>); upserts are
 * idempotent, so re-running after a failure is safe.
 */

import { run as runCrime } from "./ingest/crime_2024";
import { run as run311 } from "./ingest/requests311_2024";
import { run as runTransit } from "./ingest/transit_2024";
import { run as runHousing } from "./ingest/housing_2024";
import { run as runEntertainment } from "./ingest/entertainment_2024";

const DATASETS: Array<[string, () => Promise<void>]> = [
  ["crime", runCrime],
  ["311", run311],
  ["transit", runTransit],
  ["housing", runHousing],
  ["entertainment", runEntertainment],
];

async function main() {
  const results: Array<{ name: string; ok: boolean; ms: number; error?: string }> = [];

  for (const [name, run] of DATASETS) {
    const start = Date.now();
    try {
      await run();
      results.push({ name, ok: true, ms: Date.now() - start });
    } catch (error) {
      results.push({ name, ok: false, ms: Date.now() - start, error: (error as Error).message });
      console.error(`${name}: FAILED — ${(error as Error).message}`);
    }
  }

  console.log("\n── Ingestion summary ──");
  for (const result of results) {
    console.log(
      `${result.ok ? "✓" : "✗"} ${result.name.padEnd(14)} ${(result.ms / 1000).toFixed(1)}s${result.error ? ` — ${result.error.slice(0, 120)}` : ""}`,
    );
  }

  if (results.some((r) => !r.ok)) {
    console.error("\nSome datasets failed — re-run the failing ones with npm run ingest:<name>");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
