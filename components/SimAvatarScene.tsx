"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { straightLineCoords } from "@/lib/decodePolyline"
import type { DayEvent } from "@/lib/dailySchedule"

const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
const DARK_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

interface Props {
  lat: number
  lng: number
  workplaceCoords?: { lat: number; lng: number } | null
  routeCoords?: [number, number][]
  isAnimating: boolean
  month: number
  schedule?: DayEvent[]
  commuteRouteCoords?: [number, number][]
  onEventChange?: (event: DayEvent) => void
  neighborhoodName?: string
  workplaceName?: string
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnimFrame {
  pos: [number, number]
  eventIdx: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isNear(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  threshold = 0.012,
): boolean {
  return Math.abs(a.lat - b.lat) < threshold && Math.abs(a.lng - b.lng) < threshold
}

function buildFrames(
  schedule: DayEvent[],
  commuteRouteCoords: [number, number][],
  homeCoords: { lat: number; lng: number },
  workCoords: { lat: number; lng: number } | null,
): AnimFrame[] {
  if (schedule.length === 0) return []

  const commuteReverse = commuteRouteCoords.length > 0
    ? ([...commuteRouteCoords].reverse() as [number, number][])
    : []

  const frames: AnimFrame[] = []

  for (let i = 0; i < schedule.length; i++) {
    const evt = schedule[i]
    const nextEvt = schedule[(i + 1) % schedule.length]
    const nextIdx = (i + 1) % schedule.length

    // Dwell frames at this event
    if (evt.dwellTicks > 0) {
      const pos: [number, number] = [evt.location.lat, evt.location.lng]
      for (let t = 0; t < evt.dwellTicks; t++) {
        frames.push({ pos, eventIdx: i })
      }
    }

    // Leg frames toward next event — label shows the DESTINATION event (nextIdx)
    const from = evt.location
    const to = nextEvt.location
    const dist = Math.hypot(from.lat - to.lat, from.lng - to.lng)

    let waypoints: [number, number][]
    if (dist < 0.0001) {
      waypoints = [[to.lat, to.lng]]
    } else if (
      commuteRouteCoords.length >= 2 &&
      workCoords &&
      isNear(from, homeCoords) &&
      isNear(to, workCoords)
    ) {
      waypoints = commuteRouteCoords
    } else if (
      commuteReverse.length >= 2 &&
      workCoords &&
      isNear(from, workCoords) &&
      isNear(to, homeCoords)
    ) {
      waypoints = commuteReverse
    } else {
      waypoints = straightLineCoords(from, to, 15)
    }

    for (const wp of waypoints) {
      frames.push({ pos: wp, eventIdx: nextIdx })
    }
  }

  return frames
}

// ── Map helpers ───────────────────────────────────────────────────────────────

// Fits the map to the bounding box of schedule locations once when schedule is set
function FitSchedule({ coords }: { coords: [number, number][] }) {
  const map = useMap()
  const fitted = useRef(false)
  useEffect(() => {
    if (coords.length < 2 || fitted.current) return
    map.fitBounds(coords, { padding: [40, 40], maxZoom: 14 })
    fitted.current = true
  }, [map, coords])
  // Reset when coords change (new schedule)
  useEffect(() => {
    fitted.current = false
  }, [coords])
  return null
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SimAvatarScene({
  lat,
  lng,
  workplaceCoords,
  routeCoords,
  isAnimating,
  schedule,
  commuteRouteCoords = [],
  onEventChange,
  neighborhoodName,
  workplaceName,
}: Props) {
  // ── Frame-based animation ─────────────────────────────────────────────────
  const [frameIdx, setFrameIdx] = useState(0)
  const frameIdxRef = useRef(0)

  // ── Legacy bounce-back (fallback when no schedule) ────────────────────────
  const [avatarIdx, setAvatarIdx] = useState(0)
  const directionRef = useRef<1 | -1>(1)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevEventIdxRef = useRef<number>(-1)

  const homeCoords = useMemo(() => ({ lat, lng }), [lat, lng])

  const allRouteCoords = useMemo(() => {
    if (routeCoords && routeCoords.length >= 2) return routeCoords
    if (workplaceCoords) return straightLineCoords(homeCoords, workplaceCoords)
    return []
  }, [routeCoords, workplaceCoords, homeCoords])

  const frames = useMemo(
    () =>
      schedule && schedule.length > 0
        ? buildFrames(schedule, commuteRouteCoords, homeCoords, workplaceCoords ?? null)
        : [],
    [schedule, commuteRouteCoords, homeCoords, workplaceCoords],
  )

  // Full day route — all schedule locations in order, closed loop
  const dayRouteCoords = useMemo((): [number, number][] => {
    if (!schedule || schedule.length === 0) return []
    const pts = schedule.map((evt): [number, number] => [evt.location.lat, evt.location.lng])
    return [...pts, pts[0]] // close the loop
  }, [schedule])

  // Bounding box for FitSchedule
  const scheduleBounds = useMemo((): [number, number][] => {
    if (!schedule || schedule.length === 0) return [[lat, lng]]
    return schedule.map((evt): [number, number] => [evt.location.lat, evt.location.lng])
  }, [schedule, lat, lng])

  // Activity spot markers (lunch, park, errand, dinner — exclude home/work/transit/night)
  const activityMarkers = useMemo(() => {
    if (!schedule) return []
    return schedule.filter(
      (evt) =>
        evt.kind !== "home" &&
        evt.kind !== "work" &&
        evt.kind !== "night" &&
        evt.kind !== "transit" &&
        evt.dwellTicks > 0,
    )
  }, [schedule])

  // Currently active event (for highlighting)
  const currentEvent = frames.length > 0 ? (schedule?.[frames[frameIdx]?.eventIdx] ?? null) : null

  // Reset on new frames
  useEffect(() => {
    setFrameIdx(0)
    frameIdxRef.current = 0
    prevEventIdxRef.current = -1
  }, [frames])

  // Main animation interval
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)

    if (!isAnimating) {
      setAvatarIdx(0)
      setFrameIdx(0)
      frameIdxRef.current = 0
      directionRef.current = 1
      return
    }

    if (frames.length > 0) {
      intervalRef.current = setInterval(() => {
        const next = (frameIdxRef.current + 1) % frames.length
        frameIdxRef.current = next
        setFrameIdx(next)
      }, 80)
    } else if (allRouteCoords.length >= 2) {
      intervalRef.current = setInterval(() => {
        setAvatarIdx((prev) => {
          const next = prev + directionRef.current
          if (next >= allRouteCoords.length - 1) {
            directionRef.current = -1
            return allRouteCoords.length - 1
          }
          if (next <= 0) {
            directionRef.current = 1
            return 0
          }
          return next
        })
      }, 80)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isAnimating, frames.length, allRouteCoords.length])

  // Fire onEventChange when event zone changes
  useEffect(() => {
    if (!onEventChange || !schedule || frames.length === 0) return
    const frame = frames[frameIdx]
    if (!frame) return
    const evtIdx = frame.eventIdx
    if (evtIdx !== prevEventIdxRef.current) {
      prevEventIdxRef.current = evtIdx
      const evt = schedule[evtIdx]
      if (evt) onEventChange(evt)
    }
  }, [frameIdx, frames, schedule, onEventChange])

  // Avatar position
  const avatarPos: [number, number] | null =
    frames.length > 0
      ? (frames[frameIdx]?.pos ?? null)
      : allRouteCoords.length > 0
        ? (allRouteCoords[avatarIdx] ?? null)
        : null

  const mapCenter: [number, number] = [lat, lng]

  // Commute route polyline
  const displayRoute = useMemo(() => {
    if (commuteRouteCoords.length >= 2) return commuteRouteCoords
    return allRouteCoords
  }, [commuteRouteCoords, allRouteCoords])

  // Avatar icon
  const avatarIcon = useMemo(() => {
    if (typeof document === "undefined") return null
    if (!document.getElementById("avatar-ping-style")) {
      const s = document.createElement("style")
      s.id = "avatar-ping-style"
      s.textContent = "@keyframes avatar-ping { to { transform: scale(2.4); opacity: 0; } }"
      document.head.appendChild(s)
    }
    return L.divIcon({
      className: "",
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      html: `<div style="position:relative;width:20px;height:20px">
        <div style="position:absolute;inset:-7px;border-radius:50%;background:rgba(58,123,213,0.28);animation:avatar-ping 1.5s cubic-bezier(0,0,0.2,1) infinite"></div>
        <div style="position:absolute;inset:0;border-radius:50%;background:#3a7bd5;border:2.5px solid #fff;box-shadow:0 0 10px rgba(58,123,213,0.75)"></div>
      </div>`,
    })
  }, [])

  return (
    <div className="absolute inset-0">
      <MapContainer
        center={mapCenter}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url={DARK_TILES} attribution={DARK_ATTR} />

        {/* Fit map to schedule bounds once on load */}
        {scheduleBounds.length >= 2 && <FitSchedule coords={scheduleBounds} />}

        {/* Full day life route — faint dashed purple loop */}
        {dayRouteCoords.length >= 3 && (
          <Polyline
            positions={dayRouteCoords}
            pathOptions={{ color: "#9e7fd4", weight: 1.5, opacity: 0.35, dashArray: "3 8" }}
          />
        )}

        {/* Commute route — blue dashed line */}
        {displayRoute.length >= 2 && (
          <Polyline
            positions={displayRoute}
            pathOptions={{ color: "#3a7bd5", weight: 2.5, opacity: 0.5, dashArray: "6 4" }}
          />
        )}

        {/* Home marker */}
        <CircleMarker
          center={mapCenter}
          radius={10}
          pathOptions={{ color: "#1d6f3e", fillColor: "#2da55e", fillOpacity: 0.9, weight: 2 }}
        >
          <Tooltip direction="top" offset={[0, -12]}>
            <span style={{ fontSize: 11, fontWeight: 700 }}>
              {neighborhoodName ? `${neighborhoodName} · Home` : "Home"}
            </span>
          </Tooltip>
        </CircleMarker>

        {/* Workplace marker */}
        {workplaceCoords && (
          <CircleMarker
            center={[workplaceCoords.lat, workplaceCoords.lng]}
            radius={10}
            pathOptions={{ color: "#a0520a", fillColor: "#e8b84b", fillOpacity: 0.9, weight: 2 }}
          >
            <Tooltip direction="top" offset={[0, -12]}>
              <span style={{ fontSize: 11, fontWeight: 700 }}>
                {workplaceName ?? "Workplace"}
              </span>
            </Tooltip>
          </CircleMarker>
        )}

        {/* Activity spot markers — permanent labels, highlight when active */}
        {activityMarkers.map((evt, i) => {
          const isActive = evt === currentEvent
          return (
            <CircleMarker
              key={`activity-${i}`}
              center={[evt.location.lat, evt.location.lng]}
              radius={isActive ? 9 : 5}
              pathOptions={{
                color: isActive ? "#c9a7f0" : "#9e7fd4",
                fillColor: isActive ? "#c9a7f0" : "#9e7fd4",
                fillOpacity: isActive ? 0.9 : 0.5,
                weight: isActive ? 2 : 1,
              }}
            >
              <Tooltip permanent direction="top" offset={[0, -8]}>
                <span style={{ fontSize: 10, fontWeight: 700 }}>
                  {evt.timeLabel} · {evt.activityLabel}
                </span>
              </Tooltip>
            </CircleMarker>
          )
        })}

        {/* Animated avatar */}
        {avatarPos && avatarIcon && (
          <Marker position={avatarPos} icon={avatarIcon} />
        )}
      </MapContainer>

      {/* ── Mini-map inset (city overview) ───────────────────────────────── */}
      <div
        data-testid="mini-map"
        style={{
          position: "absolute",
          bottom: 168,
          right: 16,
          width: 164,
          height: 114,
          zIndex: 1200,
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.18)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
        }}
      >
        <MapContainer
          center={mapCenter}
          zoom={11}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
          dragging={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          touchZoom={false}
          keyboard={false}
          attributionControl={false}
        >
          <TileLayer url={DARK_TILES} />
          <CircleMarker
            center={mapCenter}
            radius={5}
            pathOptions={{ color: "#2da55e", fillColor: "#2da55e", fillOpacity: 0.75, weight: 1 }}
          />
          {avatarPos && (
            <CircleMarker
              center={avatarPos}
              radius={5}
              pathOptions={{ color: "#fff", fillColor: "#3a7bd5", fillOpacity: 1, weight: 2 }}
            />
          )}
        </MapContainer>
        <div
          style={{
            position: "absolute",
            bottom: 5,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 9,
            fontWeight: 700,
            color: "rgba(255,255,255,0.5)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          Neighborhood
        </div>
      </div>
    </div>
  )
}
