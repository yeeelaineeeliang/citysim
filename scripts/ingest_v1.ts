import dotenv from "dotenv";
import { CTA_RIDERSHIP_TABLE, createSupabaseAdminClient } from "../lib/supabase";

dotenv.config({ path: ".env.local" });
dotenv.config();

const PROMPT_CTA_ENDPOINT = "https://data.cityofchicago.org/resource/t2rn-p8d7.json";
const VERIFIED_CTA_BUS_ENDPOINT = "https://data.cityofchicago.org/resource/jyb9-n7fm.json";
const HYDE_PARK_ROUTES = ["2", "6", "15", "28", "55", "171", "172", "192"];

type SocrataRidershipRow = {
  route: string;
  date: string;
  daytype: string;
  rides: string;
};

function buildQueryUrl(endpoint: string) {
  const url = new URL(endpoint);
  url.searchParams.set("$select", "route, date, daytype, rides");
  url.searchParams.set(
    "$where",
    `date between '2024-10-01T00:00:00' and '2024-10-31T23:59:59' and route in (${HYDE_PARK_ROUTES.map((route) => `'${route}'`).join(",")})`,
  );
  url.searchParams.set("$order", "date, route");
  url.searchParams.set("$limit", "5000");

  return url;
}

function hasExpectedBusColumns(rows: unknown): rows is SocrataRidershipRow[] {
  return (
    Array.isArray(rows) &&
    rows.every(
      (row) =>
        typeof row === "object" &&
        row !== null &&
        "route" in row &&
        "date" in row &&
        "daytype" in row &&
        "rides" in row,
    )
  );
}

async function requestRows(endpoint: string) {
  const response = await fetch(buildQueryUrl(endpoint), {
    headers: process.env.SOCRATA_APP_TOKEN
      ? {
          "X-App-Token": process.env.SOCRATA_APP_TOKEN,
        }
      : {},
  });

  if (!response.ok) {
    throw new Error(`CTA API request failed with status ${response.status}`);
  }

  return response.json();
}

async function fetchRidershipRows() {
  let promptEndpointRows: unknown = [];
  try {
    promptEndpointRows = await requestRows(PROMPT_CTA_ENDPOINT);
  } catch {
    promptEndpointRows = [];
  }

  const endpoint =
    hasExpectedBusColumns(promptEndpointRows) && promptEndpointRows.length > 0
      ? PROMPT_CTA_ENDPOINT
      : VERIFIED_CTA_BUS_ENDPOINT;

  const rows = endpoint === PROMPT_CTA_ENDPOINT ? promptEndpointRows : await requestRows(endpoint);
  if (!hasExpectedBusColumns(rows) || rows.length === 0) {
    throw new Error("CTA API returned zero rows for Oct 2024 Hyde Park routes.");
  }

  return {
    endpoint,
    rows: rows.map((row) => {
    const rides = Number(row.rides);
    if (!row.route || !row.date || Number.isNaN(rides)) {
      throw new Error(`Invalid CTA row: ${JSON.stringify(row)}`);
    }

    return {
      route: row.route,
      service_date: row.date.slice(0, 10),
      day_type: row.daytype,
      rides,
      community_area: 41,
      neighborhood: "Hyde Park",
      updated_at: new Date().toISOString(),
    };
    }),
  };
}

async function main() {
  const { endpoint, rows } = await fetchRidershipRows();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(CTA_RIDERSHIP_TABLE)
    .upsert(rows, { onConflict: "route,service_date" })
    .select("route");

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }

  console.log(`Fetched ${rows.length} CTA rows for Hyde Park routes from ${endpoint}.`);
  console.log(`Upserted ${data?.length ?? 0} rows into ${CTA_RIDERSHIP_TABLE}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
