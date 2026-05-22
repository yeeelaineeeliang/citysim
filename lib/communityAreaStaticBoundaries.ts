import staticCommunityAreas from "@/data/chicago-community-areas.json";
import { NEIGHBORHOOD_COORDINATES } from "@/lib/neighborhoodCoordinates";

type CommunityAreaBoundaryProperties = {
  community?: string;
};

type CommunityAreaFeature = GeoJSON.Feature<GeoJSON.Geometry, CommunityAreaBoundaryProperties>;

function normalizeCommunityName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const staticFeatureCollection =
  staticCommunityAreas as GeoJSON.FeatureCollection<GeoJSON.Geometry, CommunityAreaBoundaryProperties>;

const staticBoundariesByName = new Map<string, CommunityAreaFeature>();

for (const feature of staticFeatureCollection.features) {
  const name = feature.properties?.community;
  if (!name || !feature.geometry) continue;
  staticBoundariesByName.set(normalizeCommunityName(name), feature as CommunityAreaFeature);
}

const communityNameByNumber = new Map(
  NEIGHBORHOOD_COORDINATES.map((area) => [area.communityAreaNumber, area.name]),
);

export function getStaticCommunityAreaBoundary(
  communityAreaNumber: number,
): GeoJSON.GeoJsonObject | null {
  const name = communityNameByNumber.get(communityAreaNumber);
  if (!name) return null;

  const feature = staticBoundariesByName.get(normalizeCommunityName(name));
  if (!feature) return null;

  const boundaryFeature: GeoJSON.Feature<GeoJSON.Geometry> = {
    type: "Feature",
    properties: {
      communityAreaNumber,
      name,
      source: "City of Chicago community area boundary",
    },
    geometry: feature.geometry,
  };
  return boundaryFeature as GeoJSON.GeoJsonObject;
}
