"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Beer, Landmark, Music2, Trees, Utensils } from "lucide-react";
import {
  Circle,
  CircleMarker,
  GeoJSON as GeoJSONLayer,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type {
  EntertainmentPlace,
  EntertainmentPlaceCategory,
  MapAction,
  MapPoint,
} from "@/lib/tools/types";

interface SimulationMapProps {
  neighborhoodName: string;
  neighborhoodCoords: { lat: number; lng: number };
  workplaceCoords?: { lat: number; lng: number } | null;
  workplaceName?: string;
  mapActions?: MapAction[];
}

export interface CommunityAreaMapArea {
  communityAreaNumber: number;
  name: string;
  slug: string;
  lat: number;
  lng: number;
  descriptors: string[];
  boundaryGeojson?: GeoJSON.GeoJsonObject | null;
}

export const COLORS = {
  ink: "#111315",
  muted: "#6e7474",
  cream: "#fbf8f2",
  sage: "#6f9b8b",
  sageSoft: "#dce9e4",
  sageStrong: "#476f63",
  terracotta: "#b95f3f",
  amber: "#d5a547",
  lake: "#536a8a",
  park: "#547d70",
  civic: "#7f6fb2",
  dimFill: "#dad8d3",
  dimStroke: "#8b9090",
};

export const CATEGORY_META: Record<
  EntertainmentPlaceCategory,
  { label: string; color: string; Icon: typeof Utensils }
> = {
  food: { label: "Food", color: COLORS.terracotta, Icon: Utensils },
  bar: { label: "Bars", color: "#b8793e", Icon: Beer },
  park: { label: "Parks", color: COLORS.park, Icon: Trees },
  civic: { label: "Civic", color: COLORS.civic, Icon: Landmark },
  entertainment: { label: "Arts", color: COLORS.amber, Icon: Music2 },
};

export const CATEGORY_ORDER = Object.keys(CATEGORY_META) as EntertainmentPlaceCategory[];

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function toLatLng(point: MapPoint): [number, number] {
  return [point.lat, point.lng];
}

export function boundaryData(value: unknown): GeoJSON.GeoJsonObject | null {
  if (value && typeof value === "object" && "type" in value) {
    return value as GeoJSON.GeoJsonObject;
  }
  return null;
}

export function areaBounds(area: CommunityAreaMapArea | null): L.LatLngBounds | null {
  if (!area?.boundaryGeojson) return null;
  const bounds = L.geoJSON(area.boundaryGeojson).getBounds();
  return bounds.isValid() ? bounds : null;
}

export function normalizeName(value: string) {
  return value.toLowerCase().trim();
}

export function validAreas(value: unknown): CommunityAreaMapArea[] {
  if (!value || typeof value !== "object" || !("areas" in value)) return [];
  const areas = (value as { areas?: unknown }).areas;
  if (!Array.isArray(areas)) return [];
  return areas.filter((area): area is CommunityAreaMapArea => {
    if (!area || typeof area !== "object") return false;
    const item = area as Partial<CommunityAreaMapArea>;
    return (
      typeof item.communityAreaNumber === "number" &&
      typeof item.name === "string" &&
      typeof item.slug === "string" &&
      typeof item.lat === "number" &&
      typeof item.lng === "number" &&
      Array.isArray(item.descriptors)
    );
  });
}

export function validPlace(value: unknown): EntertainmentPlace | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<EntertainmentPlace>;
  if (
    typeof item.id !== "string" ||
    typeof item.name !== "string" ||
    !CATEGORY_ORDER.includes(item.category as EntertainmentPlaceCategory) ||
    typeof item.lat !== "number" ||
    typeof item.lng !== "number"
  ) {
    return null;
  }
  return item as EntertainmentPlace;
}

function pointsFromActions(actions: MapAction[]): [number, number][] {
  return actions.flatMap((action) => {
    if (action.type === "commute_route") {
      return action.geometry?.length
        ? action.geometry
        : action.mode === "transit"
          ? [toLatLng(action.origin), toLatLng(action.destination)]
          : [toLatLng(action.origin), toLatLng(action.destination)];
    }
    if (action.type === "entertainment_summary") return [];
    if (action.type === "transit_stops") return [];
    return [toLatLng(action.center)];
  });
}

