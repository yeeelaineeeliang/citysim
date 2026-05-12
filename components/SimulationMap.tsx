"use client";

import "leaflet/dist/leaflet.css";
import { Fragment, useEffect } from "react";
import { Circle, GeoJSON as GeoJSONLayer, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { MapAction, MapPoint } from "@/lib/tools/types";

interface SimulationMapProps {
  neighborhoodName: string;
  neighborhoodCoords: { lat: number; lng: number };
  workplaceCoords?: { lat: number; lng: number } | null;
  workplaceName?: string;
  mapActions?: MapAction[];
}

const ACCENT = "#c0553b";
const WORKPLACE = "#dc2626";
const ENTERTAINMENT = "#b7793e";
const ROUTE = "#2563eb";

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

function entertainmentIcon(action: Extract<MapAction, { type: "entertainment_summary" }>) {
  return L.divIcon({
    className: "",
    html: `<div style="
      display:flex;align-items:center;gap:7px;
      transform:translateY(-50%);
      white-space:nowrap;
      filter:drop-shadow(0 3px 8px rgba(0,0,0,0.32));
    ">
      <div style="
        display:flex;align-items:center;justify-content:center;
        min-width:40px;height:30px;border-radius:999px;
        background:${ENTERTAINMENT};border:2px solid white;
        color:white;font:800 12px/1 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      ">${action.restaurants}/${action.bars}</div>
      <div style="
        border:1px solid rgba(183,121,62,0.28);
        border-radius:6px;background:rgba(255,250,242,0.98);
        color:#4b2a14;padding:5px 8px;
        font:800 12px/1.1 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      ">Food + bars</div>
    </div>`,
    iconSize: [170, 32],
    iconAnchor: [20, 16],
  });
}

function routeLabelIcon(title: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      transform:translate(-50%,-50%);
      white-space:nowrap;
      border:1px solid rgba(37,99,235,0.24);
      border-radius:999px;
      background:rgba(255,255,255,0.96);
      color:#1e3a8a;
      padding:6px 10px;
      font:800 12px/1 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      box-shadow:0 3px 10px rgba(0,0,0,0.22);
    ">${escapeHtml(title)}</div>`,
    iconSize: [220, 28],
    iconAnchor: [0, 0],
  });
}

function toLatLng(point: MapPoint): [number, number] {
  return [point.lat, point.lng];
}

function routeMidpoint(action: Extract<MapAction, { type: "commute_route" }>): [number, number] {
  return [
    (action.origin.lat + action.destination.lat) / 2,
    (action.origin.lng + action.destination.lng) / 2,
  ];
}

function boundaryData(value: unknown): GeoJSON.GeoJsonObject | null {
  if (value && typeof value === "object" && "type" in value) {
    return value as GeoJSON.GeoJsonObject;
  }
  return null;
}

function actionPoints(actions: MapAction[]): [number, number][] {
  return actions.flatMap((action) => {
    if (action.type === "commute_route") return [toLatLng(action.origin), toLatLng(action.destination)];
    return [toLatLng(action.center)];
  });
}

export function SimulationMap({
  neighborhoodName,
  neighborhoodCoords,
  workplaceCoords,
  workplaceName,
  mapActions = [],
}: SimulationMapProps) {
  const hasRouteAction = mapActions.some((action) => action.type === "commute_route");
  const actionFocusPoints = actionPoints(mapActions);
  const points: [number, number][] = [
    [neighborhoodCoords.lat, neighborhoodCoords.lng],
    ...actionFocusPoints,
    ...(workplaceCoords && (mapActions.length === 0 || hasRouteAction) ? [[workplaceCoords.lat, workplaceCoords.lng] as [number, number]] : []),
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

      {mapActions.map((action) => {
        if (action.type !== "crime_area_signal") return null;
        const data = boundaryData(action.boundaryGeojson);
        const pathOptions = {
          color: action.fillColor,
          fillColor: action.fillColor,
          fillOpacity: action.fillOpacity,
          opacity: 0.62,
          weight: 2,
        };

        if (data) {
          return (
            <GeoJSONLayer
              key={action.id}
              data={data}
              style={() => pathOptions}
            >
              <Popup>
                <div className="min-w-[190px] text-xs text-[#1d252b]">
                  <p className="font-semibold">{action.neighborhood}</p>
                  <p className="mt-1">{action.label}</p>
                  <p className="mt-1 text-[#53616b]">
                    {action.cityAverage
                      ? `${action.total} reports vs ${Math.round(action.cityAverage)} city average`
                      : `${action.total} reports this month`}
                  </p>
                </div>
              </Popup>
            </GeoJSONLayer>
          );
        }

        return (
          <Circle
            key={action.id}
            center={toLatLng(action.center)}
            radius={1150}
            pathOptions={pathOptions}
          >
            <Popup>
              <div className="min-w-[190px] text-xs text-[#1d252b]">
                <p className="font-semibold">{action.neighborhood}</p>
                <p className="mt-1">{action.label}</p>
                <p className="mt-1 text-[#53616b]">
                  {action.cityAverage
                    ? `${action.total} reports vs ${Math.round(action.cityAverage)} city average`
                    : `${action.total} reports this month`}
                </p>
              </div>
            </Popup>
          </Circle>
        );
      })}

      {mapActions.map((action) => {
        if (action.type !== "commute_route") return null;
        const positions = [toLatLng(action.origin), toLatLng(action.destination)];
        return (
          <Fragment key={action.id}>
            <Polyline
              positions={positions}
              pathOptions={{
                color: ROUTE,
                opacity: 0.78,
                weight: 5,
                dashArray: "10 8",
              }}
            />
            <Marker position={routeMidpoint(action)} icon={routeLabelIcon(action.title)}>
              <Popup>
                <div className="min-w-[210px] text-xs text-[#1d252b]">
                  <p className="font-semibold">{action.originName} to {action.destinationName}</p>
                  <p className="mt-1">
                    {action.estimatedMinutes ? `About ${action.estimatedMinutes} minutes` : "Coarse commute estimate"}
                    {action.distanceMiles !== null ? ` over ${action.distanceMiles.toFixed(1)} miles` : ""}
                    {action.routeLabel ? ` · ${action.routeLabel}` : ""}
                  </p>
                  <p className="mt-1 text-[#53616b]">{action.caveat}</p>
                </div>
              </Popup>
            </Marker>
          </Fragment>
        );
      })}

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

      {mapActions.map((action) => {
        if (action.type !== "entertainment_summary") return null;
        return (
          <Marker key={action.id} position={toLatLng(action.center)} icon={entertainmentIcon(action)}>
            <Popup>
              <div className="min-w-[220px] text-xs text-[#1d252b]">
                <p className="font-semibold">{action.title}</p>
                <p className="mt-1">{action.restaurants} restaurants · {action.bars} bars</p>
                <p className="mt-1 text-[#53616b]">
                  {action.parks.length > 0
                    ? `${action.parks.length} parks or civic amenities: ${action.parks.slice(0, 3).join(", ")}`
                    : "No park names loaded for this area."}
                </p>
                <p className="mt-1 text-[#53616b]">
                  Farmers market: {action.farmersMarkets ? "seasonally active" : "not active in this month"}
                </p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
