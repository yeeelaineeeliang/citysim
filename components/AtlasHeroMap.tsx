"use client";

import { MapContainer, CircleMarker, Polyline, TileLayer, Tooltip } from "react-leaflet";
import { NEIGHBORHOOD_COORDINATES } from "@/lib/neighborhoodCoordinates";

const FEATURED = new Set([
  "Rogers Park",
  "Lake View",
  "Lincoln Park",
  "Near North Side",
  "Near West Side",
  "Logan Square",
  "Pilsen",
  "Hyde Park",
  "South Shore",
]);

const lakePath: [number, number][] = [
  [42.02, -87.65],
  [41.95, -87.62],
  [41.88, -87.60],
  [41.78, -87.56],
  [41.70, -87.53],
];

export function AtlasHeroMap() {
  const featured = NEIGHBORHOOD_COORDINATES.filter((item) => FEATURED.has(item.name));

  return (
    <div className="absolute inset-0">
      <MapContainer
        center={[41.885, -87.68]}
        zoom={10}
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
          opacity={0.34}
        />
        <Polyline
          positions={lakePath}
          pathOptions={{ color: "#6f8d5f", weight: 18, opacity: 0.22 }}
        />
        {featured.map((item, index) => (
          <CircleMarker
            key={item.communityAreaNumber}
            center={[item.lat, item.lng]}
            radius={index === 7 ? 8 : 5}
            pathOptions={{
              color: index === 7 ? "#e7ad4e" : "#fff9ee",
              fillColor: index === 7 ? "#c76545" : "#6f8d5f",
              fillOpacity: 0.94,
              opacity: 0.96,
              weight: 2,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={1} permanent={index === 7}>
              <span className="text-[11px] font-bold text-[#263126]">{item.name}</span>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(79,111,69,0.92)_0%,rgba(79,111,69,0.72)_37%,rgba(79,111,69,0.22)_72%,rgba(247,240,227,0.16)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(38,49,38,0.14)_0%,rgba(38,49,38,0.42)_100%)]" />
    </div>
  );
}
