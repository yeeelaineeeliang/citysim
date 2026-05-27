"use client"

import { useEffect, useRef, useState } from "react"
import { CircleMarker, GeoJSON as GeoJSONLayer, MapContainer, Marker, TileLayer, useMap } from "react-leaflet"
import L from "leaflet"

interface Area {
  communityAreaNumber: number
  name: string
  lat: number
  lng: number
  boundaryGeojson?: GeoJSON.GeoJsonObject | null
}

interface Props {
  neighborhoodName: string
  currentLat: number
  currentLng: number
  sequencePoints?: { lat: number; lng: number }[]
  heading?: number | null
}

function normalizeName(v: string) { return v.toLowerCase().trim() }

function validAreas(data: unknown): Area[] {
  if (!data || typeof data !== "object" || !("areas" in data)) return []
  const areas = (data as { areas?: unknown }).areas
  if (!Array.isArray(areas)) return []
  return areas.filter((a): a is Area => {
    if (!a || typeof a !== "object") return false
    const item = a as Partial<Area>
    return typeof item.communityAreaNumber === "number" && typeof item.name === "string"
  })
}

function FitToBoundary({ boundary }: { boundary: GeoJSON.GeoJsonObject }) {
  const map = useMap()
  useEffect(() => {
    try {
      const bounds = L.geoJSON(boundary).getBounds()
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.12))
    } catch { /* invalid geojson */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundary])
  return null
}

function FitToPoints({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    const bounds = L.latLngBounds(points.map((p) => L.latLng(p.lat, p.lng)))
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.5))
    else map.setView([points[0].lat, points[0].lng], 16)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

function CameraFollower({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  const initialized = useRef(false)
  useEffect(() => {
    if (!initialized.current) {
      map.setView([lat, lng], 16, { animate: false })
      initialized.current = true
    } else {
      map.panTo([lat, lng], { animate: true, duration: 0.35 })
    }
  }, [lat, lng, map])
  return null
}

const BOUNDARY_STYLE = {
  color: "#c76545",
  fillColor: "#dfe8d4",
  fillOpacity: 0.45,
  opacity: 0.85,
  weight: 2,
}

export function NeighborhoodMiniMap({ neighborhoodName, currentLat, currentLng, sequencePoints, heading }: Props) {
  const [area, setArea] = useState<Area | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/community-areas")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (cancelled) return
        const match = validAreas(data).find(
          (a) => normalizeName(a.name) === normalizeName(neighborhoodName),
        )
        setArea(match ?? null)
      })
      .catch(() => { if (!cancelled) setArea(null) })
    return () => { cancelled = true }
  }, [neighborhoodName])

  const center: [number, number] = area
    ? [area.lat, area.lng]
    : [currentLat, currentLng]

  return (
    <MapContainer
      center={center}
      zoom={16}
      className="h-full w-full"
      zoomControl={false}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      keyboard={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution=""
      />

      {area?.boundaryGeojson && (
        <>
          <GeoJSONLayer
            key={area.communityAreaNumber}
            data={area.boundaryGeojson}
            interactive={false}
            style={() => BOUNDARY_STYLE}
          />
          {!sequencePoints?.length && <FitToBoundary boundary={area.boundaryGeojson} />}
        </>
      )}

      <CameraFollower lat={currentLat} lng={currentLng} />

      {sequencePoints?.map((pt, i) => (
        <CircleMarker
          key={i}
          center={[pt.lat, pt.lng]}
          radius={4}
          pathOptions={{ fillColor: "#888", fillOpacity: 0.7, stroke: false }}
        />
      ))}

      <Marker
        position={[currentLat, currentLng]}
        interactive={false}
        icon={L.divIcon({
          className: '',
          iconAnchor: [12, 12],
          html: `<div style="position:relative;width:24px;height:24px">
            <div style="position:absolute;inset:4px;border-radius:50%;background:#e84040;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.5)"></div>
            ${heading != null ? `<div style="position:absolute;top:-6px;left:50%;transform:translateX(-50%) rotate(${heading}deg);transform-origin:center 18px;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:11px solid #e84040;filter:drop-shadow(0 0 2px rgba(0,0,0,0.6))"></div>` : ''}
          </div>`,
        })}
      />
    </MapContainer>
  )
}
