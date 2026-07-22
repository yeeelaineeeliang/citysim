"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Circle,
  CircleMarker,
  GeoJSON as GeoJSONLayer,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import {
  getFallbackCommunityAreas,
  type CommunityAreaMapArea,
} from "@/lib/communityAreaMap";
import {
  MATCH_RANK_BADGE_STROKE,
  MATCH_RANK_BADGE_SURFACE,
  MATCH_RANK_BADGE_TEXT,
  matchRankColor,
  matchRankFillOpacity,
  matchRankStrokeColor,
} from "@/lib/matchRankColors";
import type { OnboardingProfileDraft } from "./OnboardingProfileForm";

interface RankedMatch {
  communityAreaNumber: number;
  name: string;
  slug?: string;
  descriptors?: string[];
  matchReason?: string;
  rank: number;
}

interface ProfileOnboardingPreviewMapProps {
  draft: OnboardingProfileDraft;
  variant: "expanded" | "compact";
}

const INITIAL_AREAS = getFallbackCommunityAreas();
const MATCH_DEBOUNCE_MS = 360;
const CHICAGO_WORKPLACE_CENTER: [number, number] = [41.85, -87.65];
const CHICAGO_INITIAL_ZOOM = 10;

const COLORS = {
  cream: "#fbf8f2",
  sageSoft: "#dce9e4",
  sageStrong: "#476f63",
  terracotta: "#b95f3f",
  dimFill: "#dad8d3",
  dimStroke: "#8b9090",
};

function validAreas(data: unknown): CommunityAreaMapArea[] | null {
  if (!data || typeof data !== "object" || !("areas" in data) || !Array.isArray(data.areas)) return null;
  const areas = data.areas.filter((item): item is CommunityAreaMapArea => {
    return Boolean(
      item &&
        typeof item === "object" &&
        "communityAreaNumber" in item &&
        "name" in item &&
        "lat" in item &&
        "lng" in item &&
        typeof item.communityAreaNumber === "number" &&
        typeof item.name === "string" &&
        typeof item.lat === "number" &&
        typeof item.lng === "number",
    );
  });
  return areas.length > 0 ? areas : null;
}

function validMatches(data: unknown): RankedMatch[] {
  if (!data || typeof data !== "object" || !("matches" in data) || !Array.isArray(data.matches)) return [];
  return data.matches
    .filter((item): item is Omit<RankedMatch, "rank"> => {
      return Boolean(
        item &&
          typeof item === "object" &&
          "communityAreaNumber" in item &&
          "name" in item &&
          typeof item.communityAreaNumber === "number" &&
          typeof item.name === "string",
      );
    })
    .slice(0, 5)
    .map((match, index) => ({ ...match, rank: index + 1 }));
}

function areaCenter(area: CommunityAreaMapArea): [number, number] {
  return [area.lat, area.lng];
}

function areaBounds(area: CommunityAreaMapArea): L.LatLngBounds {
  if (area.boundaryGeojson) {
    const bounds = L.geoJSON(area.boundaryGeojson).getBounds();
    if (bounds.isValid()) return bounds;
  }

  const center = L.latLng(area.lat, area.lng);
  return L.latLngBounds(center, center).pad(0.15);
}

function boundsForAreas(areas: CommunityAreaMapArea[]) {
  const validBounds = areas.map(areaBounds).filter((bounds) => bounds.isValid());
  if (!validBounds.length) return null;
  const bounds = validBounds[0];
  validBounds.slice(1).forEach((item) => bounds.extend(item));
  return bounds;
}

function extendBounds(bounds: L.LatLngBounds | null, nextBounds: L.LatLngBounds | null) {
  if (!nextBounds?.isValid()) return bounds;
  if (!bounds?.isValid()) return nextBounds;
  return bounds.extend(nextBounds);
}

function workplaceBounds(coords: { lat: number; lng: number }, commutePref: OnboardingProfileDraft["commutePref"]) {
  const center = L.latLng(coords.lat, coords.lng);
  return center.toBounds(radiusMeters(commutePref) * 2.25);
}

function rankColor(rank?: number) {
  return rank ? matchRankColor(rank) : COLORS.sageStrong;
}

function rankStrokeColor(rank?: number) {
  return rank ? matchRankStrokeColor(rank) : COLORS.sageStrong;
}

