"use client";

import { GeoJSON as GeoJSONLayer, MapContainer, TileLayer } from "react-leaflet";
import staticCommunityAreas from "@/data/chicago-community-areas.json";

const communityAreaData = staticCommunityAreas as GeoJSON.FeatureCollection<GeoJSON.Geometry>;

export function AtlasHeroMap() {
  return (
    <div className="absolute inset-0 isolate">
      <MapContainer
        center={[41.85, -87.65]}
        zoom={12}
        minZoom={10}
        maxZoom={14}
        maxBounds={[[41.6, -87.95], [42.1, -87.4]]}
        zoomSnap={0.25}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        keyboard={false}
        attributionControl={false}
        className="h-full w-full"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          opacity={0.88}
        />
        <GeoJSONLayer
          data={communityAreaData}
          interactive={false}
          style={() => ({
            color: "#f4efe6",
            fillColor: "#536a8a",
            fillOpacity: 0.055,
            opacity: 0.72,
            weight: 1.15,
          })}
        />
      </MapContainer>
    </div>
  );
}
