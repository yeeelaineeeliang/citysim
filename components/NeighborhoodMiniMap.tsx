"use client"

import { useEffect, useRef, useState } from "react"
import { GeoJSON as GeoJSONLayer, MapContainer, Marker, TileLayer, useMap } from "react-leaflet"
import L from "leaflet"

interface Area {
  communityAreaNumber: number
  name: string
  lat: number
  lng: number
  boundaryGeojson?: GeoJSON.GeoJsonObject | null
}

interface Place {
  id: string
  name: string
  category: string
  lat: number
  lng: number
}

interface Props {
  neighborhoodName: string
  currentLat: number
  currentLng: number
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

function LockToBoundary({ boundary }: { boundary: GeoJSON.GeoJsonObject }) {
  const map = useMap()
  const locked = useRef(false)
  useEffect(() => {
    if (locked.current) return
    try {
      const bounds = L.geoJSON(boundary).getBounds()
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.15))
        locked.current = true
      }
    } catch { /* invalid geojson */ }
  }, [boundary, map])
  return null
}

const BOUNDARY_STYLE = {
  color: "#476f63",
  fillColor: "#476f63",
  fillOpacity: 0.20,
  opacity: 1.0,
  weight: 1.5,
}

// One POI per category, max 4 total
function pickTopPlaces(places: Place[]): Place[] {
  const seen = new Set<string>()
  const picked: Place[] = []
  for (const p of places) {
    if (!seen.has(p.category) && picked.length < 4) {
      seen.add(p.category)
      picked.push(p)
    }
  }
  return picked
}

const CATEGORY_COLOR: Record<string, string> = {
  food: "#e05c2a",
  bar: "#9b59b6",
  park: "#27ae60",
  civic: "#2980b9",
  entertainment: "#e67e22",
}

function poiIcon(place: Place) {
  const color = CATEGORY_COLOR[place.category] ?? "#888"
  const label = place.name.length > 18 ? place.name.slice(0, 17) + "…" : place.name
  return L.divIcon({
    className: "",
    iconAnchor: [3, 3],
    html: `<div style="display:flex;flex-direction:column;align-items:flex-start;gap:1px;pointer-events:none">
      <div style="width:6px;height:6px;border-radius:50%;background:${color};border:1.5px solid rgba(255,255,255,0.9);box-shadow:0 1px 3px rgba(0,0,0,0.35);flex-shrink:0"></div>
      <span style="font-size:7px;font-weight:600;color:#1a1a1a;text-shadow:0 0 3px #fff,0 0 3px #fff;white-space:nowrap;line-height:1">${label}</span>
    </div>`,
  })
}

function neighborhoodLabelIcon(name: string) {
  return L.divIcon({
    className: "",
    iconAnchor: [0, 0],
    html: `<span style="font-size:8px;font-weight:800;letter-spacing:0.10em;text-transform:uppercase;color:#2d4a25;text-shadow:0 0 4px rgba(255,255,255,0.95),0 0 8px rgba(255,255,255,0.7);white-space:nowrap;pointer-events:none">${name}</span>`,
  })
}

export function NeighborhoodMiniMap({ neighborhoodName, currentLat, currentLng, heading }: Props) {
  const [area, setArea] = useState<Area | null>(null)
  const [places, setPlaces] = useState<Place[]>([])

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

  useEffect(() => {
    if (!neighborhoodName) return
    let cancelled = false
    fetch(`/api/places?neighborhood=${encodeURIComponent(neighborhoodName)}&limit=20`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (cancelled || !data) return
        const raw = (data as { places?: unknown[] })?.places ?? []
        const valid = raw.filter((p): p is Place => {
          if (!p || typeof p !== "object") return false
          const x = p as Partial<Place>
          return typeof x.id === "string" && typeof x.name === "string" &&
            typeof x.lat === "number" && typeof x.lng === "number"
        })
        setPlaces(pickTopPlaces(valid))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [neighborhoodName])

  const center: [number, number] = area ? [area.lat, area.lng] : [currentLat, currentLng]

  return (
    <MapContainer
      center={center}
      zoom={13}
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
        url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
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
          <LockToBoundary boundary={area.boundaryGeojson} />
        </>
      )}

      {/* Neighborhood name label at centroid */}
      {area && (
        <Marker
          position={[area.lat, area.lng]}
          interactive={false}
          icon={neighborhoodLabelIcon(area.name)}
        />
      )}

      {/* Top POI markers — one per category */}
      {places.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          interactive={false}
          icon={poiIcon(p)}
        />
      ))}

      {/* User position dot + bearing arrow */}
      <Marker
        position={[currentLat, currentLng]}
        interactive={false}
        icon={L.divIcon({
          className: "",
          iconAnchor: [14, 14],
          html: `<div style="position:relative;width:28px;height:28px">
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:12px;height:12px;border-radius:50%;background:#fff;border:2.5px solid #476f63;box-shadow:0 0 0 1.5px rgba(255,255,255,0.6),0 2px 6px rgba(0,0,0,0.45)"></div>
            ${heading != null ? `<div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%) rotate(${heading}deg);transform-origin:center 22px;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:11px solid #476f63;filter:drop-shadow(0 0 2px rgba(0,0,0,0.4))"></div>` : ""}
          </div>`,
        })}
      />
    </MapContainer>
  )
}