function areaStyle(rank?: number, dimmed = false, review = false) {
  if (dimmed) {
    return {
      color: COLORS.dimStroke,
      fillColor: COLORS.dimFill,
      fillOpacity: 0.16,
      opacity: 0.32,
      weight: 0.7,
    };
  }

  return {
    color: rank ? rankStrokeColor(rank) : "rgba(79,95,72,0.64)",
    fillColor: rank ? rankColor(rank) : "#ecf0e4",
    fillOpacity: rank ? Math.min(matchRankFillOpacity(rank) + (review ? 0.18 : 0.06), 0.7) : 0.3,
    opacity: rank ? 0.98 : 0.58,
    weight: rank ? (review ? 2.2 : 1.5) : 0.8,
  };
}

function rankIcon(match: RankedMatch) {
  return L.divIcon({
    className: "",
    html: `<span style="
        display:flex;align-items:center;justify-content:center;
        width:28px;height:28px;border-radius:999px;
        background:${MATCH_RANK_BADGE_SURFACE};border:2px solid ${MATCH_RANK_BADGE_STROKE};
        box-shadow:0 5px 12px rgba(38,49,38,0.22);
        color:${MATCH_RANK_BADGE_TEXT};font:800 12px/1 'Avenir Next','Segoe UI Rounded',system-ui,sans-serif;
      ">${match.rank}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function anchorIcon() {
  return L.divIcon({
    className: "",
    html: `<span style="
        width:17px;height:17px;border-radius:999px;
        display:block;
        background:${COLORS.terracotta};border:3px solid ${COLORS.cream};
        box-shadow:0 0 0 2px rgba(199,101,69,0.3),0 3px 9px rgba(38,49,38,0.28);
      "></span>`,
    iconSize: [17, 17],
    iconAnchor: [8.5, 8.5],
  });
}

function radiusMeters(mode: OnboardingProfileDraft["commutePref"]) {
  if (mode === "walking") return 1200;
  if (mode === "biking") return 2400;
  if (mode === "driving") return 4800;
  return 3200;
}

