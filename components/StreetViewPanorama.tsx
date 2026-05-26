/// <reference types="@types/google.maps" />
"use client"

import { useEffect, useRef, useState } from "react"
import { setOptions, importLibrary } from "@googlemaps/js-api-loader"
import { Skybox } from "./Skybox"

setOptions({
  key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  v: "weekly",
})

interface Props {
  readonly lat: number
  readonly lng: number
  readonly month: number
  readonly hourOfDay?: number
  readonly targetHeading?: number
  readonly enableDrift?: boolean
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

export function StreetViewPanorama({ lat, lng, month, hourOfDay = 12, targetHeading = 0, enableDrift = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null)
  const headingRef = useRef(0)
  const targetHeadingRef = useRef(targetHeading)
  const driftTimeRef = useRef(0)
  const crossfadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [ready, setReady] = useState(false)
  const [noImagery, setNoImagery] = useState(false)
  const [crossfading, setCrossfading] = useState(false)

  // Keep targetHeadingRef in sync without restarting the heading interval
  useEffect(() => {
    targetHeadingRef.current = targetHeading
  }, [targetHeading])

  useEffect(() => {
    // If panorama already mounted, smooth position update with crossfade — no remount
    if (panoramaRef.current) {
      setCrossfading(true)
      panoramaRef.current.setPosition({ lat, lng })
      if (crossfadeTimerRef.current) clearTimeout(crossfadeTimerRef.current)
      crossfadeTimerRef.current = setTimeout(() => setCrossfading(false), 1000)
      return
    }

    if (!containerRef.current) return

    let cancelled = false
    setReady(false)
    setNoImagery(false)
    headingRef.current = 0

    importLibrary("streetView")
      .then((lib) => {
        const container = containerRef.current
        if (cancelled || !container) return

        const { StreetViewService, StreetViewStatus, StreetViewSource, StreetViewPanorama: Panorama } = lib

        const svc = new StreetViewService()
        svc.getPanorama(
          { location: { lat, lng }, radius: 100, source: StreetViewSource.OUTDOOR },
          (data, status) => {
            if (cancelled) return
            if (status !== StreetViewStatus.OK || !data?.location?.latLng) {
              setNoImagery(true)
              return
            }

            container.innerHTML = ""
            const pano = new Panorama(container, {
              position: data.location.latLng,
              pov: { heading: 0, pitch: -3 },
              zoom: 1,
              addressControl: false,
              fullscreenControl: false,
              motionTracking: false,
              motionTrackingControl: false,
              showRoadLabels: false,
              zoomControl: false,
              panControl: false,
              linksControl: false,
              clickToGo: false,
            })
            panoramaRef.current = pano
            setReady(pano.getVisible() !== false)
          },
        )
      })
      .catch(() => {
        if (!cancelled) setNoImagery(true)
      })

    return () => {
      cancelled = true
    }
  }, [lat, lng])

  // Null refs on unmount only — not on lat/lng changes
  useEffect(() => {
    return () => {
      panoramaRef.current = null
      if (crossfadeTimerRef.current) clearTimeout(crossfadeTimerRef.current)
    }
  }, [])

  // Heading drift + smooth interpolation toward targetHeading — opt-in only
  useEffect(() => {
    if (!ready || !enableDrift) return

    const interval = setInterval(() => {
      const pano = panoramaRef.current
      if (!pano) return

      const target = targetHeadingRef.current
      let delta = target - headingRef.current
      // Normalize to [-180, 180] so we always rotate the short way
      while (delta > 180) delta -= 360
      while (delta < -180) delta += 360

      headingRef.current += delta * 0.06

      // Slow sine-wave drift: ±12° over ~7 minutes — imperceptible as oscillation
      driftTimeRef.current += 0.003
      const drift = Math.sin(driftTimeRef.current) * 12

      pano.setPov({ heading: headingRef.current + drift, pitch: -3 })
    }, 200)

    return () => clearInterval(interval)
  }, [ready, enableDrift])

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ opacity: ready ? 1 : 0, transition: "opacity 0.4s" }}
      />

      {/* Time-of-day tint */}
      {(() => {
        const style = timeOfDayStyle(hourOfDay, month)
        return style ? (
          <div
            style={{
              position: 'absolute', inset: 0, zIndex: 10,
              background: style.background,
              opacity: style.opacity,
              pointerEvents: 'none',
              transition: 'background 2s ease, opacity 2s ease',
            }}
          />
        ) : null
      })()}

      {/* Position-change crossfade — covers the Street View black flash on setPosition() */}
      <div
        style={{
          position: 'absolute', inset: 0, zIndex: 15,
          background: 'rgb(8,14,22)',
          opacity: crossfading ? 1 : 0,
          transition: crossfading ? 'opacity 0.15s ease' : 'opacity 0.5s ease',
          pointerEvents: 'none',
        }}
      />

      {/* Input block — prevents Street View click-to-navigate and drag while sim is running */}
      {enableDrift && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 20, cursor: 'default' }} />
      )}

      {!ready && (
        <div className="absolute inset-0">
          <Skybox month={month} crimeSignal={0} serviceSignal={null} transitSignal={0} fullBleed showElements />
          {!noImagery && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded bg-black/45 px-3 py-1.5 text-xs text-white/70 backdrop-blur">
                Loading street view…
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
