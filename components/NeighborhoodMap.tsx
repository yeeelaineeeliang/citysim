"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

export interface MapNeighborhood {
  communityAreaNumber: number;
  name: string;
  lat: number;
  lng: number;
  rank: number;
  matchReason: string;
}

interface Props {
  neighborhoods: MapNeighborhood[];
  workplaceCoords?: { lat: number; lng: number } | null;
  workplaceName?: string;
  onSelect: (name: string) => void;
}

const ACCENT = "#c0553b";
const WORKPLACE = "#dc2626";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Fit map bounds to all visible markers whenever they change
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      map.invalidateSize();
      if (points.length === 0) return;
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [map, points]);
  return null;
}

function neighborhoodIcon(neighborhood: MapNeighborhood) {
  return L.divIcon({
    className: "",
    html: `<div style="
      display:flex;align-items:center;gap:6px;
      transform:translateY(-50%);
      white-space:nowrap;
      filter:drop-shadow(0 2px 6px rgba(0,0,0,0.28));
    ">
      <div style="
        display:flex;align-items:center;justify-content:center;
        width:28px;height:28px;border-radius:999px;
        background:${ACCENT};border:2px solid white;
        color:white;font:700 12px/1 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      ">${neighborhood.rank}</div>
      <div style="
        border:1px solid rgba(22,33,40,0.16);
        border-radius:6px;background:rgba(255,250,242,0.96);
        color:#162128;padding:4px 7px;
        font:700 12px/1.15 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      ">${escapeHtml(neighborhood.name)}</div>
    </div>`,
    iconSize: [210, 30],
    iconAnchor: [14, 15],
  });
}

// Minimal workplace marker — avoids Leaflet's default broken-image icon.
function workplaceIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="
      display:flex;align-items:center;gap:6px;
      transform:translateY(-50%);
      white-space:nowrap;
      filter:drop-shadow(0 2px 6px rgba(0,0,0,0.3));
    ">
      <div style="
        width:16px;height:16px;border-radius:999px;
        background:${WORKPLACE};border:3px solid white;
        box-shadow:0 0 0 2px rgba(220,38,38,0.32);
      "></div>
      <div style="
        border:1px solid rgba(220,38,38,0.28);
        border-radius:6px;background:rgba(255,255,255,0.96);
        color:#7f1d1d;padding:4px 7px;
        font:700 12px/1.15 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      ">Workplace</div>
    </div>`,
    iconSize: [120, 26],
    iconAnchor: [8, 13],
  });
}

export function NeighborhoodMap({ neighborhoods, workplaceCoords, workplaceName, onSelect }: Props) {
  const allPoints: [number, number][] = [
    ...neighborhoods.map((n) => [n.lat, n.lng] as [number, number]),
    ...(workplaceCoords ? [[workplaceCoords.lat, workplaceCoords.lng] as [number, number]] : []),
  ];

  return (
    <MapContainer
      center={[41.878, -87.629]}
      zoom={11}
      className="h-full w-full rounded-2xl"
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <FitBounds points={allPoints} />

      {workplaceCoords && (
        <Marker position={[workplaceCoords.lat, workplaceCoords.lng]} icon={workplaceIcon()}>
          <Popup>
            <span className="text-xs font-semibold">{workplaceName ?? "Workplace"}</span>
          </Popup>
        </Marker>
      )}

      {neighborhoods.map((n) => (
        <Marker
          key={n.communityAreaNumber}
          position={[n.lat, n.lng]}
          icon={neighborhoodIcon(n)}
          eventHandlers={{ click: () => onSelect(n.name) }}
        >
          <Popup>
            <div className="min-w-[160px]">
              <p className="font-semibold">
                <span className="mr-1 text-[color:var(--accent)]">#{n.rank}</span>
                {n.name}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">{n.matchReason}</p>
              <button
                onClick={() => onSelect(n.name)}
                className="mt-2 w-full rounded-full bg-[#c0553b] px-3 py-1 text-xs font-semibold text-white"
              >
                Simulate this neighborhood →
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
