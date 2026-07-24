"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef, useState } from "react"
import { Skybox } from "./Skybox"
import { sunLight, compassLabel, timeLabel } from "@/lib/sunPosition"
import type { Viewer as MapillaryViewer } from "mapillary-js"
import "mapillary-js/dist/mapillary.css"

const CityViewScene = dynamic(
  () => import("./CityViewScene").then((m) => m.CityViewScene),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-[#0d1520]" /> },
)

const NeighborhoodMiniMap = dynamic(
  () => import("./NeighborhoodMiniMap").then((m) => m.NeighborhoodMiniMap),
  { ssr: false },
)

interface Props {
  readonly lat: number
  readonly lng: number
  readonly month: number
  readonly hourOfDay?: number
  readonly neighborhoodName?: string
  readonly targetHeading?: number  // kept for prop compatibility
  readonly enableDrift?: boolean   // kept for prop compatibility
}

type SeqItem = { id: string; lat: number; lng: number }

function computeBearing(from: SeqItem, to: SeqItem): number {
  const toRad = (d: number) => d * Math.PI / 180
  const dLng = toRad(to.lng - from.lng)
  const lat1 = toRad(from.lat), lat2 = toRad(to.lat)
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

function timeOfDayStyle(hour: number, month: number): { background: string; opacity: number } | null {
  const isWinter = month === 12 || month <= 2
  const isSummer = month >= 6 && month <= 8

  if (hour >= 22 || hour < 5)  return { background: 'rgb(5,10,30)',    opacity: 0.72 }
  if (hour < 7)                return { background: 'rgb(20,35,80)',   opacity: 0.48 }
  if (hour < 9)                return { background: isWinter ? 'rgb(30,50,110)' : 'rgb(80,110,170)', opacity: isWinter ? 0.32 : 0.12 }
  if (hour < 17) {
    if (isWinter) return { background: 'rgb(160,185,220)', opacity: 0.10 }
    if (isSummer) return { background: 'rgb(255,220,150)', opacity: 0.07 }
    return null
  }
  if (hour < 20)               return { background: 'rgb(200,110,35)',  opacity: 0.22 }
  return                              { background: 'rgb(30,18,50)',    opacity: 0.42 }
}

export function MapillaryStreetView({ lat, lng, month, hourOfDay = 12, neighborhoodName = "" }: Props) {
  const [sequence, setSequence] = useState<SeqItem[]>([])
  const [noImagery, setNoImagery] = useState(false)
  const [viewerBearing, setViewerBearing] = useState<number | null>(null)
  const [viewerPosition, setViewerPosition] = useState<{ lat: number; lng: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<MapillaryViewer | null>(null)

  // GPS travel-direction bearing between first two photos (fallback until user pans)
  const heading = useMemo<number | null>(() => {
    if (sequence.length < 2) return null
    return computeBearing(sequence[0], sequence[1])
  }, [sequence])

  // Fetch image sequence for this location
  useEffect(() => {
    let cancelled = false
    setSequence([])
    setNoImagery(false)
    setViewerBearing(null)
    setViewerPosition(null)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)

    fetch(`/api/mapillary-image?lat=${lat}&lng=${lng}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: unknown) => {
        clearTimeout(timeout)
        if (cancelled) return
        const images = (data as { images?: SeqItem[] })?.images
        if (images && images.length > 0) setSequence(images)
        else setNoImagery(true)
      })
      .catch(() => {
        clearTimeout(timeout)
        if (!cancelled) setNoImagery(true)
      })

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timeout)
    }
  }, [lat, lng])

  // Create SDK Viewer when sequence is ready; destroy and recreate on location change
  useEffect(() => {
    if (!containerRef.current || sequence.length === 0) return

    let cancelled = false
    let failTimer: number | null = null

    import("mapillary-js").then(({ Viewer }) => {
      if (cancelled || !containerRef.current) return

      viewerRef.current?.remove()

      const viewer = new Viewer({
        accessToken: process.env.NEXT_PUBLIC_MAPILLARY_TOKEN ?? "",
        container: containerRef.current,
        imageId: sequence[0].id,
        component: { cover: false, sequence: false },
      })

      // Same class of silent failure as CinematicStreetPano: a bad token,
      // deleted/private image, or rate limit fails internally with no event
      // and no error callback — fall back to the CityViewScene render instead
      // of leaving the panel stuck on "Loading street imagery…" forever.
      let imageLoaded = false
      failTimer = window.setTimeout(() => {
        if (!cancelled && !imageLoaded) setNoImagery(true)
      }, 8000)

      // Track live camera bearing so the minimap cone stays in sync
      viewer.on("bearing", (e: { bearing: number }) => {
        setViewerBearing(e.bearing)
      })

      // Track exact image position so the minimap dot moves as user walks
      viewer.on("image", (e: { image: { lngLat: { lat: number; lng: number } } }) => {
        imageLoaded = true
        if (failTimer !== null) window.clearTimeout(failTimer)
        setViewerPosition({ lat: e.image.lngLat.lat, lng: e.image.lngLat.lng })
      })

      viewerRef.current = viewer
    }).catch(() => {
      if (!cancelled) setNoImagery(true)
    })

    return () => {
      cancelled = true
      if (failTimer !== null) window.clearTimeout(failTimer)
      setViewerBearing(null)
    }
  }, [sequence])

  // Destroy viewer on unmount
  useEffect(() => {
    return () => {
      viewerRef.current?.remove()
      viewerRef.current = null
    }
  }, [])

  const timeProgress = Math.max(0, Math.min(1, (hourOfDay - 7) / 16))
  const sun = sunLight(timeProgress, month, lat, lng)
  const sunVisible = sun.altitude > 0

  if (noImagery) {
    return (
      <div className="absolute inset-0">
        <CityViewScene lat={lat} lng={lng} month={month} timeProgress={timeProgress} mapActions={[]} />
      </div>
    )
  }

  if (sequence.length === 0) {
    return (
      <div className="relative h-full w-full">
        <Skybox month={month} crimeSignal={0} serviceSignal={null} transitSignal={0} fullBleed showElements />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="rounded bg-black/45 px-3 py-1.5 text-xs text-white/70 backdrop-blur">
            Loading street imagery…
          </span>
        </div>
      </div>
    )
  }

  const fallback = sequence[0]
  const tint = timeOfDayStyle(hourOfDay, month)
  const displayBearing = viewerBearing ?? heading

  return (
    <div className="relative h-full w-full">
      {/* Mapillary SDK renders into this container */}
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      {/* Time-of-day tint */}
      {tint && (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 10,
            background: tint.background,
            opacity: tint.opacity,
            pointerEvents: 'none',
            transition: 'background 2s ease, opacity 2s ease',
          }}
        />
      )}

      {/* Sun compass — bottom-left, away from minimap */}
      <div
        className="pointer-events-none absolute bottom-8 left-3 z-20 flex flex-col items-start gap-1.5"
        style={{ opacity: sunVisible ? 1 : 0.35, transition: 'opacity 0.8s ease' }}
      >
        <div className="rounded-full border border-white/20 bg-black/50 p-2 backdrop-blur-sm">
          <svg width="36" height="36" viewBox="-18 -18 36 36">
            <circle r="13" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <line
              x1="0" y1="0"
              x2={Math.sin(sun.azimuthDeg * Math.PI / 180) * 11}
              y2={-Math.cos(sun.azimuthDeg * Math.PI / 180) * 11}
              stroke={sunVisible ? '#fbbf24' : '#6b7280'}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle
              cx={Math.sin(sun.azimuthDeg * Math.PI / 180) * 11}
              cy={-Math.cos(sun.azimuthDeg * Math.PI / 180) * 11}
              r="2.5"
              fill={sunVisible ? '#fbbf24' : '#6b7280'}
            />
            <text textAnchor="middle" y="5" fontSize="5" fill="rgba(255,255,255,0.5)" fontFamily="system-ui">N</text>
          </svg>
        </div>
        <div className="rounded-md border border-white/15 bg-black/50 px-2 py-1 backdrop-blur-sm">
          <p className="text-[10px] font-semibold leading-tight text-white/80">
            {timeLabel(timeProgress)} · {sunVisible ? compassLabel(sun.azimuthDeg) + ' light' : 'Night'}
          </p>
        </div>
      </div>

      {/* Neighborhood overview mini-map — bearing and position track live viewer state */}
      {neighborhoodName && (
        <div
          style={{
            position: 'absolute', bottom: 14, right: 14, zIndex: 20,
            width: 240, height: 180,
            borderRadius: 8, overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.20)',
            boxShadow: '0 2px 16px rgba(0,0,0,0.60)',
          }}
        >
          <NeighborhoodMiniMap
            neighborhoodName={neighborhoodName}
            currentLat={viewerPosition?.lat ?? fallback.lat}
            currentLng={viewerPosition?.lng ?? fallback.lng}
            heading={displayBearing}
          />
        </div>
      )}
    </div>
  )
}
