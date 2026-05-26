import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const GTFS_URL = "https://www.transitchicago.com/downloads/sch_data/google_transit.zip";
const OUT_DIR = path.join(process.cwd(), "CityData", "filtered");
const ZIP_FILE = path.join(OUT_DIR, "cta_google_transit.zip");
const DEFAULT_CACHE_FILE = path.join(process.cwd(), "data", "cta-gtfs-cache.json");

interface RouteRow {
  routeId: string;
  shortName: string;
  longName: string;
  mode: "bus" | "rail";
}

interface StopRow {
  name: string;
  lat: number;
  lng: number;
}

interface CachedRoute {
  routeId: string;
  routeShortName: string;
  routeLongName: string;
  mode: "bus" | "rail";
  points: [number, number][];
  stops: StopRow[];
}

function argValue(name: string): string | null {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function records(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  const header = rows.shift() ?? [];
  return rows.map((row) =>
    Object.fromEntries(header.map((key, index) => [key, row[index] ?? ""])),
  );
}

async function downloadGtfs() {
  mkdirSync(OUT_DIR, { recursive: true });
  if (existsSync(ZIP_FILE) && !process.argv.includes("--refresh")) return;
  const res = await fetch(GTFS_URL);
  if (!res.ok) throw new Error(`CTA GTFS download failed: ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  writeFileSync(ZIP_FILE, bytes);
}

function unzipEntry(entry: string) {
  return execFileSync("unzip", ["-p", ZIP_FILE, entry], { maxBuffer: 256 * 1024 * 1024 }).toString("utf8");
}

function parseNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function routeMode(routeType: string): "bus" | "rail" {
  return routeType === "1" ? "rail" : "bus";
}

function distanceScore(points: [number, number][]) {
  return points.reduce((score, point, index) => {
    if (index === 0) return score;
    const prev = points[index - 1];
    return score + Math.abs(point[0] - prev[0]) + Math.abs(point[1] - prev[1]);
  }, 0);
}

async function main() {
  await downloadGtfs();
  const onlyRoutes = new Set((argValue("--routes") ?? "").split(",").map((item) => item.trim()).filter(Boolean));
  const outFile = path.resolve(argValue("--out") ?? DEFAULT_CACHE_FILE);

  const routes = new Map<string, RouteRow>();
  records(unzipEntry("routes.txt")).forEach((row) => {
    const routeId = row.route_id;
    const shortName = row.route_short_name || routeId;
    if (!routeId || (onlyRoutes.size && !onlyRoutes.has(routeId) && !onlyRoutes.has(shortName))) return;
    routes.set(routeId, {
      routeId,
      shortName,
      longName: row.route_long_name || shortName,
      mode: routeMode(row.route_type),
    });
  });

  const routeShapes = new Map<string, Set<string>>();
  const tripRoute = new Map<string, string>();
  records(unzipEntry("trips.txt")).forEach((row) => {
    if (!routes.has(row.route_id) || !row.shape_id || !row.trip_id) return;
    if (!routeShapes.has(row.route_id)) routeShapes.set(row.route_id, new Set());
    routeShapes.get(row.route_id)?.add(row.shape_id);
    tripRoute.set(row.trip_id, row.route_id);
  });

  const shapePoints = new Map<string, Array<{ seq: number; point: [number, number] }>>();
  records(unzipEntry("shapes.txt")).forEach((row) => {
    const lat = parseNumber(row.shape_pt_lat);
    const lng = parseNumber(row.shape_pt_lon);
    const seq = Number(row.shape_pt_sequence);
    if (!row.shape_id || lat === null || lng === null || !Number.isFinite(seq)) return;
    if (!shapePoints.has(row.shape_id)) shapePoints.set(row.shape_id, []);
    shapePoints.get(row.shape_id)?.push({ seq, point: [lat, lng] });
  });

  const stops = new Map<string, StopRow>();
  records(unzipEntry("stops.txt")).forEach((row) => {
    const lat = parseNumber(row.stop_lat);
    const lng = parseNumber(row.stop_lon);
    if (!row.stop_id || !row.stop_name || lat === null || lng === null) return;
    stops.set(row.stop_id, { name: row.stop_name, lat, lng });
  });

  const routeStops = new Map<string, StopRow[]>();
  const seenRouteStop = new Set<string>();
  records(unzipEntry("stop_times.txt")).forEach((row) => {
    const routeId = tripRoute.get(row.trip_id);
    const stop = stops.get(row.stop_id);
    if (!routeId || !stop) return;
    const key = `${routeId}:${row.stop_id}`;
    if (seenRouteStop.has(key)) return;
    seenRouteStop.add(key);
    if (!routeStops.has(routeId)) routeStops.set(routeId, []);
    routeStops.get(routeId)?.push(stop);
  });

  const cachedRoutes: CachedRoute[] = [];
  routes.forEach((route, routeId) => {
    const shapeIds = [...(routeShapes.get(routeId) ?? [])];
    const bestShape = shapeIds
      .map((shapeId) => {
        const points = (shapePoints.get(shapeId) ?? [])
          .sort((a, b) => a.seq - b.seq)
          .map((item) => item.point);
        return { points, score: distanceScore(points) };
      })
      .filter((item) => item.points.length >= 2)
      .sort((a, b) => b.score - a.score)[0];
    if (!bestShape) return;
    cachedRoutes.push({
      routeId,
      routeShortName: route.shortName,
      routeLongName: route.longName,
      mode: route.mode,
      points: bestShape.points,
      stops: (routeStops.get(routeId) ?? []).slice(0, 120),
    });
  });

  writeFileSync(outFile, `${JSON.stringify({ source: GTFS_URL, routes: cachedRoutes }, null, 2)}\n`);
  console.log(`Wrote ${cachedRoutes.length} CTA route shapes to ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
