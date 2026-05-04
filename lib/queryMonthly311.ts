import * as fs from "node:fs";
import * as path from "node:path";

const ENDPOINT_311 = "https://data.cityofchicago.org/resource/v6vf-nfxy.json";
const LOCAL_FILE = path.join(process.cwd(), "CityData", "filtered", "311_hyde_park_2024.json");

const CITY_AVG_RESOLUTION_DAYS = 5.2 as const;

export type Monthly311Data = {
  monthNumber: number;
  requestCount: number;
  avgResolutionDays: number | null;
  cityAvgResolutionDays: typeof CITY_AVG_RESOLUTION_DAYS;
  topTypes: string[];
  serviceSignal: 1 | -1 | null;
};

// ── Normalised row (same shape whether from local file or Socrata) ─────────────

type NormRow = { createdDate: string; closedDate: string | null; srType: string };

// ── Local file ────────────────────────────────────────────────────────────────

type LocalRow = { createdDate: string; closedDate: string | null; srType: string };

function loadLocal(): NormRow[] | null {
  try {
    if (!fs.existsSync(LOCAL_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(LOCAL_FILE, "utf-8")) as LocalRow[];
    return raw.map((r) => ({ createdDate: r.createdDate, closedDate: r.closedDate, srType: r.srType }));
  } catch {
    return null;
  }
}

// ── Socrata fetch ─────────────────────────────────────────────────────────────

type SocrataRow = { sr_type?: string; created_date?: string; closed_date?: string };

function isSocrataRow(row: unknown): row is SocrataRow {
  return !!row && typeof row === "object" && typeof (row as Record<string, unknown>).created_date === "string";
}

async function fetchSocrata(): Promise<NormRow[]> {
  const params = new URLSearchParams({
    $where: "(community_area='41' OR community_area='041') AND created_date between '2024-01-01T00:00:00' AND '2024-12-31T23:59:59'",
    $limit: "10000",
    $order: "created_date ASC",
  });
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.SOCRATA_APP_TOKEN) headers["X-App-Token"] = process.env.SOCRATA_APP_TOKEN;

  const res = await fetch(`${ENDPOINT_311}?${params.toString()}`, { headers, next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`311 API responded ${res.status}`);

  const json = (await res.json()) as unknown[];
  return json.filter(isSocrataRow).map((r) => ({
    createdDate: r.created_date!.slice(0, 10),
    closedDate: r.closed_date ? r.closed_date.slice(0, 10) : null,
    srType: r.sr_type ?? "",
  }));
}

// ── Aggregation ───────────────────────────────────────────────────────────────

type MonthAccum = { count: number; resolutionDays: number[]; types: string[] };

function emptyAccum(): MonthAccum {
  return { count: 0, resolutionDays: [], types: [] };
}

function accumulate(rows: NormRow[]): Map<number, MonthAccum> {
  const byMonth = new Map<number, MonthAccum>();
  for (let m = 1; m <= 12; m++) byMonth.set(m, emptyAccum());

  for (const row of rows) {
    const month = new Date(`${row.createdDate}T00:00:00Z`).getUTCMonth() + 1;
    if (month < 1 || month > 12) continue;
    const acc = byMonth.get(month)!;
    acc.count += 1;
    if (row.srType) acc.types.push(row.srType);
    if (row.closedDate) {
      const days = (new Date(row.closedDate).getTime() - new Date(row.createdDate).getTime()) / 86_400_000;
      if (days >= 0 && days < 365) acc.resolutionDays.push(days);
    }
  }

  return byMonth;
}

function deriveSignal(avgDays: number | null): 1 | -1 | null {
  if (avgDays === null) return null;
  return avgDays <= CITY_AVG_RESOLUTION_DAYS ? 1 : -1;
}

function buildMonths(byMonth: Map<number, MonthAccum>): Monthly311Data[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const acc = byMonth.get(m)!;

    const avgResolutionDays =
      acc.resolutionDays.length > 0
        ? Math.round((acc.resolutionDays.reduce((s, d) => s + d, 0) / acc.resolutionDays.length) * 10) / 10
        : null;

    const typeCounts = new Map<string, number>();
    for (const t of acc.types) typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
    const topTypes = [...typeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([type]) => type);

    return {
      monthNumber: m,
      requestCount: acc.count,
      avgResolutionDays,
      cityAvgResolutionDays: CITY_AVG_RESOLUTION_DAYS,
      topTypes,
      serviceSignal: deriveSignal(avgResolutionDays),
    };
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function queryMonthly311(): Promise<Monthly311Data[]> {
  let rows = loadLocal();
  if (!rows) {
    try {
      rows = await fetchSocrata();
    } catch {
      rows = [];
    }
  }
  return buildMonths(accumulate(rows));
}
