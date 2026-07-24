"use client";

import { useEffect, useRef, useState } from "react";
import {
  CircleMarker,
  GeoJSON as GeoJSONLayer,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import ReactDOMServer from "react-dom/server";
import type {
  DataSummary,
  EntertainmentPlace,
  EntertainmentSummaryMapAction,
  MapAction,
} from "@/lib/tools/types";
import {
  COLORS,
  areaStyle,
  validAreas,
  validPlace,
  type CommunityAreaMapArea,
} from "@/components/SimulationMap";
import { CartoonAvatar } from "@/components/CartoonAvatar";
import type { AvatarState } from "@/components/CartoonAvatar";
import type { ActSeason } from "@/app/sim/types";

interface SimPlayerMapProps {
  neighborhoodName: string;
  homeCoords: { lat: number; lng: number };
  workplaceCoords: { lat: number; lng: number } | null;
  workplaceName: string;
  simMonth: number;
  isRunning: boolean;
  mapActions: MapAction[];
  season: ActSeason;
  monthDataSummary?: DataSummary;
  /**
   * Which narrative paragraph is currently streaming (1 morning/commute,
   * 2 street feel, 3 evening). The avatar acts out what Sam is narrating
   * instead of running a free-spinning loop.
   */
  narrativePhase?: 1 | 2 | 3;
}

// Time-of-day wash so the minimap matches the act's scene mood.
const SEASON_MAP_TINT: Record<ActSeason, string | null> = {
  spring: null,
  summer: "rgba(255,215,130,0.10)",
  autumn: "rgba(225,130,45,0.12)",
  winter: "rgba(8,15,40,0.35)",
};

type DayPhase = "waking" | "commute" | "at_work" | "heading_out" | "evening" | "home";

/**
 * Narrates the avatar's current activity with the user's own data — workplace,
 * commute minutes, and the real name of the nearest evening spot — so the loop
 * reads as "your day here", not a wandering sprite.
 */
function dayCaption(
  phase: DayPhase,
  season: ActSeason,
  workplaceName: string,
  commuteMinutes: number | null | undefined,
  eveningPlace: EntertainmentPlace | null,
): string {
  const commute = commuteMinutes != null ? `~${commuteMinutes} min` : "your commute";
  switch (phase) {
    case "waking":
      return season === "winter" ? "Morning · a dark, cold start" : "Morning · out the door";
    case "commute":
      return `${commute} to ${workplaceName}`;
    case "at_work":
      return `Your day at ${workplaceName}`;
    case "heading_out":
      return eveningPlace ? `Evening · heading to ${eveningPlace.name}` : "Evening · out on the block";
    case "evening":
      return eveningPlace
        ? `${eveningPlace.category === "bar" ? "Drinks" : "Dinner"} at ${eveningPlace.name}`
        : "Evening out nearby";
    case "home":
      return season === "winter" ? "In early — it's dark by 4:30" : "Back home";
  }
}

function lerp(a: { lat: number; lng: number }, b: { lat: number; lng: number }, t: number) {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

function nearestPlace(target: { lat: number; lng: number }, places: EntertainmentPlace[]): EntertainmentPlace | null {
  if (!places.length) return null;
  let best = places[0]!;
  let bestDist = Infinity;
  for (const p of places) {
    const d = Math.hypot(p.lat - target.lat, p.lng - target.lng);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best;
}

function avatarIcon(season: ActSeason, state: AvatarState) {
  return L.divIcon({
    className: "",
    html: ReactDOMServer.renderToStaticMarkup(
      <CartoonAvatar season={season} state={state} size={40} />,
    ),
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  });
}


interface MapCameraControllerProps {
  targetRef: React.MutableRefObject<{ lat: number; lng: number } | null>;
  triggerRef: React.MutableRefObject<number>;
}

function MapCameraController({ targetRef, triggerRef }: MapCameraControllerProps) {
  const map = useMap();
  const lastFlyRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastTriggerRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      const target = targetRef.current;
      const trigger = triggerRef.current;
      if (!target || trigger === lastTriggerRef.current) return;
      lastTriggerRef.current = trigger;
      if (lastFlyRef.current) {
        const dist = Math.hypot(target.lat - lastFlyRef.current.lat, target.lng - lastFlyRef.current.lng);
        if (dist < 0.003) return;
      }
      lastFlyRef.current = target;
      map.flyTo([target.lat, target.lng], 15, { duration: 0.8 });
    }, 100);
    return () => clearInterval(id);
  }, [map, targetRef, triggerRef]);

  return null;
}