function FitPreviewMap({
  areas,
  matches,
  workplaceCoords,
  commutePref,
  focusMatches,
  variant,
}: {
  areas: CommunityAreaMapArea[];
  matches: RankedMatch[];
  workplaceCoords: { lat: number; lng: number } | null;
  commutePref: OnboardingProfileDraft["commutePref"];
  focusMatches: boolean;
  variant: ProfileOnboardingPreviewMapProps["variant"];
}) {
  const map = useMap();
  const matchKey = matches.map((match) => match.communityAreaNumber).join(",");
  const workplaceKey = workplaceCoords ? `${workplaceCoords.lat},${workplaceCoords.lng}` : "none";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      map.invalidateSize(false);

      const matchAreas = matches
        .map((match) => areas.find((area) => area.communityAreaNumber === match.communityAreaNumber))
        .filter((area): area is CommunityAreaMapArea => Boolean(area));
      const highlightedBounds = boundsForAreas(matchAreas);
      let bounds = focusMatches && highlightedBounds ? highlightedBounds : null;

      if (workplaceCoords) {
        bounds = extendBounds(bounds, workplaceBounds(workplaceCoords, commutePref));
        if (focusMatches) bounds = extendBounds(bounds, highlightedBounds);
      }

      if (!bounds) bounds = highlightedBounds ?? boundsForAreas(areas);
      if (!bounds?.isValid()) return;

      const isCompact = variant === "compact";
      map.fitBounds(bounds.pad(isCompact ? 0.24 : 0.18), {
        animate: true,
        maxZoom: workplaceCoords ? 12 : 10,
        paddingTopLeft: isCompact ? [52, 28] : [28, 24],
        paddingBottomRight: isCompact ? [34, 34] : [28, 24],
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [areas, commutePref, focusMatches, map, matchKey, workplaceCoords, workplaceKey, variant]);

  return null;
}

export function ProfileOnboardingPreviewMap({ draft, variant }: ProfileOnboardingPreviewMapProps) {
  const [areas, setAreas] = useState<CommunityAreaMapArea[]>(INITIAL_AREAS);
  const [matches, setMatches] = useState<RankedMatch[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/community-areas")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: unknown) => {
        if (cancelled) return;
        const nextAreas = validAreas(data);
        if (nextAreas) setAreas(nextAreas);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const matchRequestKey = useMemo(() => {
    if (draft.stepId === "requests") return "";
    return JSON.stringify({
      budget: draft.budget,
      workplace: draft.profile.workplace,
      workplaceLat: draft.profile.workplaceLat ?? null,
      workplaceLng: draft.profile.workplaceLng ?? null,
      commutePref: draft.commutePref,
      priorities: draft.priorities,
      lifestyle: draft.lifestyle,
    });
  }, [draft]);

  useEffect(() => {
    if (!matchRequestKey) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: draft.profile, topN: 5 }),
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: unknown) => {
          if (controller.signal.aborted) return;
          setMatches(validMatches(data));
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
        });
    }, MATCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [draft.profile, matchRequestKey]);

  const matchByArea = useMemo(() => {
    const map = new Map<number, RankedMatch>();
    matches.forEach((match) => map.set(match.communityAreaNumber, match));
    return map;
  }, [matches]);
  const boundaryAreas = areas.filter((area) => Boolean(area.boundaryGeojson));
  const reviewMode = draft.stepId === "review";
  const topMatches = reviewMode ? matches : [];
  const workplaceCoords = draft.previewWorkplaceCoords;

  return (
    <div className="atlas-map-shell relative h-full min-h-[160px] overflow-hidden rounded-[var(--radius-md)] border border-white/20 bg-[color:var(--sage-50)] ring-1 ring-black/5">
      <MapContainer
        center={CHICAGO_WORKPLACE_CENTER}
        zoom={CHICAGO_INITIAL_ZOOM}
        zoomControl
        attributionControl={false}
        scrollWheelZoom={false}
        dragging
        touchZoom
        doubleClickZoom
        boxZoom
        className="h-full min-h-[160px] w-full rounded-[var(--radius-md)]"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          opacity={0.28}
        />
        <FitPreviewMap
          areas={areas}
          matches={matches}
          workplaceCoords={workplaceCoords}
          commutePref={draft.commutePref}
          focusMatches={reviewMode}
          variant={variant}
        />

        {boundaryAreas.length > 0
          ? boundaryAreas.map((area) => {
              const match = matchByArea.get(area.communityAreaNumber);
              const dimmed = matches.length > 0 && !match;
              return (
                <GeoJSONLayer
                  key={`${area.communityAreaNumber}-${match?.rank ?? 0}-${reviewMode}`}
                  data={area.boundaryGeojson as GeoJSON.GeoJsonObject}
                  interactive={false}
                  style={() => areaStyle(match?.rank, dimmed, reviewMode)}
                />
              );
            })
          : areas.map((area) => {
              const match = matchByArea.get(area.communityAreaNumber);
              return (
                <CircleMarker
                  key={area.communityAreaNumber}
                  center={areaCenter(area)}
                  radius={match ? 6 : 3}
                  pathOptions={{
                    color: match ? rankStrokeColor(match.rank) : "rgba(79,95,72,0.42)",
                    fillColor: match ? rankColor(match.rank) : COLORS.sageSoft,
                    fillOpacity: match ? Math.min(matchRankFillOpacity(match.rank) + 0.2, 0.72) : 0.32,
                    weight: match ? 2 : 1,
                  }}
                />
              );
            })}

        {topMatches.map((match) => {
          const area = areas.find((item) => item.communityAreaNumber === match.communityAreaNumber);
          if (!area) return null;
          return <Marker key={`match-${match.communityAreaNumber}`} position={areaCenter(area)} icon={rankIcon(match)} />;
        })}

        {workplaceCoords && (
          <>
            <Circle
              center={[workplaceCoords.lat, workplaceCoords.lng]}
              radius={radiusMeters(draft.commutePref)}
              pathOptions={{
                color: COLORS.terracotta,
                fillColor: COLORS.terracotta,
                fillOpacity: 0.06,
                opacity: 0.42,
                weight: 1.4,
                dashArray: "5 5",
              }}
            />
            <Marker position={[workplaceCoords.lat, workplaceCoords.lng]} icon={anchorIcon()} />
          </>
        )}
      </MapContainer>
    </div>
  );
}