function pointOutsideBounds(bounds: L.LatLngBounds, point: [number, number]) {
  return !bounds.contains(L.latLng(point[0], point[1]));
}

function FitBounds({
  selectedArea,
  points,
}: {
  selectedArea: CommunityAreaMapArea | null;
  points: [number, number][];
}) {
  const map = useMap();
  const key = `${selectedArea?.communityAreaNumber ?? "none"}:${points.map((p) => p.join(",")).join(";")}`;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      map.invalidateSize();
      const selectedBounds = areaBounds(selectedArea);
      const bounds = selectedBounds?.pad(0.01) ?? (points.length ? L.latLngBounds(points) : null);
      if (!bounds) return;
      const pointsToFit = selectedBounds
        ? points.filter((point) => pointOutsideBounds(selectedBounds, point))
        : points;
      pointsToFit.forEach((point) => bounds.extend(point));
      if (!bounds.isValid()) return;
      map.fitBounds(bounds, { padding: [16, 16], maxZoom: 15.25 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [key, map, points, selectedArea]);

  return null;
}

function TrackZoom({ onZoom }: { onZoom: (zoom: number) => void }) {
  const map = useMapEvents({
    zoomend: () => onZoom(map.getZoom()),
  });

  useEffect(() => {
    onZoom(map.getZoom());
  }, [map, onZoom]);

  return null;
}

export function workplaceIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="
      display:flex;align-items:center;justify-content:center;
      width:26px;height:26px;border-radius:999px;
      background:${COLORS.ink};
      border:2px solid ${COLORS.cream};
      color:white;
      font:900 11px/1 'SF Pro Text','Inter',system-ui,sans-serif;
      box-shadow:0 8px 20px rgba(38,49,38,0.28);
    ">W</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function groupOffset(category: EntertainmentPlaceCategory) {
  const offsets: Record<EntertainmentPlaceCategory, { x: number; y: number }> = {
    food: { x: 34, y: 12 },
    bar: { x: -34, y: -10 },
    park: { x: 0, y: -34 },
    civic: { x: -34, y: 28 },
    entertainment: { x: 36, y: -30 },
  };
  return offsets[category];
}

export function placeOffset(category: EntertainmentPlaceCategory) {
  const offsets: Record<EntertainmentPlaceCategory, { x: number; y: number }> = {
    food: { x: 14, y: 8 },
    bar: { x: -14, y: 10 },
    park: { x: 0, y: -11 },
    civic: { x: -10, y: -7 },
    entertainment: { x: -14, y: -10 },
  };
  return offsets[category];
}

function groupIcon(category: EntertainmentPlaceCategory, count: number) {
  const meta = CATEGORY_META[category];
  const offset = groupOffset(category);
  return L.divIcon({
    className: "",
    html: `<div data-place-marker="${escapeHtml(category)}" style="
      display:flex;align-items:center;gap:6px;
      transform:translate(-50%,-50%) translate(${offset.x}px, ${offset.y}px);
      border:1px solid rgba(38,49,38,0.14);
      border-radius:999px;
      background:rgba(255,249,238,0.97);
      color:${COLORS.ink};
      padding:5px 8px 5px 5px;
      box-shadow:0 8px 22px rgba(38,49,38,0.18);
      font:800 12px/1 'SF Pro Text','Inter',system-ui,sans-serif;
      white-space:nowrap;
    ">
      <span style="
        display:flex;align-items:center;justify-content:center;
        min-width:26px;height:22px;border-radius:999px;
        background:${meta.color};color:white;
      ">${count}</span>
      ${escapeHtml(meta.label)}
    </div>`,
    iconSize: [110, 30],
    iconAnchor: [55, 15],
  });
}

