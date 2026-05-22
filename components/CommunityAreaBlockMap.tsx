"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  BarChart3,
  ListChecks,
  ShieldAlert,
  TrainFront,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import {
  GeoJSON as GeoJSONLayer,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
  useMapEvents,
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

const INITIAL_AREAS = getFallbackCommunityAreas();
const previewCache = new Map<string, CommunityAreaPreview>();

function areaCenter(area: CommunityAreaMapArea): [number, number] {
  return [area.lat, area.lng];
}

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

function distanceMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
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

function extendWithNearbyWorkplace(
  bounds: L.LatLngBounds,
  area: CommunityAreaMapArea,
  workplaceCoords?: { lat: number; lng: number } | null,
): L.LatLngBounds {
  if (!workplaceCoords) return bounds;
  if (distanceMiles(area, workplaceCoords) <= 4.5) {
    bounds.extend([workplaceCoords.lat, workplaceCoords.lng]);
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
  if (rank === 1) return COLORS.terracotta;
  if (rank === 2) return COLORS.amber;
  if (rank === 3) return COLORS.sage;
  return COLORS.sageStrong;
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
  const stateColor = searched ? COLORS.amber : matchRank ? rankColor(matchRank) : areaColor.stroke;
  if (dimmed && !selected && !hovered && !searched) {
    return {
      color: COLORS.dimStroke,
      fillColor: COLORS.dimFill,
      fillOpacity: 0.24,
      opacity: 0.34,
      weight: 1.1,
    };
  }

  return {
    color: selected ? COLORS.terracotta : hovered || searched || matchRank ? stateColor : areaColor.stroke,
    fillColor: areaColor.fill,
    fillOpacity: selected ? 0.94 : hovered ? 0.9 : searched ? 0.86 : matchRank ? 0.82 : 0.72,
    opacity: selected || hovered || searched || matchRank ? 0.95 : 0.78,
    weight: selected ? 4 : searched ? 3 : hovered || matchRank ? 2.5 : 1.4,
  };
}

const cityOutlineStyle = {
  color: COLORS.outline,
  fillColor: COLORS.cream,
  fillOpacity: 0,
  opacity: 0.92,
  weight: 5,
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

function rankIcon(match: CommunityAreaMapMatch) {
  const color = rankColor(match.rank);
  return L.divIcon({
    className: "",
    html: `<div style="
      display:flex;align-items:center;justify-content:center;
      width:28px;height:28px;border-radius:999px;
      background:${color};border:2px solid ${COLORS.cream};
      color:white;font:800 12px/1 'Avenir Next','Segoe UI Rounded',system-ui,sans-serif;
      box-shadow:0 5px 14px rgba(38,49,38,0.26);
    ">${match.rank}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function areaNameIcon(name: string, variant: "selected" | "match" | "search" | "standard") {
  const background =
    variant === "selected"
      ? "rgba(255,249,238,0.98)"
      : variant === "match"
        ? "rgba(255,249,238,0.92)"
        : variant === "search"
          ? "rgba(255,246,217,0.94)"
          : "rgba(255,249,238,0.72)";
  const border =
    variant === "selected"
      ? COLORS.terracotta
      : variant === "match"
        ? COLORS.sageStrong
        : variant === "search"
          ? COLORS.amber
          : "rgba(38,49,38,0.16)";
  const color = variant === "standard" ? "rgba(38,49,38,0.74)" : COLORS.ink;
  const shadow = variant === "standard" ? "none" : "0 6px 16px rgba(38,49,38,0.18)";

  return L.divIcon({
    className: "community-area-label-marker",
    html: `<div style="
      transform:translate(-50%,-50%);
      max-width:118px;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
      border:1px solid ${border};
      border-radius:999px;
      background:${background};
      color:${color};
      padding:5px 8px;
      font:800 10px/1.1 'Avenir Next','Segoe UI Rounded',system-ui,sans-serif;
      box-shadow:${shadow};
    ">${escapeHtml(name)}</div>`,
    iconSize: [118, 24],
    iconAnchor: [59, 12],
  });
}

function workplaceIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="
      display:flex;align-items:center;gap:6px;
      transform:translateY(-50%);
      white-space:nowrap;
      filter:drop-shadow(0 2px 7px rgba(38,49,38,0.28));
    ">
      <div style="
        width:16px;height:16px;border-radius:999px;
        background:${COLORS.terracotta};border:3px solid ${COLORS.cream};
        box-shadow:0 0 0 2px rgba(199,101,69,0.32);
      "></div>
      <div style="
        border:1px solid rgba(199,101,69,0.26);
        border-radius:999px;background:rgba(255,249,238,0.97);
        color:${COLORS.ink};padding:5px 8px;
        font:800 12px/1 'Avenir Next','Segoe UI Rounded',system-ui,sans-serif;
      ">Anchor</div>
    </div>`,
    iconSize: [130, 28],
    iconAnchor: [8, 14],
  });
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
}: {
  areas: CommunityAreaMapArea[];
  focusArea: CommunityAreaMapArea | null;
  selectedArea: CommunityAreaMapArea | null;
  matchedAreas: CommunityAreaMapArea[];
  workplaceCoords?: { lat: number; lng: number } | null;
}) {
  const map = useMap();
  const focusKey = focusArea?.communityAreaNumber ?? "none";
  const selectedKey = selectedArea?.communityAreaNumber ?? "none";
  const matchKey = matchedAreas.map((area) => area.communityAreaNumber).join(",");
  const workplaceKey = workplaceCoords ? `${workplaceCoords.lat},${workplaceCoords.lng}` : "none";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      map.invalidateSize();

      if (focusArea) {
        const bounds = extendWithNearbyWorkplace(areaBounds(focusArea), focusArea, workplaceCoords);
        map.flyToBounds(bounds, { duration: 0.45, padding: [18, 18], maxZoom: 12.5 });
        return;
      }

      if (matchedAreas.length) {
        const bounds = areasBounds(matchedAreas);
        if (bounds) {
          map.fitBounds(bounds, {
            padding: [20, 20],
            maxZoom: 12.5,
          });
        }
        return;
      }

      if (selectedArea) {
        const bounds = extendWithNearbyWorkplace(areaBounds(selectedArea), selectedArea, workplaceCoords);
        map.fitBounds(bounds, {
          padding: [18, 18],
          maxZoom: 12.5,
        });
        return;
      }

      const bounds = areasBounds(areas);
      if (!bounds) return;
      map.fitBounds(bounds, {
        padding: [20, 20],
        maxZoom: 10.5,
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [areas, focusArea, focusKey, map, matchKey, matchedAreas, selectedArea, selectedKey, workplaceCoords, workplaceKey]);

  return null;
}

function MapNameLabels({
  areas,
  selectedArea,
  matches,
  searchHitNumbers,
}: {
  areas: CommunityAreaMapArea[];
  selectedArea: CommunityAreaMapArea | null;
  matches: CommunityAreaMapMatch[];
  searchHitNumbers: Set<number>;
}) {
  const map = useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom());
      setBounds(map.getBounds());
    },
    moveend: () => {
      setZoom(map.getZoom());
      setBounds(map.getBounds());
    },
  });
  const [zoom, setZoom] = useState(map.getZoom());
  const [bounds, setBounds] = useState(() => map.getBounds());

  useEffect(() => {
    setZoom(map.getZoom());
    setBounds(map.getBounds());
  }, [map]);

  const topMatches = useMemo(() => matches.slice(0, 5), [matches]);
  const topMatchNumbers = useMemo(
    () => new Set(topMatches.map((match) => match.communityAreaNumber)),
    [topMatches],
  );
  const topMatchNames = useMemo(
    () => new Set(topMatches.map((match) => match.name.toLowerCase())),
    [topMatches],
  );

  const labels = useMemo(() => {
    const viewportLabels = areas.filter((area) => {
      const selected = selectedArea?.communityAreaNumber === area.communityAreaNumber;
      const matched = topMatchNumbers.has(area.communityAreaNumber) || topMatchNames.has(area.name.toLowerCase());
      const searched = searchHitNumbers.has(area.communityAreaNumber);

      if (selected || matched || searched) return true;
      if (zoom < 12) return false;
      return bounds.contains(L.latLng(area.lat, area.lng));
    });

    return viewportLabels.slice(0, 34);
  }, [areas, bounds, searchHitNumbers, selectedArea, topMatchNames, topMatchNumbers, zoom]);

  return (
    <>
      {labels.map((area) => {
        const selected = selectedArea?.communityAreaNumber === area.communityAreaNumber;
        const matched = topMatchNumbers.has(area.communityAreaNumber) || topMatchNames.has(area.name.toLowerCase());
        const searched = searchHitNumbers.has(area.communityAreaNumber);
        const variant = selected ? "selected" : matched ? "match" : searched ? "search" : "standard";

        return (
          <Marker
            key={`label-${area.communityAreaNumber}`}
            position={areaCenter(area)}
            icon={areaNameIcon(area.name, variant)}
            interactive={false}
            zIndexOffset={selected ? 980 : matched ? 880 : searched ? 820 : 400}
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
  if (tone === "good") return "border-[color:var(--sage)] bg-[color:var(--sage-100)] text-[color:var(--sage-strong)]";
  if (tone === "caution") return "border-[color:var(--terracotta)] bg-[color:var(--clay-50)] text-[color:var(--terracotta)]";
  if (tone === "unknown") return "border-[color:var(--panel-border)] bg-white/58 text-[color:var(--muted)]";
  return "border-[color:var(--amber)] bg-[rgba(231,173,78,0.16)] text-[color:var(--foreground)]";
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
  tone = "neutral",
}: {
  Icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
  tone?: "good" | "neutral" | "caution" | "unknown";
}) {
  return (
    <div className={`grid grid-cols-[30px_minmax(0,1fr)] gap-2 rounded-[var(--radius-md)] border-l-4 px-3 py-2.5 ${signalToneClass(tone)}`}>
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/62 text-sm shadow-sm" aria-hidden="true">
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold leading-3 tracking-[0.04em] opacity-75">{label}</p>
        <p className="mt-1 text-sm font-bold leading-5 text-[color:var(--foreground)]">{value}</p>
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
  const [showCompare, setShowCompare] = useState(false);

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
  const cityBoundaryData = useMemo<GeoJSON.FeatureCollection<GeoJSON.Geometry> | null>(() => {
    const features = boundaryAreas.flatMap((area) => geoJsonFeatures(area.boundaryGeojson));
    return features.length
      ? {
          type: "FeatureCollection",
          features,
        }
      : null;
  }, [boundaryAreas]);
  const selectedMatch =
    matchByArea.byNumber.get(selectedArea?.communityAreaNumber ?? -1) ??
    matchByArea.byName.get(selectedArea?.name.toLowerCase() ?? "");
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
      <div className="atlas-map-shell relative h-full min-h-[560px] overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--panel-border)] bg-[color:var(--sage-50)] shadow-sm">
        <MapContainer
          center={[41.878, -87.69]}
          zoom={10}
          className="h-full min-h-[560px] w-full"
          zoomControl={false}
          zoomSnap={0.25}
          zoomDelta={0.5}
          scrollWheelZoom
        >
          <ZoomControl position="bottomleft" />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            opacity={0.42}
          />
          <FitMap
            areas={areas}
            focusArea={focusArea}
            selectedArea={selectedArea ?? null}
            matchedAreas={mode === "match" ? matchedAreas : []}
            workplaceCoords={workplaceCoords}
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
                <Tooltip sticky direction="top" opacity={0.96}>
                  <span className="text-xs font-bold text-[#263126]">{area.name}</span>
                </Tooltip>
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

          <MapNameLabels
            areas={boundaryAreas.length ? boundaryAreas : areas}
            selectedArea={selectedArea ?? null}
            matches={matches}
            searchHitNumbers={searchHitNumbers}
          />

          {matches.map((match) => {
            const area = areas.find(
              (item) =>
                item.communityAreaNumber === match.communityAreaNumber ||
                item.name.toLowerCase() === match.name.toLowerCase(),
            );
            if (!area) return null;
            return (
              <Marker
                key={`rank-${match.communityAreaNumber}`}
                position={areaCenter(area)}
                icon={rankIcon(match)}
                eventHandlers={{ click: () => onSelect(area.name) }}
              >
                <Tooltip direction="top" offset={[0, -14]} opacity={1}>
                  <span className="text-xs font-bold text-[#263126]">{match.name}</span>
                </Tooltip>
              </Marker>
            );
          })}

          {workplaceCoords && (
            <Marker position={[workplaceCoords.lat, workplaceCoords.lng]} icon={workplaceIcon()}>
              <Popup>
                <span className="text-xs font-semibold">{workplaceName ?? "Anchor"}</span>
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {boundaryStatus !== "ready" && boundaryAreas.length === 0 && (
          <div className="pointer-events-none absolute inset-x-4 top-24 z-[850] flex justify-center">
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

        <div className="pointer-events-none absolute left-3 right-3 top-3 z-[800] sm:left-4 sm:right-auto sm:w-[min(360px,calc(100%-2rem))]">
          <div className="pointer-events-auto rounded-[var(--radius-lg)] border border-white/70 bg-[rgba(255,249,238,0.94)] p-2 shadow-[var(--shadow)] backdrop-blur">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the map"
              className="atlas-input w-full px-3 py-2 text-sm"
            />
            {showSearchHits && (
              <div className="mt-2 grid gap-1">
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
      </div>

      <aside className="atlas-card flex h-full min-h-[560px] flex-col overflow-hidden p-4">
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid gap-4">
          <div>
            <p className="atlas-kicker text-[color:var(--muted)]">
              {mode === "match" ? "Selected match" : "Selected community area"}
            </p>
            <h3 className="mt-2 text-2xl font-semibold leading-tight text-[color:var(--foreground)]">
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
              <div className={`rounded-[var(--radius-md)] border-l-4 px-3 py-3 ${signalToneClass(preview.verdict?.tone ?? preview.rank?.overall.tone ?? "neutral")}`}>
                <p className="text-[10px] font-bold leading-3 tracking-[0.04em] opacity-75">
                  Fit verdict
                </p>
                <p className="mt-1 text-sm font-bold leading-5 text-[color:var(--foreground)]">
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
                />
                <SignalRow Icon={Banknote} label="Budget" value={preview.budget.label} tone={preview.budget.tone} />
                <SignalRow Icon={ShieldAlert} label="Reported-crime signal" value={preview.safety.label} tone={preview.safety.tone} />
                <SignalRow Icon={Utensils} label="Daily life" value={preview.activity.label} tone={preview.activity.tone} />
              </div>
            </div>
          )}

          {selectedMatch?.matchReason && (
            <div className="rounded-[var(--radius-md)] bg-[color:var(--sage-100)] p-3">
              <p className="text-xs font-bold text-[color:var(--sage-strong)]">Match #{selectedMatch.rank}</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-[color:var(--foreground)]">
                {selectedMatch.matchReason}
              </p>
            </div>
          )}

          {mode === "match" && matches.length > 0 && (
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-xs font-bold text-[color:var(--muted)]">
                  <ListChecks size={14} /> Top picks
                </p>
                <button
                  type="button"
                  onClick={() => setShowCompare((value) => !value)}
                  className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[color:var(--panel-border)] bg-white/72 px-2 py-1 text-[11px] font-extrabold text-[color:var(--muted-strong)] transition hover:border-[color:var(--sage)] hover:text-[color:var(--sage-strong)]"
                >
                  <BarChart3 size={13} /> {showCompare ? "Hide compare" : "Compare 3"}
                </button>
              </div>
              {showCompare && (
                <div className="grid gap-2 rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-white/72 p-3">
                  {matches.slice(0, 3).map((match) => (
                    <div key={`compare-${match.communityAreaNumber}`} className="grid grid-cols-[28px_minmax(0,1fr)] gap-2">
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: rankColor(match.rank) }}
                      >
                        {match.rank}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold text-[color:var(--foreground)]">{match.name}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-5 text-[color:var(--muted)]">
                          {match.matchReason || match.descriptors?.slice(0, 3).join(" · ")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {matches.slice(0, 5).map((match) => {
                const active = selectedArea?.communityAreaNumber === match.communityAreaNumber || selectedArea?.name === match.name;
                return (
                  <button
                    key={match.communityAreaNumber}
                    type="button"
                    onClick={() => onSelect(match.name)}
                    className={`grid grid-cols-[28px_minmax(0,1fr)] items-start gap-2 rounded-[var(--radius-md)] border p-2 text-left transition ${
                      active
                        ? "border-[color:var(--terracotta)] bg-[color:var(--clay-50)]"
                        : "border-[color:var(--panel-border)] bg-white/62 hover:border-[color:var(--sage)]"
                    }`}
                  >
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: rankColor(match.rank) }}
                    >
                      {match.rank}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-[color:var(--foreground)]">{match.name}</span>
                      {match.descriptors?.length ? (
                        <span className="block truncate text-xs font-semibold text-[color:var(--muted)]">
                          {match.descriptors.slice(0, 2).join(" · ")}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          </div>
        </div>

        <div className="mt-4 grid shrink-0 gap-2 border-t border-[color:var(--panel-border)] pt-3">
          <button
            type="button"
            disabled={!selectedArea}
            onClick={() => selectedArea && onConfirm(selectedArea.name)}
            className="atlas-button-primary w-full disabled:cursor-not-allowed disabled:opacity-55"
          >
            Simulate {selectedArea?.name ?? "neighborhood"}
          </button>
          <p className="text-xs font-semibold text-[color:var(--muted)]">
            Next: open the simulation preview, then run the 12-month story.
          </p>
        </div>
      </aside>
    </div>
  );
}
