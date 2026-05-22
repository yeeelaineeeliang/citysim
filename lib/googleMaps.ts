import type { MapPoint, UserProfile } from "@/lib/tools/types";
import { fetchOSRMRoute } from "@/lib/fetchRoute";
import type { OSRMMode } from "@/lib/fetchRoute";

interface RouteOption {
  mode: UserProfile["commutePref"];
  estimatedMinutes: number;
  distanceMiles: number;
  routeLabel: string;
  confidence: "low" | "medium";
}

interface NearbyPlace {
  name: string;
  type: "restaurant" | "bar" | "park" | "point_of_interest";
  lat: number;
  lng: number;
  address?: string;
  rating?: number;
}

const TRANSIT_SPEED_MPH = 13;
const TRANSIT_BUFFER_MINUTES = 12;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineDistanceMiles(a: MapPoint, b: MapPoint): number {
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

const OSRM_MODE_MAP: Partial<Record<UserProfile["commutePref"], OSRMMode>> = {
  driving: "driving",
  walking: "foot",
  biking: "bike",
};

export async function computeGoogleRouteOptions(
  origin: MapPoint,
  destination: MapPoint,
  modes: UserProfile["commutePref"][],
): Promise<RouteOption[]> {
  return Promise.all(
    modes.map(async (mode) => {
      const osrmMode = OSRM_MODE_MAP[mode];
      if (osrmMode) {
        const result = await fetchOSRMRoute(origin, destination, osrmMode);
        if (result.durationSeconds !== null) {
          const minutes = Math.max(1, Math.round(result.durationSeconds / 60));
          const miles =
            result.distanceMeters !== null
              ? Number((result.distanceMeters / 1609.34).toFixed(1))
              : Number(haversineDistanceMiles(origin, destination).toFixed(1));
          return { mode, estimatedMinutes: minutes, distanceMiles: miles, routeLabel: "Road network route", confidence: "medium" as const };
        }
      }
      // Transit uses Haversine estimate (OSRM doesn't route transit)
      const miles = haversineDistanceMiles(origin, destination);
      const minutes = Math.max(1, Math.round((miles / TRANSIT_SPEED_MPH) * 60 + TRANSIT_BUFFER_MINUTES));
      return {
        mode,
        estimatedMinutes: minutes,
        distanceMiles: Number(miles.toFixed(1)),
        routeLabel: mode === "transit" ? "Distance estimate — not a CTA route plan" : "Coarse estimate",
        confidence: "low" as const,
      };
    }),
  );
}

export async function searchNearbyEntertainmentPlaces(_center: MapPoint): Promise<NearbyPlace[]> {
  return [];
}