export function placeIcon(place: EntertainmentPlace) {
  const meta = CATEGORY_META[place.category];
  const offset = placeOffset(place.category);
  return L.divIcon({
    className: "",
    html: `<div data-place-marker="${escapeHtml(place.category)}" style="
      display:flex;align-items:center;justify-content:center;
      transform:translate(${offset.x}px, ${offset.y}px);
      width:24px;height:24px;border-radius:999px;
      background:${meta.color};
      border:2px solid ${COLORS.cream};
      box-shadow:0 7px 18px rgba(38,49,38,0.24);
      color:white;
      font:900 11px/1 system-ui,sans-serif;
    ">${escapeHtml(meta.label[0])}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function routeLabelIcon(title: string, tone: "route" | "warning" = "route") {
  const color = tone === "warning" ? COLORS.terracotta : COLORS.sageStrong;
  return L.divIcon({
    className: "",
    html: `<div style="
      transform:translate(-50%,-50%);
      white-space:nowrap;
      border:1px solid rgba(111,141,95,0.28);
      border-radius:999px;
      background:rgba(255,249,238,0.97);
      color:${color};
      padding:6px 10px;
      font:800 12px/1 'SF Pro Text','Inter',system-ui,sans-serif;
      box-shadow:0 8px 22px rgba(38,49,38,0.2);
    ">${escapeHtml(title)}</div>`,
    iconSize: [240, 28],
    iconAnchor: [120, 14],
  });
}

function routeMidpoint(action: Extract<MapAction, { type: "commute_route" }>): [number, number] {
  const points = action.geometry?.length ? action.geometry : [toLatLng(action.origin), toLatLng(action.destination)];
  return points[Math.floor(points.length / 2)] ?? toLatLng(action.origin);
}

function groupedPlaces(places: EntertainmentPlace[]) {
  return CATEGORY_ORDER.flatMap((category) => {
    const items = places.filter((place) => place.category === category);
    if (!items.length) return [];
    const lat = items.reduce((sum, place) => sum + place.lat, 0) / items.length;
    const lng = items.reduce((sum, place) => sum + place.lng, 0) / items.length;
    return [{ category, count: items.length, lat, lng, items }];
  });
}

export function areaStyle(selected: boolean) {
  if (selected) {
    return {
      color: COLORS.terracotta,
      fillColor: COLORS.sageSoft,
      fillOpacity: 0.78,
      opacity: 0.96,
      weight: 4,
    };
  }
  return {
    color: COLORS.dimStroke,
    fillColor: COLORS.dimFill,
    fillOpacity: 0.18,
    opacity: 0.24,
    weight: 1,
  };
}

