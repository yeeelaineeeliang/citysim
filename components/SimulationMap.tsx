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
import type { ActSeason } from "@/app/sim/types";
import { SeasonalAtmosphere } from "./SeasonalAtmosphere";

interface SimulationMapProps {
  neighborhoodName: string;
  neighborhoodCoords: { lat: number; lng: number };
  workplaceCoords?: { lat: number; lng: number } | null;
  workplaceName?: string;
  mapActions?: MapAction[];
  season?: ActSeason;
  /** Plain-language name of what Sam's answer staged on the map; null = default "at a glance" view. */
  stageTitle?: string | null;
  /** Sends a question into the Sam chat panel — connects map clicks to the conversation. */
  onAskSam?: (question: string) => void;
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
      // flyToBounds so restaged evidence reads as a camera move, not a cut.
      map.flyToBounds(bounds, { padding: [16, 16], maxZoom: 15.25, duration: 0.9 });
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

export function homeIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="
      display:flex;align-items:center;justify-content:center;
      width:26px;height:26px;border-radius:999px;
      background:${COLORS.sageStrong};
      border:2px solid ${COLORS.cream};
      color:white;
      font:900 11px/1 'SF Pro Text','Inter',system-ui,sans-serif;
      box-shadow:0 8px 20px rgba(38,49,38,0.28);
    ">H</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

/**
 * Category-scoped question a marker click can hand to the Sam chat panel.
 * Phrasing deliberately includes the demo-QA keyword for each category so
 * demo mode gets a real canned answer instead of a miss.
 */
function askQuestionForPlace(place: EntertainmentPlace): string {
  switch (place.category) {
    case "food":
      return `Where do people actually eat around ${place.name}?`;
    case "bar":
      return `What's the bar scene like near ${place.name}?`;
    case "park":
      return `Is ${place.name} a good park for a weekend?`;
    case "civic":
      return `How are city services around ${place.name}?`;
    case "entertainment":
      return `What's fun to do near ${place.name}?`;
  }
}

function AskSamButton({ question, onAskSam }: { question: string; onAskSam?: (question: string) => void }) {
  if (!onAskSam) return null;
  return (
    <button
      type="button"
      onClick={() => onAskSam(question)}
      className="mt-2 w-full rounded-[var(--radius-sm)] border border-[color:var(--sage)] bg-[color:var(--sage-50)] px-2.5 py-1.5 text-xs font-bold text-[color:var(--sage-strong)] transition-colors hover:bg-[color:var(--sage-100)]"
    >
      Ask Sam about this →
    </button>
  );
}

export function workplaceIcon() {
  return L.divIcon({
    className: "",
    html: `<div class="sim-workplace-pulse" style="
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

export function placeIcon(place: EntertainmentPlace, staggerIndex = 0) {
  const meta = CATEGORY_META[place.category];
  const offset = placeOffset(place.category);
  // Outer div only ever handles the static category-cluster offset; the
  // entrance animation's transform lives on the inner div so the two never
  // fight over the `transform` property.
  return L.divIcon({
    className: "",
    html: `<div data-place-marker="${escapeHtml(place.category)}" style="transform:translate(${offset.x}px, ${offset.y}px);">
      <div class="sim-marker-in" style="
        display:flex;align-items:center;justify-content:center;
        animation-delay:${Math.min(staggerIndex, 12) * 35}ms;
        width:24px;height:24px;border-radius:999px;
        background:${meta.color};
        border:2px solid ${COLORS.cream};
        box-shadow:0 7px 18px rgba(38,49,38,0.24);
        color:white;
        font:900 11px/1 system-ui,sans-serif;
      ">${escapeHtml(meta.label[0])}</div>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function routeLabelIcon(title: string, tone: "route" | "estimated" | "warning" = "route") {
  const styleByTone = {
    route: { color: COLORS.sageStrong, border: "1px solid rgba(111,141,95,0.28)" },
    estimated: { color: COLORS.muted, border: "1px dashed rgba(110,116,116,0.45)" },
    warning: { color: COLORS.terracotta, border: "1px solid rgba(185,95,63,0.35)" },
  } as const;
  const { color, border } = styleByTone[tone];
  return L.divIcon({
    className: "",
    html: `<div style="
      transform:translate(-50%,-50%);
      white-space:nowrap;
      border:${border};
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
  season,
  stageTitle,
  onAskSam,
}: SimulationMapProps) {
  const [areas, setAreas] = useState<CommunityAreaMapArea[]>([]);
  const [places, setPlaces] = useState<EntertainmentPlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState(true);
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
    setPlacesLoading(true);
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
      })
      .finally(() => {
        if (!controller.signal.aborted) setPlacesLoading(false);
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
  const hasAnyPlaceData = places.length > 0 || actionPlaces.length > 0;
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
      {season && <SeasonalAtmosphere season={season} />}
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
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          subdomains="abcd"
          maxZoom={19}
          opacity={1}
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
              <div className="min-w-[190px] text-xs text-[color:var(--foreground)]">
                <p className="font-semibold">{action.neighborhood}</p>
                <p className="mt-1">{action.label}</p>
                <p className="mt-1 text-[color:var(--muted)]">
                  {action.cityAverage
                    ? `${action.total} reports vs ${Math.round(action.cityAverage)} city average`
                    : `${action.total} reports this month`}
                </p>
                {topTypes && <p className="mt-1 text-[color:var(--muted)]">{topTypes}</p>}
                <AskSamButton question="Is it safe here this season?" onAskSam={onAskSam} />
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
                    // Confident routes get a flowing dash so the commute reads as a
                    // live path; estimated routes stay static-dashed on purpose —
                    // motion here would overstate confidence the data doesn't have.
                    className: action.source === "estimate" ? undefined : "sim-route-flow",
                  }}
                />
              )}
              <Marker position={toLatLng(action.origin)} icon={homeIcon()} zIndexOffset={700}>
                <Tooltip direction="top" offset={[0, -13]} opacity={0.96}>
                  <span className="text-xs font-bold text-[#263126]">Home base · {action.originName}</span>
                </Tooltip>
                <Popup>
                  <div className="text-xs text-[color:var(--foreground)]">
                    <p className="font-semibold">Home base · {action.originName}</p>
                    <p className="mt-1 text-[color:var(--muted)]">Where your simulated day starts and ends.</p>
                  </div>
                </Popup>
              </Marker>
              <Marker
                position={hasGeometry ? routeMidpoint(action) : toLatLng(action.origin)}
                icon={routeLabelIcon(
                  hasGeometry ? action.title : "Transit route unavailable",
                  !hasGeometry ? "warning" : action.source === "estimate" ? "estimated" : "route",
                )}
                zIndexOffset={800}
              >
                <Popup>
                  <div className="min-w-[230px] text-xs text-[color:var(--foreground)]">
                    <p className="font-semibold">{action.originName} to {action.destinationName}</p>
                    <p className="mt-1">
                      {action.estimatedMinutes ? `About ${action.estimatedMinutes} minutes` : "Commute estimate"}
                      {action.distanceMiles !== null ? ` over ${action.distanceMiles.toFixed(1)} miles` : ""}
                      {action.routeLabel ? ` · ${action.routeLabel}` : ""}
                    </p>
                    <p className="mt-1 text-[color:var(--muted)]">{action.caveat}</p>
                    {action.segments?.length ? (
                      <div className="mt-2 grid gap-1 border-t border-[color:var(--panel-border)] pt-2">
                        {action.segments.map((segment, index) => (
                          <p key={`${segment.label}-${index}`} className="font-semibold text-[color:var(--muted)]">
                            {segment.label}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    <AskSamButton question="What is my morning commute like?" onAskSam={onAskSam} />
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
                <div className="text-xs text-[color:var(--foreground)]">
                  <p className="font-semibold">{stop.name}</p>
                  <p className="mt-1 text-[color:var(--muted)]">{stop.routeLabel}</p>
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
                  <div className="min-w-[210px] text-xs text-[color:var(--foreground)]">
                    <p className="font-bold">{CATEGORY_META[group.category].label}</p>
                    <p className="mt-1 text-[color:var(--muted)]">{group.count} local places loaded near {neighborhoodName}.</p>
                    <div className="mt-2 grid gap-1">
                      {group.items.slice(0, 5).map((place) => (
                        <p key={place.id} className="font-semibold">{place.name}</p>
                      ))}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))
          : mergedPlaces.map((place, index) => (
              <Marker
                key={place.id}
                position={[place.lat, place.lng]}
                icon={placeIcon(place, index)}
                zIndexOffset={650}
              >
                <Tooltip direction="top" offset={[0, -12]} opacity={0.96}>
                  <span className="text-xs font-bold text-[#263126]">{place.name}</span>
                </Tooltip>
                <Popup>
                  <div className="min-w-[220px] max-w-[260px] text-[13px] text-[color:var(--foreground)]">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
                        style={{ background: CATEGORY_META[place.category].color }}
                      >
                        {(() => {
                          const Icon = CATEGORY_META[place.category].Icon;
                          return <Icon size={14} strokeWidth={2.2} />;
                        })()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-bold leading-tight">{place.name}</p>
                        <p
                          className="text-[10px] font-bold uppercase tracking-[0.06em]"
                          style={{ color: CATEGORY_META[place.category].color }}
                        >
                          {CATEGORY_META[place.category].label}
                        </p>
                      </div>
                    </div>
                    {place.address && <p className="mt-2 text-[color:var(--muted)]">{place.address}</p>}
                    {place.description && <p className="mt-1">{place.description}</p>}
                    <div className="mt-2 flex items-center gap-1.5 border-t border-[color:var(--panel-border)] pt-2 text-[10px] font-semibold uppercase tracking-[0.05em] text-[color:var(--muted)]">
                      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--sage)]" />
                      {place.source ? `Source: ${place.source}` : "Unverified local listing — confirm before visiting"}
                    </div>
                    <AskSamButton question={askQuestionForPlace(place)} onAskSam={onAskSam} />
                  </div>
                </Popup>
              </Marker>
            ))}
      </MapContainer>

      <div className="pointer-events-none absolute left-3 top-16 z-[850] flex max-w-[calc(100%-1.5rem)] flex-col items-start gap-2 sm:left-4 sm:max-w-[520px]">
        <div className="rounded-[var(--radius-md)] border border-white/40 bg-black/55 px-3 py-2 backdrop-blur">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/50">
            {stageTitle ? "Sam's evidence" : "At a glance"}
          </p>
          <p className="max-w-[300px] text-xs font-bold leading-snug text-white">
            {stageTitle ?? `${neighborhoodName} essentials — home, work, and local places`}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_ORDER.map((category) => {
            const meta = CATEGORY_META[category];
            const Icon = meta.Icon;
            const active = activeCategories.has(category);
            return (
              <button
                key={category}
                type="button"
                aria-pressed={active}
                aria-label={meta.label}
                onClick={() => toggleCategory(category)}
                className={`pointer-events-auto inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] border px-2.5 text-xs font-bold shadow-sm backdrop-blur transition ${
                  active
                    ? "border-white/70 bg-[rgba(255,249,238,0.94)] text-[color:var(--foreground)]"
                    : "border-white/30 bg-black/35 text-white/78 hover:bg-black/50"
                }`}
              >
                <Icon size={13} strokeWidth={1.9} style={{ color: active ? meta.color : "currentColor" }} />
                <span className="hidden sm:inline">{meta.label}</span>
              </button>
            );
          })}
        </div>

        {!placesLoading && !hasAnyPlaceData && (
          <div className="max-w-[280px] rounded-[var(--radius-md)] border border-white/40 bg-black/45 px-3 py-2 text-[11px] font-semibold leading-snug text-white/85 backdrop-blur">
            No verified restaurants, bars, parks, or venues loaded for {neighborhoodName} yet — place coverage is currently strongest in Hyde Park.
          </div>
        )}
      </div>

      <details className="absolute bottom-8 right-3 z-[850] rounded-[var(--radius-md)] border border-white/40 bg-black/55 text-white/90 backdrop-blur">
        <summary className="cursor-pointer list-none px-3 py-1.5 text-[11px] font-bold">Legend ▸</summary>
        <div className="grid gap-1.5 px-3 pb-2.5 text-[11px] font-semibold">
          <span className="flex items-center gap-2">
            <span className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-black text-white" style={{ background: COLORS.sageStrong }}>H</span>
            Home base
          </span>
          <span className="flex items-center gap-2">
            <span className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-black text-white" style={{ background: COLORS.ink }}>W</span>
            Workplace
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: COLORS.lake }} />
            Confirmed route
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: COLORS.muted }} />
            Estimated route
          </span>
          <span className="flex items-center gap-2">
            <span className="flex gap-0.5">
              {CATEGORY_ORDER.slice(0, 3).map((category) => (
                <span key={category} className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY_META[category].color }} />
              ))}
            </span>
            Place categories
          </span>
        </div>
      </details>
    </div>
  );
}
