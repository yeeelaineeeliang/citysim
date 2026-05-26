"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  ShieldAlert,
  TrainFront,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import {
  GeoJSON as GeoJSONLayer,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import {
  getFallbackCommunityAreas,
  type CommunityAreaMapArea,
} from "@/lib/communityAreaMap";
import type { UserProfile } from "@/lib/tools/types";

export interface CommunityAreaMapMatch {
  communityAreaNumber: number;
  name: string;
  slug?: string;
  descriptors?: string[];
  matchReason?: string;
  rank: number;
}

interface CommunityAreaBlockMapProps {
  selectedName: string;
  onSelect: (name: string) => void;
  onConfirm: (name: string) => void;
  matches?: CommunityAreaMapMatch[];
  mode?: "browse" | "match";
  workplaceCoords?: { lat: number; lng: number } | null;
  workplaceName?: string;
  budgetRange?: string;
  monthlyBudget?: number;
  commutePref?: UserProfile["commutePref"];
  priorities?: UserProfile["priorities"];
  month?: number;
  year?: number;
}

type PreviewTone = "good" | "neutral" | "caution" | "unknown";
type PreviewCommuteTone = Exclude<PreviewTone, "unknown"> | "unavailable";
type MapPoint = { lat: number; lng: number };

interface CommunityAreaPreviewRankItem {
  rank: number | null;
  total: number;
  label: string;
  tone: PreviewTone;
}

interface CommunityAreaPreview {
  neighborhood: string;
  fitLine: string;
  verdict?: { label: string; tone: PreviewTone };
  rank?: {
    overall: CommunityAreaPreviewRankItem;
    commute: CommunityAreaPreviewRankItem;
  };
  commute: {
    label: string;
    confidence: "medium" | "low" | "unavailable";
    tone?: PreviewCommuteTone;
    minutes?: number | null;
  };
  budget: { label: string; tone: "good" | "neutral" | "unknown" };
  safety: { label: string; tone: "good" | "neutral" | "caution" | "unknown" };
  activity: { label: string; tone: "good" | "neutral" | "unknown" };
}

const COLORS = {
  ink: "#263126",
  muted: "#66715f",
  cream: "#fff9ee",
  line: "#f4e6d3",
  outline: "#3f4c37",
  sage: "#6f8d5f",
  sageSoft: "#dbe4cf",
  sageStrong: "#4f6f45",
  terracotta: "#c76545",
  amber: "#e7ad4e",
  amberSoft: "#f4d49a",
  dimFill: "#d7d5cc",
  dimStroke: "#8f9187",
};

const AREA_PALETTE = [
  { fill: "#d9e4cc", stroke: "#789365" }, // sage
  { fill: "#d7dfba", stroke: "#7d8e45" }, // moss
  { fill: "#f2d4c4", stroke: "#c76545" }, // clay
  { fill: "#f4d99d", stroke: "#d59b36" }, // amber
  { fill: "#e6dfb6", stroke: "#9b9552" }, // olive
  { fill: "#f4cdb4", stroke: "#d18454" }, // peach
  { fill: "#c9ded7", stroke: "#5f9085" }, // muted teal
  { fill: "#ead0cd", stroke: "#bd7471" }, // soft rose
  { fill: "#d4e0be", stroke: "#6f8d5f" },
  { fill: "#f0ddbf", stroke: "#b9874d" },
];

const RANK_COLORS = ["#C76545", "#D09B36", "#4F6F45", "#5F9085", "#BD7471"];

const INITIAL_AREAS = getFallbackCommunityAreas();
const previewCache = new Map<string, CommunityAreaPreview>();

function areaBounds(area: CommunityAreaMapArea): L.LatLngBounds {
  if (area.boundaryGeojson) {
    const bounds = L.geoJSON(area.boundaryGeojson).getBounds();
    if (bounds.isValid()) return bounds;
  }

  const center = L.latLng(area.lat, area.lng);
  return L.latLngBounds(center, center).pad(0.12);
}

function areasBounds(areas: CommunityAreaMapArea[]): L.LatLngBounds | null {
  const validBounds = areas
    .map(areaBounds)
    .filter((bounds) => bounds.isValid());
  if (!validBounds.length) return null;
  const bounds = validBounds[0];
  validBounds.slice(1).forEach((item) => bounds.extend(item));
  return bounds;
}

function distanceMiles(a: MapPoint, b: MapPoint): number {
  const radiusMiles = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng *
      sinLng;
  return radiusMiles * 2 * Math.asin(Math.sqrt(h));
}

function rankBadgePosition(
  area: CommunityAreaMapArea,
  rank?: number,
  workplaceCoords?: MapPoint | null,
): [number, number] {
  const bounds = areaBounds(area);
  const center = bounds.isValid() ? bounds.getCenter() : L.latLng(area.lat, area.lng);
  let lat = center.lat;
  let lng = center.lng;

  if (rank === 4) {
    lng -= 0.018;
  }

  if (workplaceCoords && distanceMiles(center, workplaceCoords) <= 0.55) {
    lat += 0.0045;
    lng -= 0.0045;
  }
  return [lat, lng];
}

function extendWithNearbyWorkplace(
  bounds: L.LatLngBounds,
  area: CommunityAreaMapArea,
  workplaceCoords?: MapPoint | null,
  workplaceCalloutCoords?: [number, number] | null,
): L.LatLngBounds {
  if (!workplaceCoords) return bounds;
  if (distanceMiles(area, workplaceCoords) <= 4.5) {
    bounds.extend([workplaceCoords.lat, workplaceCoords.lng]);
    if (workplaceCalloutCoords) bounds.extend(workplaceCalloutCoords);
  }
  return bounds;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function rankColor(rank?: number) {
  if (!rank || rank < 1) return COLORS.sageStrong;
  return RANK_COLORS[rank - 1] ?? RANK_COLORS[RANK_COLORS.length - 1] ?? COLORS.sageStrong;
}

function mapLabelName(name: string) {
  return name
    .replace(/\bSquare\b/g, "Sq.")
    .replace(/\bPark\b/g, "Pk.");
}

function getAreaColor(communityAreaNumber: number) {
  const index = Math.abs((communityAreaNumber * 5 + Math.floor(communityAreaNumber / 6)) % AREA_PALETTE.length);
  return AREA_PALETTE[index] ?? AREA_PALETTE[0];
}

function areaStyle({
  areaColor,
  selected,
  hovered,
  searched,
  matchRank,
  dimmed,
}: {
  areaColor: ReturnType<typeof getAreaColor>;
  selected: boolean;
  hovered: boolean;
  searched: boolean;
  matchRank?: number;
  dimmed?: boolean;
}) {
  const matchColor = matchRank ? rankColor(matchRank) : null;
  const stateColor = searched ? COLORS.amber : matchColor ?? areaColor.stroke;
  if (dimmed && !selected && !hovered && !searched) {
    return {
      color: COLORS.dimStroke,
      fillColor: COLORS.dimFill,
      fillOpacity: 0.24,
      opacity: 0.34,
      weight: 0.7,
    };
  }

  return {
    color: selected ? stateColor : hovered || searched || matchRank ? stateColor : areaColor.stroke,
    fillColor: matchColor ?? areaColor.fill,
    fillOpacity: selected ? 0.42 : hovered ? 0.34 : searched ? 0.32 : matchRank ? 0.28 : 0.72,
    opacity: selected || hovered || searched || matchRank ? 0.95 : 0.78,
    weight: selected ? 2.5 : searched ? 2 : hovered || matchRank ? 1.75 : 0.9,
  };
}

const cityOutlineStyle = {
  color: COLORS.outline,
  fillColor: COLORS.cream,
  fillOpacity: 0,
  opacity: 0.92,
  weight: 3.25,
  dashArray: "0",
};

function geoJsonFeatures(
  geojson: GeoJSON.GeoJsonObject | null | undefined,
): GeoJSON.Feature<GeoJSON.Geometry>[] {
  if (!geojson) return [];
  const typedGeojson = geojson as { type?: string };
  if (typedGeojson.type === "FeatureCollection") {
    const collection = geojson as GeoJSON.FeatureCollection<GeoJSON.Geometry>;
    return collection.features.filter((feature): feature is GeoJSON.Feature<GeoJSON.Geometry> =>
      Boolean(feature.geometry),
    );
  }
  if (typedGeojson.type === "Feature") {
    const feature = geojson as GeoJSON.Feature<GeoJSON.Geometry>;
    return feature.geometry ? [feature] : [];
  }
  return [
    {
      type: "Feature",
      properties: {},
      geometry: geojson as GeoJSON.Geometry,
    },
  ];
}

function rankBadgeIcon(match: CommunityAreaMapMatch, selected: boolean) {
  const color = rankColor(match.rank);
  return L.divIcon({
    className: "community-area-rank-badge-marker",
    html: `<div style="
      display:flex;align-items:center;justify-content:center;
      width:176px;height:40px;
    ">
      <div style="
        display:inline-flex;align-items:center;gap:7px;max-width:168px;
        border:${selected ? 2 : 1.5}px solid ${color};
        border-radius:999px;background:rgba(255,249,238,0.97);
        color:${COLORS.ink};padding:4px 10px 4px 4px;
        box-shadow:${selected ? "0 6px 16px rgba(38,49,38,0.22)" : "0 4px 12px rgba(38,49,38,0.16)"};
        font-family:'Avenir Next','Segoe UI Rounded',system-ui,sans-serif;
      ">
        <span style="
          display:flex;align-items:center;justify-content:center;flex:0 0 auto;
          width:28px;height:28px;border-radius:999px;background:${color};
          color:white;font-size:12px;font-weight:850;line-height:1;
        ">${match.rank}</span>
        <span style="
          min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
          font-size:12px;font-weight:850;line-height:1.1;
        ">${escapeHtml(mapLabelName(match.name))}</span>
      </div>
    </div>`,
    iconSize: [176, 40],
    iconAnchor: [88, 20],
  });
}

function workplaceIcon() {
  return L.divIcon({
    className: "community-area-workplace-dot-marker",
    html: `<div style="
      width:14px;height:14px;border-radius:999px;
      background:${COLORS.terracotta};border:2px solid ${COLORS.cream};
      box-shadow:0 0 0 2px rgba(199,101,69,0.24),0 4px 10px rgba(38,49,38,0.22);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function cleanWorkplaceLabel(name?: string) {
  const trimmed = name?.trim();
  if (!trimmed) return "Workplace";
  const withoutCity = trimmed.replace(/,\s*Chicago(?:,\s*(?:IL|Illinois))?$/i, "").trim();
  if (/university of chicago/i.test(withoutCity)) return "UChicago";
  if (!withoutCity || /^anchor$/i.test(withoutCity)) return "Workplace";
  return withoutCity.length > 24 ? `${withoutCity.slice(0, 21).trim()}...` : withoutCity;
}

function workplaceCalloutIcon(label: string) {
  return L.divIcon({
    className: "community-area-workplace-callout-marker",
    html: `<div style="
      display:flex;align-items:center;justify-content:center;
      min-width:86px;max-width:154px;height:30px;padding:0 12px;
      border:1.5px solid ${COLORS.terracotta};border-radius:999px;
      background:rgba(255,249,238,0.98);color:${COLORS.ink};
      box-shadow:0 5px 14px rgba(38,49,38,0.18);
      font-family:'Avenir Next','Segoe UI Rounded',system-ui,sans-serif;
      font-size:12px;font-weight:850;line-height:1;white-space:nowrap;
      overflow:hidden;text-overflow:ellipsis;
    ">${escapeHtml(label)}</div>`,
    iconSize: [132, 30],
    iconAnchor: [66, 15],
  });
}

function workplaceCalloutPosition({
  workplaceCoords,
  rankedLabels,
  selectedArea,
}: {
  workplaceCoords: MapPoint;
  rankedLabels: { area: CommunityAreaMapArea; match: CommunityAreaMapMatch }[];
  selectedArea: CommunityAreaMapArea | null;
}): [number, number] {
  const badgePoints = rankedLabels.map(({ area, match }) => rankBadgePosition(area, match.rank, workplaceCoords));
  const selectedHasBadge = rankedLabels.some(
    ({ area }) => selectedArea?.communityAreaNumber === area.communityAreaNumber,
  );
  if (selectedArea && !selectedHasBadge) {
    badgePoints.push(rankBadgePosition(selectedArea, undefined, workplaceCoords));
  }

  const isNearBadge = badgePoints.some(([lat, lng]) => distanceMiles(workplaceCoords, { lat, lng }) <= 0.75);
  const offset = isNearBadge
    ? { lat: -0.0048, lng: 0.0105 }
    : { lat: 0.0058, lng: 0.0086 };
  return [workplaceCoords.lat + offset.lat, workplaceCoords.lng + offset.lng];
}

function descriptorText(area: CommunityAreaMapArea) {
  return area.descriptors.slice(0, 3).join(" · ");
}

function FitMap({
  areas,
  focusArea,
  selectedArea,
  matchedAreas,
  workplaceCoords,
  workplaceCalloutCoords,
}: {
  areas: CommunityAreaMapArea[];
  focusArea: CommunityAreaMapArea | null;
  selectedArea: CommunityAreaMapArea | null;
  matchedAreas: CommunityAreaMapArea[];
  workplaceCoords?: MapPoint | null;
  workplaceCalloutCoords?: [number, number] | null;
}) {
  const map = useMap();
  const focusKey = focusArea?.communityAreaNumber ?? "none";
  const selectedKey = selectedArea?.communityAreaNumber ?? "none";
  const matchKey = matchedAreas.map((area) => area.communityAreaNumber).join(",");
  const workplaceKey = workplaceCoords
    ? `${workplaceCoords.lat},${workplaceCoords.lng},${workplaceCalloutCoords?.join(",") ?? "none"}`
    : "none";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      map.invalidateSize();

      if (focusArea) {
        const bounds = extendWithNearbyWorkplace(areaBounds(focusArea), focusArea, workplaceCoords, workplaceCalloutCoords);
        map.flyToBounds(bounds.pad(0.18), {
          duration: 0.45,
          paddingTopLeft: [72, 44],
          paddingBottomRight: [44, 44],
          maxZoom: 13,
        });
        return;
      }

      if (selectedArea) {
        const bounds = extendWithNearbyWorkplace(areaBounds(selectedArea), selectedArea, workplaceCoords, workplaceCalloutCoords);
        map.flyToBounds(bounds.pad(0.18), {
          duration: 0.45,
          paddingTopLeft: [72, 44],
          paddingBottomRight: [44, 44],
          maxZoom: 13,
        });
        return;
      }

      if (matchedAreas.length) {
        const bounds = areasBounds(matchedAreas);
        if (bounds) {
          matchedAreas.forEach((area) => extendWithNearbyWorkplace(bounds, area, workplaceCoords, workplaceCalloutCoords));
          map.fitBounds(bounds.pad(0.16), {
            paddingTopLeft: [78, 48],
            paddingBottomRight: [46, 48],
            maxZoom: 12,
          });
        }
        return;
      }

      const bounds = areasBounds(areas);
      if (!bounds) return;
      map.fitBounds(bounds, {
        padding: [28, 28],
        maxZoom: 10.5,
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [areas, focusArea, focusKey, map, matchKey, matchedAreas, selectedArea, selectedKey, workplaceCalloutCoords, workplaceCoords, workplaceKey]);

  return null;
}

function MapZoomControl() {
  const map = useMap();

  useEffect(() => {
    const control = L.control.zoom({ position: "bottomleft" });
    control.addTo(map);
    return () => {
      control.remove();
    };
  }, [map]);

  return null;
}

function RankedMatchBadges({
  areas,
  selectedArea,
  matches,
  workplaceCoords,
  onSelect,
}: {
  areas: CommunityAreaMapArea[];
  selectedArea: CommunityAreaMapArea | null;
  matches: CommunityAreaMapMatch[];
  workplaceCoords?: { lat: number; lng: number } | null;
  onSelect: (name: string) => void;
}) {
  const labels = useMemo(() => {
    return matches.slice(0, 5)
      .map((match) => {
        const area = areas.find(
          (item) =>
            item.communityAreaNumber === match.communityAreaNumber ||
            item.name.toLowerCase() === match.name.toLowerCase(),
        );
        return area ? { area, match } : null;
      })
      .filter((item): item is { area: CommunityAreaMapArea; match: CommunityAreaMapMatch } => Boolean(item));
  }, [areas, matches]);

  return (
    <>
      {labels.map(({ area, match }) => {
        const selected =
          selectedArea?.communityAreaNumber === area.communityAreaNumber ||
          selectedArea?.name.toLowerCase() === area.name.toLowerCase();

        return (
          <Marker
            key={`rank-badge-${match.communityAreaNumber}`}
            position={rankBadgePosition(area, match.rank, workplaceCoords)}
            icon={rankBadgeIcon(match, selected)}
            zIndexOffset={selected ? 1080 : 1040}
            eventHandlers={{ click: () => onSelect(area.name) }}
          />
        );
      })}
    </>
  );
}

function validAreas(value: unknown): CommunityAreaMapArea[] | null {
  if (!value || typeof value !== "object" || !("areas" in value)) return null;
  const areas = (value as { areas?: unknown }).areas;
  if (!Array.isArray(areas)) return null;

  const parsed = areas.filter((area): area is CommunityAreaMapArea => {
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

  return parsed.length ? parsed : null;
}

function validPreview(value: unknown): CommunityAreaPreview | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<CommunityAreaPreview>;
  if (
    typeof item.neighborhood !== "string" ||
    typeof item.fitLine !== "string" ||
    !item.commute ||
    !item.budget ||
    !item.safety ||
    !item.activity
  ) {
    return null;
  }

  return item as CommunityAreaPreview;
}

function signalToneClass(tone: "good" | "neutral" | "caution" | "unknown") {
  if (tone === "good") return "border-[color:var(--signal-good-border)] bg-[color:var(--signal-good-bg)] text-[color:var(--signal-good-text)]";
  if (tone === "caution") return "border-[color:var(--signal-caution-border)] bg-[color:var(--signal-caution-bg)] text-[color:var(--signal-caution-text)]";
  if (tone === "unknown") return "border-[color:var(--signal-unknown-border)] bg-[color:var(--signal-unknown-bg)] text-[color:var(--signal-unknown-text)]";
  return "border-[color:var(--signal-mixed-border)] bg-[color:var(--signal-mixed-bg)] text-[color:var(--signal-mixed-text)]";
}

function commuteMetricTone(tone?: PreviewCommuteTone): PreviewTone {
  if (!tone || tone === "unavailable") return "unknown";
  return tone;
}

function SignalRow({
  Icon,
  label,
  value,
  detail,
  emphasis = false,
  tone = "neutral",
}: {
  Icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
  emphasis?: boolean;
  tone?: "good" | "neutral" | "caution" | "unknown";
}) {
  const rowClass = emphasis
    ? `grid grid-cols-[34px_minmax(0,1fr)] gap-2.5 rounded-[var(--radius-md)] border-l-[5px] px-3.5 py-3 shadow-sm ${signalToneClass(tone)}`
    : `grid grid-cols-[30px_minmax(0,1fr)] gap-2 rounded-[var(--radius-md)] border-l-4 px-3 py-2.5 ${signalToneClass(tone)}`;
  const iconClass = emphasis
    ? "flex h-8 w-8 items-center justify-center rounded-full bg-white/72 text-sm shadow-sm"
    : "flex h-7 w-7 items-center justify-center rounded-full bg-white/62 text-sm shadow-sm";
  const labelClass = emphasis
    ? "text-xs font-extrabold leading-4 opacity-80"
    : "text-[11px] font-bold leading-4 opacity-75";
  const valueClass = emphasis
    ? "mt-1 text-[15px] font-extrabold leading-5 text-[color:var(--foreground)]"
    : "mt-1 text-sm font-bold leading-5 text-[color:var(--foreground)]";

  return (
    <div className={rowClass}>
      <span className={iconClass} aria-hidden="true">
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <p className={labelClass}>{label}</p>
        <p className={valueClass}>{value}</p>
        {detail && <p className="mt-0.5 text-[11px] font-semibold leading-4 opacity-78">{detail}</p>}
      </div>
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div className="grid gap-3">
      <div className="h-16 animate-pulse rounded-[var(--radius-md)] bg-[color:var(--sage-100)]" />
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="h-12 animate-pulse rounded-[var(--radius-md)] bg-white/64" />
      ))}
    </div>
  );
}

export function CommunityAreaBlockMap({
  selectedName,
  onSelect,
  onConfirm,
  matches = [],
  mode = "browse",
  workplaceCoords,
  workplaceName,
  budgetRange,
  monthlyBudget,
  commutePref = "transit",
  priorities,
  month = 10,
  year = 2024,
}: CommunityAreaBlockMapProps) {
  const [areas, setAreas] = useState<CommunityAreaMapArea[]>(INITIAL_AREAS);
  const [query, setQuery] = useState("");
  const [hoveredArea, setHoveredArea] = useState<number | null>(null);
  const [boundaryStatus, setBoundaryStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [preview, setPreview] = useState<CommunityAreaPreview | null>(null);
  const [previewStatus, setPreviewStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    let cancelled = false;

    fetch("/api/community-areas")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: unknown) => {
        if (cancelled) return;
        const nextAreas = validAreas(data);
        if (!nextAreas) return;
        setAreas(nextAreas);
        setBoundaryStatus(nextAreas.some((area) => Boolean(area.boundaryGeojson)) ? "ready" : "unavailable");
      })
      .catch(() => {
        if (!cancelled) setBoundaryStatus("unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const matchByArea = useMemo(() => {
    const byNumber = new Map<number, CommunityAreaMapMatch>();
    const byName = new Map<string, CommunityAreaMapMatch>();
    matches.forEach((match) => {
      byNumber.set(match.communityAreaNumber, match);
      byName.set(match.name.toLowerCase(), match);
    });
    return { byNumber, byName };
  }, [matches]);

  const selectedArea = useMemo(
    () => areas.find((area) => area.name === selectedName) ?? areas.find((area) => area.name === "Hyde Park") ?? areas[0],
    [areas, selectedName],
  );

  const normalizedQuery = query.trim().toLowerCase();
  const searchHits = useMemo(() => {
    if (!normalizedQuery) return [];
    return areas
      .filter((area) =>
        [area.name, ...area.descriptors].join(" ").toLowerCase().includes(normalizedQuery),
      )
      .slice(0, 6);
  }, [areas, normalizedQuery]);

  const searchHitNumbers = useMemo(
    () => new Set(searchHits.map((area) => area.communityAreaNumber)),
    [searchHits],
  );

  const matchedAreas = useMemo(
    () =>
      matches
        .map((match) =>
          areas.find(
            (area) =>
              area.communityAreaNumber === match.communityAreaNumber ||
              area.name.toLowerCase() === match.name.toLowerCase(),
          ),
        )
        .filter((area): area is CommunityAreaMapArea => Boolean(area)),
    [areas, matches],
  );

  const focusArea = normalizedQuery ? searchHits[0] ?? null : null;
  const boundaryAreas = useMemo(
    () => areas.filter((area) => Boolean(area.boundaryGeojson)),
    [areas],
  );
  const badgeSourceAreas = boundaryAreas.length ? boundaryAreas : areas;
  const rankedLabelAreas = useMemo(() => {
    return matches.slice(0, 5)
      .map((match) => {
        const area = badgeSourceAreas.find(
          (item) =>
            item.communityAreaNumber === match.communityAreaNumber ||
            item.name.toLowerCase() === match.name.toLowerCase(),
        );
        return area ? { area, match } : null;
      })
      .filter((item): item is { area: CommunityAreaMapArea; match: CommunityAreaMapMatch } => Boolean(item));
  }, [badgeSourceAreas, matches]);
  const workplaceCalloutCoords = useMemo(
    () =>
      workplaceCoords
        ? workplaceCalloutPosition({
            workplaceCoords,
            rankedLabels: rankedLabelAreas,
            selectedArea: selectedArea ?? null,
          })
        : null,
    [rankedLabelAreas, selectedArea, workplaceCoords],
  );
  const workplaceCalloutLabel = useMemo(() => cleanWorkplaceLabel(workplaceName), [workplaceName]);
  const cityBoundaryData = useMemo<GeoJSON.FeatureCollection<GeoJSON.Geometry> | null>(() => {
    const features = boundaryAreas.flatMap((area) => geoJsonFeatures(area.boundaryGeojson));
    return features.length
      ? {
          type: "FeatureCollection",
          features,
        }
      : null;
  }, [boundaryAreas]);
  const selectedDescriptors = selectedArea ? descriptorText(selectedArea) : "";
  const showSearchHits =
    searchHits.length > 0 && normalizedQuery !== selectedArea?.name.toLowerCase();
  const previewKey = useMemo(() => {
    if (!selectedArea) return "";
    return JSON.stringify({
      neighborhood: selectedArea.name,
      workplace: workplaceName ?? "",
      workplaceLat: workplaceCoords?.lat ?? null,
      workplaceLng: workplaceCoords?.lng ?? null,
      commutePref,
      budgetRange: budgetRange ?? "",
      monthlyBudget: monthlyBudget ?? null,
      priorities: priorities ?? null,
      month,
      year,
    });
  }, [budgetRange, commutePref, month, monthlyBudget, priorities, selectedArea, workplaceCoords, workplaceName, year]);

  useEffect(() => {
    if (!selectedArea || !previewKey) {
      setPreview(null);
      setPreviewStatus("idle");
      return;
    }

    const cached = previewCache.get(previewKey);
    if (cached) {
      setPreview(cached);
      setPreviewStatus("ready");
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      neighborhood: selectedArea.name,
      commutePref,
      budgetRange: budgetRange ?? "",
      month: String(month),
      year: String(year),
    });

    if (typeof monthlyBudget === "number" && Number.isFinite(monthlyBudget)) {
      params.set("monthlyBudget", String(monthlyBudget));
    }

    if (workplaceName) params.set("workplace", workplaceName);
    if (workplaceCoords) {
      params.set("workplaceLat", String(workplaceCoords.lat));
      params.set("workplaceLng", String(workplaceCoords.lng));
    }
    if (priorities) {
      params.set("prioritySafety", String(priorities.safety));
      params.set("priorityTransit", String(priorities.transit));
      params.set("priorityAffordability", String(priorities.affordability));
      params.set("priorityCityServices", String(priorities.cityServices));
      params.set("priorityEntertainment", String(priorities.entertainment));
    }

    setPreview(null);
    setPreviewStatus("loading");

    fetch(`/api/community-area-preview?${params.toString()}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: unknown) => {
        if (controller.signal.aborted) return;
        const nextPreview = validPreview(data);
        if (!nextPreview) {
          setPreviewStatus("error");
          return;
        }
        previewCache.set(previewKey, nextPreview);
        setPreview(nextPreview);
        setPreviewStatus("ready");
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setPreviewStatus("error");
      });

    return () => controller.abort();
  }, [budgetRange, commutePref, month, monthlyBudget, previewKey, priorities, selectedArea, workplaceCoords, workplaceName, year]);

  return (
    <div className="grid h-full min-h-[560px] gap-4 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex h-full min-h-[560px] min-w-0 flex-col gap-3">
        <div className="relative z-[900] rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-[rgba(255,249,238,0.82)] p-2 shadow-sm backdrop-blur sm:flex sm:items-center sm:gap-3">
          <label htmlFor="community-area-search" className="mb-1 block px-1 text-xs font-bold text-[color:var(--muted)] sm:mb-0 sm:shrink-0">
            Search map
          </label>
          <div className="relative min-w-0 flex-1">
            <input
              id="community-area-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search community areas"
              className="atlas-input h-9 w-full px-3 text-sm"
            />
            {showSearchHits && (
              <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-[920] grid gap-1 rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-[rgba(255,249,238,0.98)] p-1.5 shadow-[var(--shadow)]">
                {searchHits.slice(0, 4).map((area) => (
                  <button
                    key={area.communityAreaNumber}
                    type="button"
                    onClick={() => {
                      setQuery(area.name);
                      onSelect(area.name);
                    }}
                    className="rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-xs font-bold text-[color:var(--foreground)] transition hover:bg-[color:var(--sage-100)]"
                  >
                    {area.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="atlas-map-shell relative min-h-0 flex-1 overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--panel-border)] bg-[color:var(--sage-50)] shadow-sm">
          <MapContainer
            center={[41.878, -87.69]}
            zoom={10}
            className="h-full min-h-[500px] w-full"
            zoomControl={false}
            zoomSnap={0.25}
            zoomDelta={0.5}
            scrollWheelZoom
          >
            <MapZoomControl />
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              opacity={0.78}
            />
            <FitMap
              areas={areas}
              focusArea={focusArea}
              selectedArea={selectedArea ?? null}
              matchedAreas={mode === "match" ? matchedAreas : []}
              workplaceCoords={workplaceCoords}
              workplaceCalloutCoords={workplaceCalloutCoords}
            />

            {cityBoundaryData && (
              <GeoJSONLayer
                key="city-outline-real-boundaries"
                data={cityBoundaryData}
                interactive={false}
                style={() => cityOutlineStyle}
              />
            )}

            {boundaryAreas.map((area) => {
              const match = matchByArea.byNumber.get(area.communityAreaNumber) ?? matchByArea.byName.get(area.name.toLowerCase());
              const selected = selectedArea?.communityAreaNumber === area.communityAreaNumber;
              const hovered = hoveredArea === area.communityAreaNumber;
              const searched = searchHitNumbers.has(area.communityAreaNumber);
              const dimmed = mode === "match" && matches.length > 0 && !match;
              const style = areaStyle({
                areaColor: getAreaColor(area.communityAreaNumber),
                selected,
                hovered,
                searched,
                matchRank: match?.rank,
                dimmed,
              });
              const eventHandlers = {
                click: () => onSelect(area.name),
                mouseover: () => setHoveredArea(area.communityAreaNumber),
                mouseout: () => setHoveredArea(null),
              };

              return (
                <GeoJSONLayer
                  key={`${area.communityAreaNumber}-${selected}-${hovered}-${searched}-${match?.rank ?? 0}`}
                  data={area.boundaryGeojson as GeoJSON.GeoJsonObject}
                  style={() => style}
                  eventHandlers={eventHandlers}
                >
                  {mode !== "match" && (
                    <Tooltip sticky direction="top" opacity={0.96}>
                      <span className="text-xs font-bold text-[#263126]">{area.name}</span>
                    </Tooltip>
                  )}
                  <Popup>
                    <div className="min-w-[180px] text-xs text-[#263126]">
                      <p className="font-bold">{area.name}</p>
                      {descriptorText(area) && <p className="mt-1 text-[#66715f]">{descriptorText(area)}</p>}
                      <button
                        type="button"
                        onClick={() => onSelect(area.name)}
                        className="mt-2 rounded-[var(--radius-sm)] bg-[color:var(--sage)] px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Select
                      </button>
                    </div>
                  </Popup>
                </GeoJSONLayer>
              );
            })}

            <RankedMatchBadges
              areas={badgeSourceAreas}
              selectedArea={selectedArea ?? null}
              matches={matches}
              workplaceCoords={workplaceCoords}
              onSelect={onSelect}
            />

            {workplaceCoords && workplaceCalloutCoords && (
              <>
                <Polyline
                  positions={[[workplaceCoords.lat, workplaceCoords.lng], workplaceCalloutCoords]}
                  pathOptions={{
                    color: COLORS.terracotta,
                    opacity: 0.68,
                    weight: 1.2,
                    dashArray: "3 4",
                  }}
                  interactive={false}
                />
                <Marker
                  position={workplaceCalloutCoords}
                  icon={workplaceCalloutIcon(workplaceCalloutLabel)}
                  interactive={false}
                  zIndexOffset={1220}
                />
                <Marker position={[workplaceCoords.lat, workplaceCoords.lng]} icon={workplaceIcon()} zIndexOffset={1300}>
                  <Popup>
                    <span className="text-xs font-semibold">{workplaceName ?? "Workplace"}</span>
                  </Popup>
                </Marker>
              </>
            )}
          </MapContainer>

          {boundaryStatus !== "ready" && boundaryAreas.length === 0 && (
            <div className="pointer-events-none absolute inset-x-4 top-6 z-[850] flex justify-center">
              <div className="max-w-sm rounded-[var(--radius-lg)] border border-[color:var(--panel-border)] bg-[rgba(255,249,238,0.95)] p-4 text-center shadow-[var(--shadow)] backdrop-blur">
                <p className="text-sm font-bold text-[color:var(--foreground)]">
                  {boundaryStatus === "loading"
                    ? "Loading Chicago community-area boundaries..."
                    : "Neighborhood boundaries are unavailable right now."}
                </p>
                {boundaryStatus === "unavailable" && (
                  <p className="mt-1 text-xs font-semibold leading-5 text-[color:var(--muted)]">
                    Search and selection are still available, but the map will wait for real boundary data.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className="atlas-card h-full min-h-[560px] overflow-hidden p-4">
        <div className="h-full overflow-y-auto pr-1">
          <div className="grid gap-4">
          <div>
            <h3 className="text-2xl font-semibold leading-tight text-[color:var(--foreground)]">
              {selectedArea?.name ?? "Choose a community area"}
            </h3>
            {selectedDescriptors && (
              <p className="mt-2 text-sm font-semibold leading-5 text-[color:var(--muted)]">
                {selectedDescriptors}
              </p>
            )}
          </div>

          {previewStatus === "loading" && <PreviewSkeleton />}

          {previewStatus === "error" && (
            <div className="rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-white/70 p-3">
              <p className="text-sm font-bold text-[color:var(--foreground)]">Preview signals are unavailable.</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-[color:var(--muted)]">
                You can still pick this community area and open the simulation preview.
              </p>
            </div>
          )}

          {previewStatus === "ready" && preview && (
            <div className="grid gap-3">
              <div className={`rounded-[var(--radius-md)] border border-l-[6px] px-4 py-4 shadow-sm ${signalToneClass(preview.verdict?.tone ?? preview.rank?.overall.tone ?? "neutral")}`}>
                <p className="atlas-kicker text-[11px] font-semibold leading-4 text-[color:var(--muted)] opacity-85">
                  Fit verdict
                </p>
                <p className="mt-1.5 text-base font-extrabold leading-6 text-[color:var(--foreground)]">
                  {preview.verdict?.label ?? preview.rank?.overall.label ?? preview.fitLine}
                </p>
              </div>

              <div className="grid gap-2">
                <SignalRow
                  Icon={TrainFront}
                  label="Commute"
                  value={preview.commute.label}
                  detail={preview.rank?.commute.rank ? preview.rank.commute.label : undefined}
                  tone={commuteMetricTone(preview.commute.tone)}
                  emphasis
                />
                <SignalRow Icon={Banknote} label="Budget" value={preview.budget.label} tone={preview.budget.tone} emphasis />
                <SignalRow Icon={ShieldAlert} label="Safety" value={preview.safety.label} tone={preview.safety.tone} />
                <SignalRow Icon={Utensils} label="Daily life" value={preview.activity.label} tone={preview.activity.tone} />
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={!selectedArea}
            onClick={() => selectedArea && onConfirm(selectedArea.name)}
            className="atlas-button-primary mt-1 w-full disabled:cursor-not-allowed disabled:opacity-55"
          >
            Simulate {selectedArea?.name ?? "neighborhood"}
          </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