export function SimulationMap({
  neighborhoodName,
  neighborhoodCoords,
  workplaceCoords,
  workplaceName,
  mapActions = [],
}: SimulationMapProps) {
  const [areas, setAreas] = useState<CommunityAreaMapArea[]>([]);
  const [places, setPlaces] = useState<EntertainmentPlace[]>([]);
  const [activeCategories, setActiveCategories] = useState<Set<EntertainmentPlaceCategory>>(
    () => new Set(CATEGORY_ORDER),
  );
  const [zoom, setZoom] = useState(13);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/community-areas")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: unknown) => {
        if (!cancelled) setAreas(validAreas(data));
      })
      .catch(() => {
        if (!cancelled) setAreas([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      neighborhood: neighborhoodName,
      limit: "120",
    });
    fetch(`/api/places?${params.toString()}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: unknown) => {
        if (controller.signal.aborted) return;
        const rawPlaces = data && typeof data === "object" ? (data as { places?: unknown }).places : null;
        const nextPlaces = Array.isArray(rawPlaces)
          ? rawPlaces.map(validPlace).filter((place): place is EntertainmentPlace => Boolean(place))
          : [];
        setPlaces(nextPlaces);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setPlaces([]);
      });
    return () => controller.abort();
  }, [neighborhoodName]);

  const selectedArea = useMemo(
    () => areas.find((area) => normalizeName(area.name) === normalizeName(neighborhoodName)) ?? null,
    [areas, neighborhoodName],
  );
  const boundaryAreas = useMemo(
    () => areas.filter((area) => Boolean(area.boundaryGeojson)),
    [areas],
  );
  const actionPlaces = useMemo(
    () => mapActions.flatMap((action) => (action.type === "entertainment_summary" ? action.places ?? [] : [])),
    [mapActions],
  );
  const mergedPlaces = useMemo(() => {
    const byId = new Map<string, EntertainmentPlace>();
    [...places, ...actionPlaces].forEach((place) => byId.set(place.id, place));
    return [...byId.values()].filter((place) => activeCategories.has(place.category));
  }, [actionPlaces, activeCategories, places]);
  const placeGroups = useMemo(() => groupedPlaces(mergedPlaces), [mergedPlaces]);
  const fitPoints: [number, number][] = [
    [neighborhoodCoords.lat, neighborhoodCoords.lng],
    ...pointsFromActions(mapActions),
    ...(workplaceCoords ? [[workplaceCoords.lat, workplaceCoords.lng] as [number, number]] : []),
  ];

  function toggleCategory(category: EntertainmentPlaceCategory) {
    setActiveCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next.size ? next : new Set(CATEGORY_ORDER);
    });
  }

  return (
    <div className="atlas-map-shell relative h-full w-full overflow-hidden bg-[color:var(--sage-50)]">
      <MapContainer
        center={[neighborhoodCoords.lat, neighborhoodCoords.lng]}
        zoom={13}
        className="h-full w-full"
        zoomControl={false}
        zoomSnap={0.25}
        zoomDelta={0.5}
        scrollWheelZoom
      >
        <ZoomControl position="bottomleft" />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          opacity={0.5}
        />
        <TrackZoom onZoom={setZoom} />
        <FitBounds selectedArea={selectedArea} points={fitPoints} />

        {boundaryAreas.map((area) => {
          const selected = selectedArea?.communityAreaNumber === area.communityAreaNumber;
          return (
            <GeoJSONLayer
              key={`${area.communityAreaNumber}-${selected}`}
              data={area.boundaryGeojson as GeoJSON.GeoJsonObject}
              interactive={false}
              style={() => areaStyle(selected)}
            />
          );
        })}

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

          const topTypes = action.byType
            ? Object.entries(action.byType)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([type, count]) => `${type.charAt(0).toUpperCase() + type.slice(1)} ${count}`)
                .join(" · ")
            : null;

          const crimePopup = (
            <Popup>
              <div className="min-w-[190px] text-xs text-[#263126]">
                <p className="font-semibold">{action.neighborhood}</p>
                <p className="mt-1">{action.label}</p>
                <p className="mt-1 text-[#53616b]">
                  {action.cityAverage
                    ? `${action.total} reports vs ${Math.round(action.cityAverage)} city average`
                    : `${action.total} reports this month`}
                </p>
                {topTypes && <p className="mt-1 text-[#53616b]">{topTypes}</p>}
              </div>
            </Popup>
          );

          if (data) {
            return (
              <GeoJSONLayer key={action.id} data={data} style={() => pathOptions}>
                {crimePopup}
              </GeoJSONLayer>
            );
          }

          return (
            <Circle key={action.id} center={toLatLng(action.center)} radius={1150} pathOptions={pathOptions}>
              {crimePopup}
            </Circle>
          );
        })}

        {mapActions.map((action) => {
          if (action.type !== "commute_route") return null;
          const positions = action.geometry?.length
            ? action.geometry
            : action.mode === "transit"
              ? []
              : [toLatLng(action.origin), toLatLng(action.destination)];
          const hasGeometry = positions.length >= 2;

          return (
            <Fragment key={action.id}>
              {hasGeometry && (
                <Polyline
                  positions={positions}
                  pathOptions={{
                    color: action.mode === "transit" ? COLORS.lake : COLORS.sageStrong,
                    opacity: 0.86,
                    weight: action.mode === "transit" ? 6 : 5,
                    dashArray: action.source === "estimate" ? "10 8" : undefined,
                  }}
                />
              )}
              <Marker
                position={hasGeometry ? routeMidpoint(action) : toLatLng(action.origin)}
                icon={routeLabelIcon(hasGeometry ? action.title : "Transit route unavailable", hasGeometry ? "route" : "warning")}
              >
                <Popup>
                  <div className="min-w-[230px] text-xs text-[#263126]">
                    <p className="font-semibold">{action.originName} to {action.destinationName}</p>
                    <p className="mt-1">
                      {action.estimatedMinutes ? `About ${action.estimatedMinutes} minutes` : "Commute estimate"}
                      {action.distanceMiles !== null ? ` over ${action.distanceMiles.toFixed(1)} miles` : ""}
                      {action.routeLabel ? ` · ${action.routeLabel}` : ""}
                    </p>
                    <p className="mt-1 text-[#53616b]">{action.caveat}</p>
                    {action.segments?.length ? (
                      <div className="mt-2 grid gap-1 border-t border-[#eadcca] pt-2">
                        {action.segments.map((segment, index) => (
                          <p key={`${segment.label}-${index}`} className="font-semibold text-[#53616b]">
                            {segment.label}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </Popup>
              </Marker>
            </Fragment>
          );
        })}

        {mapActions.map((action) => {
          if (action.type !== "transit_stops") return null;
          return action.stops.map((stop) => (
            <CircleMarker
              key={`${action.id}-${stop.name}-${stop.lat}-${stop.lng}`}
              center={[stop.lat, stop.lng]}
              radius={stop.mode === "rail" ? 6 : 5}
              pathOptions={{
                color: stop.mode === "rail" ? "#1a8cff" : "#f59e0b",
                fillColor: stop.mode === "rail" ? "#1a8cff" : "#f59e0b",
                fillOpacity: 0.9,
                weight: 1.5,
              }}
            >
              <Popup>
                <div className="text-xs text-[#263126]">
                  <p className="font-semibold">{stop.name}</p>
                  <p className="mt-1 text-[#53616b]">{stop.routeLabel}</p>
                </div>
              </Popup>
            </CircleMarker>
          ));
        })}

        {workplaceCoords && (
          <Marker position={[workplaceCoords.lat, workplaceCoords.lng]} icon={workplaceIcon()} zIndexOffset={720}>
            <Tooltip direction="top" offset={[0, -13]} opacity={0.96}>
              <span className="text-xs font-bold text-[#263126]">{workplaceName ?? "Workplace"}</span>
            </Tooltip>
            <Popup>
              <span className="text-xs font-semibold">{workplaceName ?? "Workplace"}</span>
            </Popup>
          </Marker>
        )}

        {zoom < 14
          ? placeGroups.map((group) => (
              <Marker
                key={`group-${group.category}`}
                position={[group.lat, group.lng]}
                icon={groupIcon(group.category, group.count)}
                zIndexOffset={620}
              >
                <Popup>
                  <div className="min-w-[210px] text-xs text-[#263126]">
                    <p className="font-bold">{CATEGORY_META[group.category].label}</p>
                    <p className="mt-1 text-[#53616b]">{group.count} local places loaded near {neighborhoodName}.</p>
                    <div className="mt-2 grid gap-1">
                      {group.items.slice(0, 5).map((place) => (
                        <p key={place.id} className="font-semibold">{place.name}</p>
                      ))}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))
          : mergedPlaces.map((place) => (
              <Marker
                key={place.id}
                position={[place.lat, place.lng]}
                icon={placeIcon(place)}
                zIndexOffset={650}
              >
                <Tooltip direction="top" offset={[0, -12]} opacity={0.96}>
                  <span className="text-xs font-bold text-[#263126]">{place.name}</span>
                </Tooltip>
                <Popup>
                  <div className="min-w-[210px] text-xs text-[#263126]">
                    <p className="font-bold">{place.name}</p>
                    <p className="mt-1 text-[#53616b]">{CATEGORY_META[place.category].label}</p>
                    {place.address && <p className="mt-1 text-[#53616b]">{place.address}</p>}
                    {place.description && <p className="mt-1">{place.description}</p>}
                    {place.source && <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#66715f]">{place.source}</p>}
                  </div>
                </Popup>
              </Marker>
            ))}
      </MapContainer>

      <div className="pointer-events-none absolute left-3 top-16 z-[850] flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1.5 sm:left-4 sm:max-w-[520px]">
        {CATEGORY_ORDER.map((category) => {
          const meta = CATEGORY_META[category];
          const Icon = meta.Icon;
          const active = activeCategories.has(category);
          return (
            <button
              key={category}
              type="button"
              aria-pressed={active}
              onClick={() => toggleCategory(category)}
              className={`pointer-events-auto inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] border px-2.5 text-xs font-bold shadow-sm backdrop-blur transition ${
                active
                  ? "border-white/70 bg-[rgba(255,249,238,0.94)] text-[color:var(--foreground)]"
                  : "border-white/30 bg-black/35 text-white/78 hover:bg-black/50"
              }`}
            >
              <Icon size={13} strokeWidth={1.9} style={{ color: active ? meta.color : "currentColor" }} />
              {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
