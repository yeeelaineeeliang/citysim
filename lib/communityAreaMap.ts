import {
  CHICAGO_COMMUNITY_AREA_PINS,
  type ChicagoCommunityAreaNumber,
} from "@/lib/communityAreaPins";
import { NEIGHBORHOOD_COORDINATES } from "@/lib/neighborhoodCoordinates";

export interface CommunityAreaMapArea {
  communityAreaNumber: number;
  name: string;
  slug: string;
  lat: number;
  lng: number;
  descriptors: string[];
  boundaryGeojson?: GeoJSON.GeoJsonObject | null;
}

function isKnownCommunityAreaNumber(value: number): value is ChicagoCommunityAreaNumber {
  return Number.isInteger(value) && value >= 1 && value <= 77;
}

export function getFallbackCommunityAreas(): CommunityAreaMapArea[] {
  return NEIGHBORHOOD_COORDINATES.map((area) => {
    const pin = isKnownCommunityAreaNumber(area.communityAreaNumber)
      ? CHICAGO_COMMUNITY_AREA_PINS[area.communityAreaNumber]
      : null;

    return {
      communityAreaNumber: area.communityAreaNumber,
      name: area.name,
      slug: area.slug,
      lat: area.lat,
      lng: area.lng,
      descriptors: [...(pin?.descriptors ?? [])],
      boundaryGeojson: null,
    };
  });
}

export function mergeCommunityAreaFallback(
  area: Omit<CommunityAreaMapArea, "lat" | "lng" | "descriptors"> & {
    lat?: number | null;
    lng?: number | null;
    descriptors?: string[] | null;
  },
): CommunityAreaMapArea {
  const fallback = getFallbackCommunityAreas().find(
    (item) => item.communityAreaNumber === area.communityAreaNumber,
  );

  return {
    communityAreaNumber: area.communityAreaNumber,
    name: area.name || fallback?.name || "Chicago community area",
    slug: area.slug || fallback?.slug || String(area.communityAreaNumber),
    lat:
      typeof area.lat === "number" && Number.isFinite(area.lat)
        ? area.lat
        : fallback?.lat ?? 41.878,
    lng:
      typeof area.lng === "number" && Number.isFinite(area.lng)
        ? area.lng
        : fallback?.lng ?? -87.629,
    descriptors: area.descriptors?.length ? area.descriptors : fallback?.descriptors ?? [],
    boundaryGeojson: area.boundaryGeojson ?? null,
  };
}