export function SimPlayerMap({
  neighborhoodName,
  homeCoords,
  workplaceCoords,
  workplaceName,
  simMonth,
  isRunning,
  mapActions,
  season,
  monthDataSummary,
}: SimPlayerMapProps) {
  const [boundary, setBoundary] = useState<CommunityAreaMapArea | null>(null);
  const [poiPlaces, setPoiPlaces] = useState<EntertainmentPlace[]>([]);
  const [avatarCoords, setAvatarCoords] = useState<{ lat: number; lng: number }>(homeCoords);
  const [avatarState, setAvatarState] = useState<AvatarState>("at_home");
  const [dayPhase, setDayPhase] = useState<DayPhase>("waking");
  const [eveningPlace, setEveningPlace] = useState<EntertainmentPlace | null>(null);

  const cameraTargetRef = useRef<{ lat: number; lng: number } | null>(null);
  const cameraTriggerRef = useRef(0);

  // Load boundary
  useEffect(() => {
    fetch("/api/community-areas")
      .then((r) => r.ok ? r.json() : null)
      .then((data: unknown) => {
        const areas = validAreas(data);
        const match = areas.find((a) => a.name.toLowerCase() === neighborhoodName.toLowerCase());
        setBoundary(match ?? null);
      })
      .catch(() => {});
  }, [neighborhoodName]);

  // Load POIs
  useEffect(() => {
    const entertainmentAction = mapActions.find(
      (a): a is EntertainmentSummaryMapAction => a.type === "entertainment_summary",
    );
    const actionPlaces: EntertainmentPlace[] = (entertainmentAction?.places ?? []).filter(
      (p) => p.category === "food" || p.category === "bar",
    );

    fetch(`/api/places?neighborhood=${encodeURIComponent(neighborhoodName)}&limit=60`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: unknown) => {
        const items: EntertainmentPlace[] = [];
        if (data && typeof data === "object" && "places" in data && Array.isArray((data as { places: unknown[] }).places)) {
          for (const raw of (data as { places: unknown[] }).places) {
            const p = validPlace(raw);
            if (p && (p.category === "food" || p.category === "bar")) items.push(p);
          }
        }
        const merged = [...items];
        for (const ap of actionPlaces) {
          if (!merged.some((p) => p.id === ap.id)) merged.push(ap);
        }
        setPoiPlaces(merged);
      })
      .catch(() => {
        setPoiPlaces(actionPlaces);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neighborhoodName, mapActions]);

  // Animation
  useEffect(() => {
    if (!isRunning) return;

    const work = workplaceCoords ?? homeCoords;
    const eveningSpot = nearestPlace(work, poiPlaces);
    const evening = eveningSpot ? { lat: eveningSpot.lat, lng: eveningSpot.lng } : homeCoords;
    setEveningPlace(eveningSpot);

    let rafId: number;
    const startTime = performance.now();

    function tick() {
      const elapsed = (performance.now() - startTime) / 1000;

      let pos: { lat: number; lng: number };
      let state: AvatarState;
      let phase: DayPhase;

      if (elapsed < 1.0) {
        pos = homeCoords;
        state = "at_home";
        phase = "waking";
      } else if (elapsed < 2.5) {
        const t = (elapsed - 1.0) / 1.5;
        pos = lerp(homeCoords, work, Math.min(t, 1));
        state = "walking";
        phase = "commute";
      } else if (elapsed < 3.0) {
        pos = work;
        state = "at_work";
        phase = "at_work";
      } else if (elapsed < 4.0) {
        const t = (elapsed - 3.0) / 1.0;
        pos = lerp(work, evening, Math.min(t, 1));
        state = "walking";
        phase = "heading_out";
      } else if (elapsed < 4.5) {
        pos = evening;
        state = "at_evening";
        phase = "evening";
      } else if (elapsed < 5.5) {
        const t = (elapsed - 4.5) / 1.0;
        pos = lerp(evening, homeCoords, Math.min(t, 1));
        state = "walking";
        phase = "home";
      } else {
        pos = homeCoords;
        state = "at_home";
        phase = "home";
      }

      setAvatarCoords(pos);
      setAvatarState(state);
      setDayPhase(phase);

      // Camera waypoints
      if (elapsed >= 2.5 && elapsed < 2.6 && workplaceCoords) {
        cameraTargetRef.current = work;
        cameraTriggerRef.current += 1;
      } else if (elapsed >= 4.0 && elapsed < 4.1) {
        cameraTargetRef.current = evening;
        cameraTriggerRef.current += 1;
      } else if (elapsed >= 5.5 && elapsed < 5.6) {
        cameraTargetRef.current = homeCoords;
        cameraTriggerRef.current += 1;
      }

      if (elapsed < 6.5) {
        rafId = requestAnimationFrame(tick);
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simMonth, isRunning]);

  const tint = SEASON_MAP_TINT[season];

  return (
    <div className="flex w-full flex-col">
      {/* Day narration — ties the avatar loop to the user's own routine. */}
      <div className="flex flex-col gap-0.5 border-b border-white/12 bg-black/68 px-2.5 py-1.5 backdrop-blur-sm">
        <span className="text-[8px] font-bold uppercase tracking-widest text-white/45">
          Your day here
        </span>
        <span className="truncate text-[10px] font-bold leading-tight text-white" key={dayPhase}>
          {dayCaption(dayPhase, season, workplaceName, monthDataSummary?.commuteMinutes, eveningPlace)}
        </span>
      </div>

      <div className="relative h-[112px] w-[132px] sm:h-[160px] sm:w-[190px]">
      <MapContainer
        center={[homeCoords.lat, homeCoords.lng]}
        zoom={14}
        zoomControl={false}
        attributionControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />

        {boundary?.boundaryGeojson && (
          <GeoJSONLayer
            data={boundary.boundaryGeojson}
            style={areaStyle(true)}
          />
        )}

        {/* Home marker */}
        <CircleMarker
          center={[homeCoords.lat, homeCoords.lng]}
          radius={5}
          pathOptions={{ color: COLORS.sage, fillColor: COLORS.sage, fillOpacity: 1, weight: 2 }}
        />

        {/* Workplace marker */}
        {workplaceCoords && (
          <CircleMarker
            center={[workplaceCoords.lat, workplaceCoords.lng]}
            radius={5}
            pathOptions={{ color: COLORS.ink, fillColor: COLORS.ink, fillOpacity: 1, weight: 2 }}
          />
        )}

        {/* POI dots */}
        {poiPlaces.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={3}
            pathOptions={{ color: COLORS.terracotta, fillColor: COLORS.terracotta, fillOpacity: 0.55, weight: 1 }}
          />
        ))}

        {/* CartoonAvatar */}
        <Marker
          key={avatarState}
          position={[avatarCoords.lat, avatarCoords.lng]}
          icon={avatarIcon(season, avatarState)}
        />

        <MapCameraController targetRef={cameraTargetRef} triggerRef={cameraTriggerRef} />
      </MapContainer>

      {/* Season/time-of-day wash so the minimap matches the act's mood. */}
      {tint && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[500]"
          style={{ background: tint }}
        />
      )}
      </div>
    </div>
  );
}
