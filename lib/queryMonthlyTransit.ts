import * as fs from "node:fs";
import * as path from "node:path";

const CTA_PRIMARY = "https://data.cityofchicago.org/resource/jyb9-n7fm.json";
const CTA_FALLBACK = "https://data.cityofchicago.org/resource/t2rn-p8d7.json";
const LOCAL_FILE = path.join(process.cwd(), "CityData", "filtered", "cta_route6_2024.json");

export type MonthlyTransitData = {
  monthNumber: number;
  totalWeekdayRides: number;
  avgDailyWeekdayRides: number;
  serviceDays: number;
  peakDayRides: number;
  crowdingSignal: -1 | 0 | 1;
};

// ── Normalised row ────────────────────────────────────────────────────────────

type NormRow = { date: string; rides: number };

// ── Local file ────────────────────────────────────────────────────────────────

function loadLocal(): NormRow[] | null {
  try {
    if (!fs.existsSync(LOCAL_FILE)) return null;
    return JSON.parse(fs.readFileSync(LOCAL_FILE, "utf-8")) as NormRow[];
  } catch {
    return null;
  }
}

// ── Socrata fetch ─────────────────────────────────────────────────────────────

type SocrataRow = { route: string; service_date: string; day_type: string; rides: string };

function isSocrataRow(row: unknown): row is SocrataRow {
  if (!row || typeof row !== "object") return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.route === "string" &&
    typeof r.service_date === "string" &&
    typeof r.day_type === "string" &&
    typeof r.rides === "string"
  );
}

async function fetchSocrata(endpoint: string): Promise<NormRow[]> {
  const params = new URLSearchParams({
    $where: "route='6' AND service_date between '2024-01-01T00:00:00' AND '2024-12-31T23:59:59' AND day_type='W'",
    $limit: "5000",
    $order: "service_date ASC",
  });
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.SOCRATA_APP_TOKEN) headers["X-App-Token"] = process.env.SOCRATA_APP_TOKEN;

  const res = await fetch(`${endpoint}?${params.toString()}`, { headers, next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`CTA API responded ${res.status}`);

  const json = (await res.json()) as unknown[];
  return json.filter(isSocrataRow).map((r) => ({
    date: r.service_date.slice(0, 10),
    rides: Number.parseInt(r.rides, 10),
  }));
}

// ── Aggregation ───────────────────────────────────────────────────────────────

function deriveCrowdingSignal(avg: number, annualAvg: number): -1 | 0 | 1 {
  if (avg > annualAvg * 1.15) return -1;
  if (avg < annualAvg * 0.85) return 1;
  return 0;
}

function buildMonths(rows: NormRow[]): MonthlyTransitData[] {
  const byMonth = new Map<number, number[]>();
  for (let m = 1; m <= 12; m++) byMonth.set(m, []);

  for (const row of rows) {
    const month = new Date(`${row.date}T00:00:00Z`).getUTCMonth() + 1;
    if (month >= 1 && month <= 12 && !Number.isNaN(row.rides)) byMonth.get(month)!.push(row.rides);
  }

  const raw = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const rides = byMonth.get(m)!;
    const totalWeekdayRides = rides.reduce((s, r) => s + r, 0);
    const serviceDays = rides.length;
    const avgDailyWeekdayRides = serviceDays > 0 ? Math.round(totalWeekdayRides / serviceDays) : 0;
    const peakDayRides = rides.length > 0 ? Math.max(...rides) : 0;
    return { monthNumber: m, totalWeekdayRides, avgDailyWeekdayRides, serviceDays, peakDayRides };
  });

  const annualAvg = raw.reduce((s, m) => s + m.avgDailyWeekdayRides, 0) / 12;

  return raw.map((m) => ({ ...m, crowdingSignal: deriveCrowdingSignal(m.avgDailyWeekdayRides, annualAvg) }));
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function queryMonthlyTransit(): Promise<MonthlyTransitData[]> {
  const local = loadLocal();
  if (local) return buildMonths(local);

  try {
    return buildMonths(await fetchSocrata(CTA_PRIMARY));
  } catch {
    try {
      return buildMonths(await fetchSocrata(CTA_FALLBACK));
    } catch {
      return buildMonths([]); // No data available — return zero-filled months
    }
  }
}
