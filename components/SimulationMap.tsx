"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

interface SimulationMapProps {
  neighborhoodName: string;
  neighborhoodCoords: { lat: number; lng: number };
  workplaceCoords?: { lat: number; lng: number } | null;
  workplaceName?: string;
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

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 13 });
  }, [map, points]);
  return null;
}

function neighborhoodIcon(name: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      display:flex;align-items:center;gap:7px;
      transform:translateY(-50%);
      white-space:nowrap;
      filter:drop-shadow(0 2px 7px rgba(0,0,0,0.3));
    ">
      <div style="
        width:18px;height:18px;border-radius:999px;
        background:${ACCENT};border:3px solid white;
        box-shadow:0 0 0 2px rgba(192,85,59,0.32);
      "></div>
      <div style="
        border:1px solid rgba(22,33,40,0.16);
        border-radius:6px;background:rgba(255,250,242,0.97);
        color:#162128;padding:5px 8px;
        font:800 13px/1.1 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      ">${escapeHtml(name)}</div>
    </div>`,
    iconSize: [220, 28],
    iconAnchor: [9, 14],
  });
}

function workplaceIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="
      display:flex;align-items:center;gap:7px;
      transform:translateY(-50%);
      white-space:nowrap;
      filter:drop-shadow(0 2px 7px rgba(0,0,0,0.3));
    ">
      <div style="
        width:16px;height:16px;border-radius:999px;
        background:${WORKPLACE};border:3px solid white;
        box-shadow:0 0 0 2px rgba(220,38,38,0.34);
      "></div>
      <div style="
        border:1px solid rgba(220,38,38,0.28);
        border-radius:6px;background:rgba(255,255,255,0.97);
        color:#7f1d1d;padding:5px 8px;
        font:800 12px/1.1 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      ">Workplace</div>
    </div>`,
    iconSize: [130, 28],
    iconAnchor: [8, 14],
  });
}

export function SimulationMap({
  neighborhoodName,
  neighborhoodCoords,
  workplaceCoords,
  workplaceName,
}: SimulationMapProps) {
  const points: [number, number][] = [
    [neighborhoodCoords.lat, neighborhoodCoords.lng],
    ...(workplaceCoords ? [[workplaceCoords.lat, workplaceCoords.lng] as [number, number]] : []),
  ];

  return (
    <MapContainer
      center={[neighborhoodCoords.lat, neighborhoodCoords.lng]}
      zoom={13}
      className="h-full w-full"
      zoomControl
      scrollWheelZoom
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <FitBounds points={points} />

      <Marker
        position={[neighborhoodCoords.lat, neighborhoodCoords.lng]}
        icon={neighborhoodIcon(neighborhoodName)}
      >
        <Popup>
          <span className="text-xs font-semibold">{neighborhoodName}</span>
        </Popup>
      </Marker>

      {workplaceCoords && (
        <Marker position={[workplaceCoords.lat, workplaceCoords.lng]} icon={workplaceIcon()}>
          <Popup>
            <span className="text-xs font-semibold">{workplaceName ?? "Workplace"}</span>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
