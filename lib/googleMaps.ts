import type { MapPoint, UserProfile } from "@/lib/tools/types";

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

const MODE_SPEED_MPH: Record<UserProfile["commutePref"], number> = {
  driving: 18,
  transit: 13,
  biking: 10,
  walking: 3.1,
};

const MODE_BUFFER_MINUTES: Record<UserProfile["commutePref"], number> = {
  driving: 8,
  transit: 12,
  biking: 5,
  walking: 2,
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

function fallbackRouteOption(
  origin: MapPoint,
  destination: MapPoint,
  mode: UserProfile["commutePref"],
): RouteOption {
  const miles = distanceMiles(origin, destination);
  const minutes = Math.max(
    1,
    Math.round((miles / MODE_SPEED_MPH[mode]) * 60 + MODE_BUFFER_MINUTES[mode]),
  );
  return {
    mode,
    estimatedMinutes: minutes,
    distanceMiles: Number(miles.toFixed(1)),
    routeLabel: "Coarse map estimate",
    confidence: "low",
  };
}

export async function computeGoogleRouteOptions(
  origin: MapPoint,
  destination: MapPoint,
  modes: UserProfile["commutePref"][],
): Promise<RouteOption[]> {
  return modes.map((mode) => fallbackRouteOption(origin, destination, mode));
}

export async function searchNearbyEntertainmentPlaces(_center: MapPoint): Promise<NearbyPlace[]> {
  return [];
}
