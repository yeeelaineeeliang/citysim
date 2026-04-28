import { CTA_RIDERSHIP_TABLE, createSupabaseAdminClient, hasSupabaseCredentials } from "@/lib/supabase";

export type RouteSummary = {
  route: string;
  totalRides: number;
  averageDailyRides: number;
  peakDate: string;
  peakRides: number;
};

export type WeekSummary = {
  week: number;
  label: string;
  startDate: string;
  endDate: string;
  route6Rides: number;
  weekdayRides: number;
  serviceDays: number;
  peakDate: string;
  peakRides: number;
  context: string;
};

export type StructuredSimulationData = {
  neighborhood: "Hyde Park";
  communityArea: 41;
  persona: "UChicago student commuter";
  month: "October 2024";
  source: "CTA Bus Ridership Daily Totals by Route";
  totalRidesAcrossRoutes: number;
  routeTotals: RouteSummary[];
  highlightedRoute: RouteSummary;
  peakRidershipDay: {
    date: string;
    totalRides: number;
  };
  weekOverWeekDelta: {
    currentWindow: string;
    previousWindow: string;
    currentTotalRides: number;
    previousTotalRides: number;
    absoluteChange: number;
    percentChange: number;
    trend: "up" | "down" | "flat";
  };
  weeklyBreakdown: WeekSummary[];
};

type RidershipRow = {
  route: string;
  service_date: string;
  day_type: string;
  rides: number;
};

const PROMPT_CTA_ENDPOINT = "https://data.cityofchicago.org/resource/t2rn-p8d7.json";
const VERIFIED_CTA_BUS_ENDPOINT = "https://data.cityofchicago.org/resource/jyb9-n7fm.json";
const HYDE_PARK_ROUTES = ["2", "6", "15", "28", "55", "171", "172", "192"];

type SocrataRidershipRow = {
  route: string;
  date: string;
  daytype: string;
  rides: string;
};

const OCTOBER_WEEKS = [
  { week: 1, label: "Oct 1–7",   start: 1,  end: 7,  context: "" },
  { week: 2, label: "Oct 8–14",  start: 8,  end: 14, context: "" },
  { week: 3, label: "Oct 15–21", start: 15, end: 21, context: "Midterms week" },
  { week: 4, label: "Oct 22–28", start: 22, end: 28, context: "" },
  { week: 5, label: "Oct 29–31", start: 29, end: 31, context: "Month's end" },
] as const;

function formatWindowLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function sortRoutes(a: RouteSummary, b: RouteSummary) {
  if (b.totalRides !== a.totalRides) {
    return b.totalRides - a.totalRides;
  }
  return Number(a.route) - Number(b.route);
}

function getWindowTotal(rows: RidershipRow[], startDay: number, endDay: number) {
  return rows.reduce((sum, row) => {
    const day = Number(row.service_date.slice(-2));
    if (day < startDay || day > endDay) return sum;
    return sum + row.rides;
  }, 0);
}

function buildWeeklyBreakdown(rows: RidershipRow[]): WeekSummary[] {
  const route6Rows = rows.filter((r) => r.route === "6");

  return OCTOBER_WEEKS.map(({ week, label, start, end, context }) => {
    const weekRows = route6Rows.filter((r) => {
      const day = Number(r.service_date.slice(-2));
      return day >= start && day <= end;
    });

    const weekdayRows = weekRows.filter((r) => r.day_type === "W");
    const route6Rides = weekRows.reduce((sum, r) => sum + r.rides, 0);
    const weekdayRides = weekdayRows.reduce((sum, r) => sum + r.rides, 0);

    const peakRow =
      weekRows.length > 0
        ? weekRows.reduce((peak, r) => (r.rides > peak.rides ? r : peak), weekRows[0])
        : null;

    return {
      week,
      label,
      startDate: `2024-10-${String(start).padStart(2, "0")}`,
      endDate: `2024-10-${String(end).padStart(2, "0")}`,
      route6Rides,
      weekdayRides,
      serviceDays: weekRows.length,
      peakDate: peakRow?.service_date ?? "",
      peakRides: peakRow?.rides ?? 0,
      context,
    };
  });
}

