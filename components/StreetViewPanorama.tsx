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
  readonly targetHeading?: number
  readonly enableDrift?: boolean
}

export function StreetViewPanorama({ lat, lng, month, targetHeading = 0, enableDrift = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null)
  const headingRef = useRef(0)
  const targetHeadingRef = useRef(targetHeading)
  const driftTimeRef = useRef(0)
  const [ready, setReady] = useState(false)
  const [noImagery, setNoImagery] = useState(false)

  // Keep targetHeadingRef in sync without restarting the heading interval
  useEffect(() => {
    targetHeadingRef.current = targetHeading
  }, [targetHeading])

  useEffect(() => {
    if (!containerRef.current) return

    let cancelled = false
    setReady(false)
    setNoImagery(false)
    panoramaRef.current = null
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
              linksControl: true,
              clickToGo: true,
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
      panoramaRef.current = null
    }
  }, [lat, lng])

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
