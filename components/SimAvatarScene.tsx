"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { straightLineCoords } from "@/lib/decodePolyline"

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
}

// Pans the main map to keep the avatar visible
function CameraFollow({ position }: { position: [number, number] }) {
  const map = useMap()
  const prevRef = useRef<[number, number] | null>(null)
  useEffect(() => {
    const [lat, lng] = position
    const prev = prevRef.current
    if (!prev || Math.abs(prev[0] - lat) > 0.0001 || Math.abs(prev[1] - lng) > 0.0001) {
      map.panTo(position, { animate: true, duration: 0.5 })
      prevRef.current = position
    }
  }, [position, map])
  return null
}

export function SimAvatarScene({ lat, lng, workplaceCoords, routeCoords, isAnimating }: Props) {
  const [avatarIdx, setAvatarIdx] = useState(0)
  const directionRef = useRef<1 | -1>(1)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const allRouteCoords: [number, number][] = useMemo(() => {
    if (routeCoords && routeCoords.length >= 2) return routeCoords
    if (workplaceCoords) return straightLineCoords({ lat, lng }, workplaceCoords)
    return []
  }, [routeCoords, workplaceCoords, lat, lng])

  // Inject avatar ping keyframe once
  const avatarIcon = useMemo(() => {
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

  // Bounce-back animation along route
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (!isAnimating || allRouteCoords.length < 2) {
      setAvatarIdx(0)
      directionRef.current = 1
      return
    }
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
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isAnimating, allRouteCoords.length])

  const avatarPos: [number, number] | null =
    allRouteCoords.length > 0 ? (allRouteCoords[avatarIdx] ?? null) : null

  const mapCenter: [number, number] = [lat, lng]

  return (
    <div className="absolute inset-0">
      {/* Main full-screen dark map */}
      <MapContainer
        center={mapCenter}
        zoom={16}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url={DARK_TILES} attribution={DARK_ATTR} />
        {avatarPos && <CameraFollow position={avatarPos} />}

        {/* Commute route */}
        {allRouteCoords.length >= 2 && (
          <Polyline
            positions={allRouteCoords}
            pathOptions={{ color: "#3a7bd5", weight: 2.5, opacity: 0.45, dashArray: "6 4" }}
          />
        )}

        {/* Home marker */}
        <CircleMarker
          center={mapCenter}
          radius={10}
          pathOptions={{ color: "#1d6f3e", fillColor: "#2da55e", fillOpacity: 0.9, weight: 2 }}
        />

        {/* Workplace marker */}
        {workplaceCoords && (
          <CircleMarker
            center={[workplaceCoords.lat, workplaceCoords.lng]}
            radius={10}
            pathOptions={{ color: "#a0520a", fillColor: "#e8b84b", fillOpacity: 0.9, weight: 2 }}
          />
        )}

        {/* Animated avatar */}
        {avatarPos && <Marker position={avatarPos} icon={avatarIcon} />}
      </MapContainer>

      {/* ── Mini-map inset (game HUD corner) ─────────────────────────────── */}
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
          zoom={13}
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
          {/* Neighborhood home anchor */}
          <CircleMarker
            center={mapCenter}
            radius={5}
            pathOptions={{ color: "#2da55e", fillColor: "#2da55e", fillOpacity: 0.75, weight: 1 }}
          />
          {/* Live avatar position */}
          {avatarPos && (
            <CircleMarker
              center={avatarPos}
              radius={5}
              pathOptions={{ color: "#fff", fillColor: "#3a7bd5", fillOpacity: 1, weight: 2 }}
            />
          )}
        </MapContainer>
        {/* HUD label */}
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