function buildQueryUrl(endpoint: string) {
  const url = new URL(endpoint);
  url.searchParams.set("$select", "route, date, daytype, rides");
  const routeList = HYDE_PARK_ROUTES.map((route) => `'${route}'`).join(",");
  url.searchParams.set(
    "$where",
    `date between '2024-10-01T00:00:00' and '2024-10-31T23:59:59' and route in (${routeList})`,
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

async function fetchRowsFromCtaApi(): Promise<RidershipRow[]> {
  const headers: Record<string, string> = {};
  if (process.env.SOCRATA_APP_TOKEN) {
    headers["X-App-Token"] = process.env.SOCRATA_APP_TOKEN;
  }

  const promptResponse = await fetch(buildQueryUrl(PROMPT_CTA_ENDPOINT), {
    next: { revalidate: 0 },
    headers,
  });

  const promptRows = promptResponse.ok ? ((await promptResponse.json()) as unknown) : [];

  const rows =
    hasExpectedBusColumns(promptRows) && promptRows.length > 0
      ? promptRows
      : await (async () => {
          const verifiedResponse = await fetch(buildQueryUrl(VERIFIED_CTA_BUS_ENDPOINT), {
            next: { revalidate: 0 },
            headers,
          });
          if (!verifiedResponse.ok) {
            throw new Error(`CTA API request failed with status ${verifiedResponse.status}`);
          }
          return (await verifiedResponse.json()) as unknown;
        })();

  if (!hasExpectedBusColumns(rows) || rows.length === 0) {
    throw new Error("CTA API returned zero rows for Oct 2024 Hyde Park routes.");
  }

  return rows.map((row) => ({
    route: row.route,
    service_date: row.date.slice(0, 10),
    day_type: row.daytype,
    rides: Number(row.rides),
  }));
}

function buildStructuredData(rows: RidershipRow[]): StructuredSimulationData {
  if (rows.length === 0) {
    throw new Error("No Oct 2024 CTA ridership rows found for Hyde Park routes.");
  }

  const routeMap = new Map<string, RidershipRow[]>();
  const dailyTotals = new Map<string, number>();

  for (const row of rows) {
    const routeRows = routeMap.get(row.route) ?? [];
    routeRows.push(row);
    routeMap.set(row.route, routeRows);
    dailyTotals.set(row.service_date, (dailyTotals.get(row.service_date) ?? 0) + row.rides);
  }

  const routeTotals = Array.from(routeMap.entries())
    .map(([route, routeRows]) => {
      const totalRides = routeRows.reduce((sum, row) => sum + row.rides, 0);
      const peakRow = routeRows.reduce((peak, row) => (row.rides > peak.rides ? row : peak), routeRows[0]);
      return {
        route,
        totalRides,
        averageDailyRides: Number((totalRides / routeRows.length).toFixed(1)),
        peakDate: peakRow.service_date,
        peakRides: peakRow.rides,
      };
    })
    .sort(sortRoutes);

  const totalRidesAcrossRoutes = routeTotals.reduce((sum, route) => sum + route.totalRides, 0);
  // Route 6 is the campus connector — the defining route for a UChicago student commuter
  const highlightedRoute = routeTotals.find((r) => r.route === "6") ?? routeTotals[0];

  const peakRidershipDayEntry = Array.from(dailyTotals.entries()).reduce(
    (peak, current) => (current[1] > peak[1] ? current : peak),
    ["", 0] as [string, number],
  );

  const previousTotalRides = getWindowTotal(rows, 15, 21);
  const currentTotalRides = getWindowTotal(rows, 22, 28);
  const absoluteChange = currentTotalRides - previousTotalRides;
  const percentChange =
    previousTotalRides === 0 ? 0 : Number(((absoluteChange / previousTotalRides) * 100).toFixed(1));
  const trend: "up" | "down" | "flat" =
    absoluteChange === 0 ? "flat" : absoluteChange > 0 ? "up" : "down";

  return {
    neighborhood: "Hyde Park",
    communityArea: 41,
    persona: "UChicago student commuter",
    month: "October 2024",
    source: "CTA Bus Ridership Daily Totals by Route",
    totalRidesAcrossRoutes,
    routeTotals,
    highlightedRoute,
    peakRidershipDay: {
      date: peakRidershipDayEntry[0],
      totalRides: peakRidershipDayEntry[1],
    },
    weekOverWeekDelta: {
      previousWindow: `${formatWindowLabel("2024-10-15")} – ${formatWindowLabel("2024-10-21")}`,
      currentWindow: `${formatWindowLabel("2024-10-22")} – ${formatWindowLabel("2024-10-28")}`,
      previousTotalRides,
      currentTotalRides,
      absoluteChange,
      percentChange,
      trend,
    },
    weeklyBreakdown: buildWeeklyBreakdown(rows),
  };
}

async function fetchRowsFromSupabase(): Promise<RidershipRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(CTA_RIDERSHIP_TABLE)
    .select("route, service_date, day_type, rides")
    .eq("community_area", 41)
    .gte("service_date", "2024-10-01")
    .lte("service_date", "2024-10-31")
    .order("service_date", { ascending: true })
    .order("route", { ascending: true });

  if (error) {
    throw new Error(`Failed to query simulation data: ${error.message}`);
  }

  return (data ?? []) as RidershipRow[];
}

export async function querySimulationData(): Promise<StructuredSimulationData> {
  if (!hasSupabaseCredentials()) {
    return buildStructuredData(await fetchRowsFromCtaApi());
  }

  try {
    const rows = await fetchRowsFromSupabase();
    if (rows.length === 0) {
      return buildStructuredData(await fetchRowsFromCtaApi());
    }
    return buildStructuredData(rows);
  } catch {
    return buildStructuredData(await fetchRowsFromCtaApi());
  }
}
