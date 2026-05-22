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

function clamp(min: number, max: number, value: number) {
  return Math.min(max, Math.max(min, value));
}

function blockPosition(item: { lat: number; lng: number }) {
  const x = (item.lng + 87.91) / 0.39;
  const y = (42.04 - item.lat) / 0.42;
  return {
    left: `${clamp(50, 86, 50 + x * 36)}%`,
    top: `${clamp(16, 74, 16 + y * 58)}%`,
  };
}

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
          opacity={0.5}
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
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(79,111,69,0.86)_0%,rgba(79,111,69,0.56)_38%,rgba(79,111,69,0.08)_72%,rgba(247,240,227,0.08)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(38,49,38,0.1)_0%,rgba(38,49,38,0.32)_100%)]" />
      <div className="pointer-events-none absolute inset-0 hidden sm:block">
        {featured.map((item, index) => (
          <div
            key={`hero-block-${item.communityAreaNumber}`}
            className="absolute rounded-[var(--radius-md)] border border-white/28 bg-white/12 shadow-[0_12px_30px_rgba(38,49,38,0.12)] backdrop-blur-[1px]"
            style={{
              ...blockPosition(item),
              width: index === 7 ? "118px" : "88px",
              height: index === 7 ? "64px" : "48px",
              backgroundColor: index === 7 ? "rgba(199,101,69,0.55)" : "rgba(255,249,238,0.15)",
            }}
          >
            {index === 7 && (
              <span className="absolute left-3 top-3 text-xs font-bold text-white drop-shadow">
                Hyde Park
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
