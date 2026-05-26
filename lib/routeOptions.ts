import { findCachedTransitCorridor } from "@/lib/ctaGtfs";
import { fetchOSRMRoute } from "@/lib/fetchRoute";
import type { CommuteRouteSegment, MapPoint, UserProfile } from "@/lib/tools/types";
import type { OSRMMode } from "@/lib/fetchRoute";

export interface LocalRouteOption {
  mode: UserProfile["commutePref"];
  estimatedMinutes: number | null;
  distanceMiles: number | null;
  routeLabel: string;
  confidence: "low" | "medium";
  source: "cta_gtfs_cached" | "osrm" | "estimate";
  geometry?: [number, number][];
  segments?: CommuteRouteSegment[];
  note?: string;
}

const TRANSIT_SPEED_MPH = 13;
const TRANSIT_BUFFER_MINUTES = 12;

const OSRM_MODE_MAP: Partial<Record<UserProfile["commutePref"], OSRMMode>> = {
  driving: "driving",
  walking: "foot",
  biking: "bike",
};

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

function estimateTransitMinutes(miles: number): number {
  return Math.max(1, Math.round((miles / TRANSIT_SPEED_MPH) * 60 + TRANSIT_BUFFER_MINUTES));
}

export async function computeLocalRouteOptions(
  origin: MapPoint,
  destination: MapPoint,
  modes: UserProfile["commutePref"][],
): Promise<LocalRouteOption[]> {
  const miles = Number(distanceMiles(origin, destination).toFixed(1));

  return Promise.all(
    modes.map(async (mode) => {
      if (mode === "transit") {
        const corridor = findCachedTransitCorridor({ origin, destination });
        return {
          mode,
          estimatedMinutes: estimateTransitMinutes(miles),
          distanceMiles: miles,
          routeLabel: corridor?.label ?? "CTA corridor unavailable",
          confidence: corridor?.confidence ?? "low",
          source: corridor?.source ?? "estimate",
          ...(corridor?.geometry ? { geometry: corridor.geometry } : {}),
          ...(corridor?.segments ? { segments: corridor.segments } : {}),
          note: corridor
            ? "Route shape from cached CTA GTFS public data; verify exact stops and schedule before travel."
            : "No matching CTA GTFS route shape is available in the local cache.",
        };
      }

      const osrmMode = OSRM_MODE_MAP[mode];
      if (osrmMode) {
        const result = await fetchOSRMRoute(origin, destination, osrmMode);
        if (result.durationSeconds !== null) {
          return {
            mode,
            estimatedMinutes: Math.max(1, Math.round(result.durationSeconds / 60)),
            distanceMiles: result.distanceMeters !== null
              ? Number((result.distanceMeters / 1609.34).toFixed(1))
              : miles,
            routeLabel: "Road network route",
            confidence: "medium" as const,
            source: "osrm" as const,
            ...(result.coords ? { geometry: result.coords } : {}),
          };
        }
      }

      return {
        mode,
        estimatedMinutes: null,
        distanceMiles: miles,
        routeLabel: "Local route unavailable",
        confidence: "low" as const,
        source: "estimate" as const,
        note: "Route geometry is unavailable from local/free data.",
      };
    }),
  );
}
