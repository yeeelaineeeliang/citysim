"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef, useState } from "react"
import { Skybox } from "./Skybox"

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
  const [currentIdx, setCurrentIdx] = useState(0)
  const [noImagery, setNoImagery] = useState(false)
  const [crossfading, setCrossfading] = useState(false)
  const prevIdx = useRef(currentIdx)

  const heading = useMemo<number | null>(() => {
    if (sequence.length < 2) return null
    const from = currentIdx > 0 ? sequence[currentIdx - 1] : sequence[0]
    const to   = currentIdx > 0 ? sequence[currentIdx]     : sequence[1]
    return computeBearing(from, to)
  }, [sequence, currentIdx])

  useEffect(() => {
    let cancelled = false
    setSequence([])
    setCurrentIdx(0)
    setNoImagery(false)

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

  useEffect(() => {
    if (currentIdx === prevIdx.current) return
    prevIdx.current = currentIdx
    setCrossfading(true)
    const t = setTimeout(() => setCrossfading(false), 150)
    return () => clearTimeout(t)
  }, [currentIdx])

  const timeProgress = Math.max(0, Math.min(1, (hourOfDay - 7) / 16))

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

  const current = sequence[currentIdx]
  const tint = timeOfDayStyle(hourOfDay, month)

  return (
    <div className="relative h-full w-full">
      <iframe
        key={current.id}
        src={`https://www.mapillary.com/embed?image_key=${current.id}&is_panoramic_viewer=true&component_imageNavigation=false&component_sequence=false`}
        className="absolute inset-0 h-full w-full border-0"
        allowFullScreen
      />

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

      {/* Crossfade flash on navigation */}
      {crossfading && (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 25,
            background: 'rgb(0,0,0)',
            opacity: 0.45,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* ← navigation button */}
      {currentIdx > 0 && (
        <button
          onClick={() => setCurrentIdx((i) => i - 1)}
          style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            zIndex: 30, width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(0,0,0,0.50)', color: '#fff',
            border: 'none', cursor: 'pointer', fontSize: 18,
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'auto',
          }}
          aria-label="Previous image"
        >
          ←
        </button>
      )}

      {/* → navigation button */}
      {currentIdx < sequence.length - 1 && (
        <button
          onClick={() => setCurrentIdx((i) => i + 1)}
          style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            zIndex: 30, width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(0,0,0,0.50)', color: '#fff',
            border: 'none', cursor: 'pointer', fontSize: 18,
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'auto',
          }}
          aria-label="Next image"
        >
          →
        </button>
      )}

      {/* Neighborhood overview mini-map */}
      {neighborhoodName && (
        <div
          style={{
            position: 'absolute', bottom: 14, right: 14, zIndex: 20,
            width: 200, height: 140,
            borderRadius: 10, overflow: 'hidden',
            border: '1.5px solid rgba(255,255,255,0.30)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.55)',
          }}
        >
          <NeighborhoodMiniMap
            neighborhoodName={neighborhoodName}
            currentLat={current.lat}
            currentLng={current.lng}
            heading={heading}
          />
        </div>
      )}
    </div>
  )
}
