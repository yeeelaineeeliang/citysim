"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GeoJSON as GeoJSONLayer,
  MapContainer,
  Marker,
  Polygon,
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
}

const COLORS = {
  ink: "#263126",
  muted: "#66715f",
  cream: "#fff9ee",
  line: "#f4e6d3",
  sage: "#6f8d5f",
  sageSoft: "#dbe4cf",
  sageStrong: "#4f6f45",
  terracotta: "#c76545",
  amber: "#e7ad4e",
  amberSoft: "#f4d49a",
};

const INITIAL_AREAS = getFallbackCommunityAreas();

function areaCenter(area: CommunityAreaMapArea): [number, number] {
  return [area.lat, area.lng];
}

function fallbackBlock(area: CommunityAreaMapArea): [number, number][] {
  const latSize = area.communityAreaNumber === 76 ? 0.038 : 0.013;
  const lngSize = area.communityAreaNumber === 76 ? 0.06 : 0.017;
  return [
    [area.lat - latSize, area.lng - lngSize],
    [area.lat - latSize, area.lng + lngSize],
    [area.lat + latSize, area.lng + lngSize],
    [area.lat + latSize, area.lng - lngSize],
  ];
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

function areaStyle({
  selected,
  hovered,
  searched,
  matchRank,
}: {
  selected: boolean;
  hovered: boolean;
  searched: boolean;
  matchRank?: number;
}) {
  const matchedColor = rankColor(matchRank);
  return {
    color: selected ? COLORS.ink : hovered || searched || matchRank ? matchedColor : COLORS.line,
    fillColor: selected ? COLORS.terracotta : matchRank ? matchedColor : searched ? COLORS.amberSoft : COLORS.sageSoft,
    fillOpacity: selected ? 0.92 : hovered ? 0.88 : matchRank ? 0.8 : searched ? 0.84 : 0.62,
    opacity: selected || hovered || searched || matchRank ? 0.95 : 0.78,
    weight: selected ? 3 : hovered || searched || matchRank ? 2 : 1,
  };
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

function selectedIcon(name: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      transform:translate(-50%,-120%);
      white-space:nowrap;
      border:1px solid rgba(38,49,38,0.18);
      border-radius:999px;
      background:${COLORS.cream};
      color:${COLORS.ink};
      padding:7px 10px;
      font:800 12px/1 'Avenir Next','Segoe UI Rounded',system-ui,sans-serif;
      box-shadow:0 8px 18px rgba(38,49,38,0.2);
    ">${escapeHtml(name)}</div>`,
    iconSize: [220, 30],
    iconAnchor: [0, 0],
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
  matchedAreas,
  workplaceCoords,
}: {
  areas: CommunityAreaMapArea[];
  focusArea: CommunityAreaMapArea | null;
  matchedAreas: CommunityAreaMapArea[];
  workplaceCoords?: { lat: number; lng: number } | null;
}) {
  const map = useMap();
  const focusKey = focusArea?.communityAreaNumber ?? "none";
  const matchKey = matchedAreas.map((area) => area.communityAreaNumber).join(",");
  const workplaceKey = workplaceCoords ? `${workplaceCoords.lat},${workplaceCoords.lng}` : "none";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      map.invalidateSize();

      if (focusArea) {
        map.flyTo(areaCenter(focusArea), 12, { duration: 0.45 });
        return;
      }

      const fitAreas = matchedAreas.length ? matchedAreas : areas;
      const points: [number, number][] = [
        ...fitAreas.map(areaCenter),
        ...(workplaceCoords ? [[workplaceCoords.lat, workplaceCoords.lng] as [number, number]] : []),
      ];
      if (!points.length) return;
      map.fitBounds(L.latLngBounds(points), {
        padding: [34, 34],
        maxZoom: matchedAreas.length ? 12 : 10,
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [areas, focusArea, focusKey, map, matchKey, matchedAreas, workplaceCoords, workplaceKey]);

  return null;
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

export function CommunityAreaBlockMap({
  selectedName,
  onSelect,
  onConfirm,
  matches = [],
  mode = "browse",
  workplaceCoords,
  workplaceName,
}: CommunityAreaBlockMapProps) {
  const [areas, setAreas] = useState<CommunityAreaMapArea[]>(INITIAL_AREAS);
  const [query, setQuery] = useState("");
  const [hoveredArea, setHoveredArea] = useState<number | null>(null);
  const [loadedBoundaries, setLoadedBoundaries] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/community-areas")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: unknown) => {
        if (cancelled) return;
        const nextAreas = validAreas(data);
        if (!nextAreas) return;
        setAreas(nextAreas);
        setLoadedBoundaries(nextAreas.some((area) => Boolean(area.boundaryGeojson)));
      })
      .catch(() => {
        if (!cancelled) setLoadedBoundaries(false);
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
  const selectedMatch =
    matchByArea.byNumber.get(selectedArea?.communityAreaNumber ?? -1) ??
    matchByArea.byName.get(selectedArea?.name.toLowerCase() ?? "");
  const selectedDescriptors = selectedArea ? descriptorText(selectedArea) : "";

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="relative min-h-[520px] overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--panel-border)] bg-[color:var(--sage-50)] shadow-sm">
        <MapContainer
          center={[41.878, -87.69]}
          zoom={10}
          className="h-full min-h-[520px] w-full"
          zoomControl
          scrollWheelZoom
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            opacity={0.5}
          />
          <FitMap
            areas={areas}
            focusArea={focusArea}
            matchedAreas={mode === "match" ? matchedAreas : []}
            workplaceCoords={workplaceCoords}
          />

          {areas.map((area) => {
            const match = matchByArea.byNumber.get(area.communityAreaNumber) ?? matchByArea.byName.get(area.name.toLowerCase());
            const selected = selectedArea?.communityAreaNumber === area.communityAreaNumber;
            const hovered = hoveredArea === area.communityAreaNumber;
            const searched = searchHitNumbers.has(area.communityAreaNumber);
            const style = areaStyle({ selected, hovered, searched, matchRank: match?.rank });
            const eventHandlers = {
              click: () => onSelect(area.name),
              mouseover: () => setHoveredArea(area.communityAreaNumber),
              mouseout: () => setHoveredArea(null),
            };

            if (area.boundaryGeojson) {
              return (
                <GeoJSONLayer
                  key={`${area.communityAreaNumber}-${selected}-${hovered}-${searched}-${match?.rank ?? 0}`}
                  data={area.boundaryGeojson}
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
            }

            return (
              <Polygon
                key={`${area.communityAreaNumber}-${selected}-${hovered}-${searched}-${match?.rank ?? 0}`}
                positions={fallbackBlock(area)}
                pathOptions={style}
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
              </Polygon>
            );
          })}

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

          {selectedArea && (
            <Marker position={areaCenter(selectedArea)} icon={selectedIcon(selectedArea.name)} />
          )}

          {workplaceCoords && (
            <Marker position={[workplaceCoords.lat, workplaceCoords.lng]} icon={workplaceIcon()}>
              <Popup>
                <span className="text-xs font-semibold">{workplaceName ?? "Anchor"}</span>
              </Popup>
            </Marker>
          )}
        </MapContainer>

        <div className="pointer-events-none absolute left-3 right-3 top-3 z-[800] sm:left-4 sm:right-auto sm:w-[min(360px,calc(100%-2rem))]">
          <div className="pointer-events-auto rounded-[var(--radius-lg)] border border-white/70 bg-[rgba(255,249,238,0.94)] p-2 shadow-[var(--shadow)] backdrop-blur">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the map"
              className="atlas-input w-full px-3 py-2 text-sm"
            />
            {searchHits.length > 0 && (
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

      <aside className="atlas-card grid content-between gap-4 p-4">
        <div className="grid gap-4">
          <div>
            <p className="atlas-kicker text-[color:var(--muted)]">
              {mode === "match" ? "Map matches" : "Selected block"}
            </p>
            <h3 className="mt-2 text-3xl font-semibold leading-tight text-[color:var(--foreground)]">
              {selectedArea?.name ?? "Choose a block"}
            </h3>
            {selectedDescriptors && (
              <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--muted)]">
                {selectedDescriptors}
              </p>
            )}
          </div>

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
              <p className="text-xs font-bold text-[color:var(--muted)]">Top picks</p>
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

        <div className="grid gap-2">
          <button
            type="button"
            disabled={!selectedArea}
            onClick={() => selectedArea && onConfirm(selectedArea.name)}
            className="atlas-button-primary w-full disabled:cursor-not-allowed disabled:opacity-55"
          >
            Simulate {selectedArea?.name ?? "neighborhood"}
          </button>
          <p className="text-xs font-semibold text-[color:var(--muted)]">
            {loadedBoundaries ? "Click a community-area block to select it." : "Using map blocks from saved coordinates."}
          </p>
        </div>
      </aside>
    </div>
  );
}
