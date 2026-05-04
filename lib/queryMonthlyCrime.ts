import * as fs from "node:fs";
import * as path from "node:path";

const CRIME_ENDPOINT = "https://data.cityofchicago.org/resource/ijzp-q8t2.json";
const LOCAL_FILE = path.join(process.cwd(), "CityData", "filtered", "crime_hyde_park_2024.json");

export type MonthlyCrimeData = {
  monthNumber: number;
  incidentCount: number;
  topType: string | null;
  crimeSignal: 2 | 0 | -2;
};

// ── Normalised row ────────────────────────────────────────────────────────────

type NormRow = { date: string; primaryType: string };

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

type SocrataRow = { primary_type?: string; date?: string; community_area?: string };

function isSocrataRow(row: unknown): row is SocrataRow {
  return !!row && typeof row === "object" && typeof (row as Record<string, unknown>).date === "string";
}

async function fetchSocrata(): Promise<NormRow[]> {
  const params = new URLSearchParams({
    $where: "community_area=41 AND date between '2024-01-01T00:00:00' AND '2024-12-31T23:59:59'",
    $limit: "10000",
    $order: "date ASC",
  });
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.SOCRATA_APP_TOKEN) headers["X-App-Token"] = process.env.SOCRATA_APP_TOKEN;

  const res = await fetch(`${CRIME_ENDPOINT}?${params.toString()}`, { headers, next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`Crime API responded ${res.status}`);

  const json = (await res.json()) as unknown[];
  return json.filter(isSocrataRow).map((r) => ({
    date: r.date!.slice(0, 10),
    primaryType: r.primary_type ?? "UNKNOWN",
  }));
}

// ── Aggregation ───────────────────────────────────────────────────────────────

function deriveCrimeSignal(count: number, annualAvg: number): 2 | 0 | -2 {
  if (annualAvg === 0) return 0;
  if (count < annualAvg * 0.85) return 2;
  if (count > annualAvg * 1.15) return -2;
  return 0;
}

function buildMonths(rows: NormRow[]): MonthlyCrimeData[] {
  type MonthAccum = { count: number; types: string[] };
  const byMonth = new Map<number, MonthAccum>();
  for (let m = 1; m <= 12; m++) byMonth.set(m, { count: 0, types: [] });

  for (const row of rows) {
    const month = new Date(`${row.date}T00:00:00Z`).getUTCMonth() + 1;
    if (month < 1 || month > 12) continue;
    const acc = byMonth.get(month)!;
    acc.count += 1;
    if (row.primaryType) acc.types.push(row.primaryType);
  }

  const annualAvg = [...byMonth.values()].reduce((s, a) => s + a.count, 0) / 12;

  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const acc = byMonth.get(m)!;

    const typeCounts = new Map<string, number>();
    for (const t of acc.types) typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
    const topEntry = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const topType = topEntry?.[0] ?? null;

    return { monthNumber: m, incidentCount: acc.count, topType, crimeSignal: deriveCrimeSignal(acc.count, annualAvg) };
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function queryMonthlyCrime(): Promise<MonthlyCrimeData[]> {
  const local = loadLocal();
  if (local) return buildMonths(local);

  try {
    return buildMonths(await fetchSocrata());
  } catch {
    return buildMonths([]);
  }
}
