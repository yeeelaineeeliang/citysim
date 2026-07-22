import ctaGtfsCache from "@/data/cta-gtfs-cache.json";
import { thinPolyline } from "@/lib/decodePolyline";
import type { CommuteRouteSegment, MapPoint, TransitStop } from "@/lib/tools/types";

export interface CachedCtaRouteShape {
  routeId: string;
  routeShortName: string;
  routeLongName?: string;
  mode?: "bus" | "rail";
  points: [number, number][];
  stops?: Array<{ name: string; lat: number; lng: number }>;
}

export interface TransitCorridorQuery {
  origin: MapPoint;
  destination: MapPoint;
  routeLabel?: string | null;
  stopNames?: string[];
}

export interface TransitCorridorResult {
  label: string;
  geometry: [number, number][];
  segments: CommuteRouteSegment[];
  confidence: "low" | "medium";
  source: "cta_gtfs_cached";
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceMiles(a: MapPoint, b: MapPoint): number {
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(h));
}

function normalize(value: string) {
  return value.toLowerCase().trim().replace(/^cta\s+/i, "").replace(/^route\s+/i, "").replace(/\s+/g, " ");
}

function parseRoute(value: unknown): CachedCtaRouteShape | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const routeId = typeof item.routeId === "string"
    ? item.routeId
    : typeof item.route_id === "string"
      ? item.route_id
      : "";
  const routeShortName = typeof item.routeShortName === "string"
    ? item.routeShortName
    : typeof item.route_short_name === "string"
      ? item.route_short_name
      : routeId;
  const pointsRaw = item.points;
  if (!routeId || !Array.isArray(pointsRaw)) return null;

  const points = pointsRaw
    .map((point): [number, number] | null => {
      if (!Array.isArray(point) || point.length < 2) return null;
      const lat = Number(point[0]);
      const lng = Number(point[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return [lat, lng];
    })
    .filter((point): point is [number, number] => Boolean(point));
  if (points.length < 2) return null;

  const stops = Array.isArray(item.stops)
    ? item.stops.flatMap((stop) => {
        if (!stop || typeof stop !== "object") return [];
        const record = stop as Record<string, unknown>;
        const name = typeof record.name === "string"
          ? record.name
          : typeof record.stop_name === "string"
            ? record.stop_name
            : "";
        const lat = Number(record.lat ?? record.stop_lat);
        const lng = Number(record.lng ?? record.stop_lon);
        return name && Number.isFinite(lat) && Number.isFinite(lng)
          ? [{ name, lat, lng }]
          : [];
      })
    : undefined;

  return {
    routeId,
    routeShortName,
    ...(typeof item.routeLongName === "string" ? { routeLongName: item.routeLongName } : {}),
    ...(item.mode === "rail" || item.mode === "bus" ? { mode: item.mode } : {}),
    points,
    ...(stops?.length ? { stops } : {}),
  };
}

export function loadCachedCtaRoutes(): CachedCtaRouteShape[] {
  const raw = ctaGtfsCache as unknown;
  const rows = raw && typeof raw === "object" && Array.isArray((raw as { routes?: unknown }).routes)
    ? (raw as { routes: unknown[] }).routes
    : [];
  return rows
    .map(parseRoute)
    .filter((route): route is CachedCtaRouteShape => Boolean(route));
}

function nearestIndex(points: [number, number][], point: MapPoint) {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  points.forEach(([lat, lng], index) => {
    const distance = distanceMiles(point, { lat, lng });
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return { index: bestIndex, distance: bestDistance };
}

function routeMatchesLabel(route: CachedCtaRouteShape, routeLabel?: string | null) {
  if (!routeLabel) return false;
  const label = normalize(routeLabel);
  return [
    route.routeId,
    route.routeShortName,
    route.routeLongName ?? "",
    `route ${route.routeShortName}`,
  ].some((value) => normalize(value) === label || normalize(value).includes(label));
}

function routeMatchesStops(route: CachedCtaRouteShape, stopNames: string[] = []) {
  if (!stopNames.length || !route.stops?.length) return false;
  const stops = route.stops.map((stop) => normalize(stop.name));
  return stopNames.some((name) => {
    const normalized = normalize(name);
    return stops.some((stop) => stop.includes(normalized) || normalized.includes(stop));
  });
}

function sliceRoute(points: [number, number][], fromIndex: number, toIndex: number) {
  if (fromIndex <= toIndex) return points.slice(fromIndex, toIndex + 1);
  return points.slice(toIndex, fromIndex + 1).reverse();
}

function concatGeometry(segments: CommuteRouteSegment[]) {
  const points: [number, number][] = [];
  segments.forEach((segment) => {
    segment.geometry.forEach((point, index) => {
      if (points.length && index === 0) return;
      points.push(point);
    });
  });
  return thinPolyline(points, 90);
}

export function selectTransitCorridorFromRoutes(
  routes: CachedCtaRouteShape[],
  query: TransitCorridorQuery,
): TransitCorridorResult | null {
  let best:
    | {
        route: CachedCtaRouteShape;
        origin: ReturnType<typeof nearestIndex>;
        destination: ReturnType<typeof nearestIndex>;
        score: number;
        labelMatch: boolean;
        stopMatch: boolean;
      }
    | null = null;

  for (const route of routes) {
    const origin = nearestIndex(route.points, query.origin);
    const destination = nearestIndex(route.points, query.destination);
    const labelMatch = routeMatchesLabel(route, query.routeLabel);
    const stopMatch = routeMatchesStops(route, query.stopNames);
    const score = origin.distance + destination.distance - (labelMatch ? 1.2 : 0) - (stopMatch ? 0.6 : 0);
    if (!best || score < best.score) {
      best = { route, origin, destination, score, labelMatch, stopMatch };
    }
  }

  if (!best) return null;
  const rawDistance = best.origin.distance + best.destination.distance;
  if (!best.labelMatch && !best.stopMatch && rawDistance > 2.8) return null;

  const transitGeometry = thinPolyline(
    sliceRoute(best.route.points, best.origin.index, best.destination.index),
    80,
  );
  if (transitGeometry.length < 2) return null;

  const first = transitGeometry[0];
  const last = transitGeometry[transitGeometry.length - 1];
  const label = `CTA Route ${best.route.routeShortName}`;
  const segments: CommuteRouteSegment[] = [
    {
      mode: "walk",
      label: "Walk to CTA corridor",
      geometry: [[query.origin.lat, query.origin.lng], first],
    },
    {
      mode: "transit",
      label,
      geometry: transitGeometry,
      fromName: best.route.stops?.[0]?.name,
      toName: best.route.stops?.[best.route.stops.length - 1]?.name,
    },
    {
      mode: "walk",
      label: "Walk from CTA corridor",
      geometry: [last, [query.destination.lat, query.destination.lng]],
    },
  ];

  return {
    label,
    geometry: concatGeometry(segments),
    segments,
    confidence: best.labelMatch || best.stopMatch || rawDistance <= 1.4 ? "medium" : "low",
    source: "cta_gtfs_cached",
  };
}

export function findCachedTransitCorridor(query: TransitCorridorQuery): TransitCorridorResult | null {
  return selectTransitCorridorFromRoutes(loadCachedCtaRoutes(), query);
}

export function getStopsNear(center: MapPoint, radiusMiles: number): TransitStop[] {
  const routes = loadCachedCtaRoutes();
  const seen = new Set<string>();
  const result: TransitStop[] = [];
  for (const route of routes) {
    if (!route.stops) continue;
    for (const stop of route.stops) {
      if (distanceMiles(center, { lat: stop.lat, lng: stop.lng }) > radiusMiles) continue;
      const key = `${stop.name}|${stop.lat}|${stop.lng}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        name: stop.name,
        lat: stop.lat,
        lng: stop.lng,
        routeLabel: `Route ${route.routeShortName}`,
        mode: route.mode ?? "bus",
      });
    }
  }
  return result;
}
