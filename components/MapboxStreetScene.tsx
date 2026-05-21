"use client"

import { useEffect, useRef } from "react"
import { Skybox } from "./Skybox"

interface Props {
  lat: number
  lng: number
  month: number
  heading?: number
}

// Midday palette — street scene is always "current time of day" neutral
function streetColors() {
  return { bldLow: '#406080', bldMid: '#5278a0', bldHigh: '#6898be', fogColor: '#1e2e48', fogHigh: '#304870' }
}

type MapboxMap = {
  isStyleLoaded: () => boolean
  getLayer: (id: string) => unknown
  addLayer: (layer: unknown) => void
  setPaintProperty: (id: string, prop: string, val: unknown) => void
  setFog: (fog: unknown) => void
  setBearing: (b: number) => void
  resize: () => void
  remove: () => void
}

export function MapboxStreetScene({ lat, lng, month, heading = 0 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const bearingRef = useRef(heading)
  const orbitRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  useEffect(() => {
    if (!containerRef.current || !token) return
    let cancelled = false

    const init = async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      if (cancelled || !containerRef.current) return

      mapboxgl.accessToken = token
      bearingRef.current = heading

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [lng, lat],
        zoom: 15.5,
        pitch: 62,
        bearing: heading,
        antialias: true,
        interactive: false,
        attributionControl: false,
      }) as unknown as MapboxMap

      mapRef.current = map

      // Deferred resize ensures Mapbox sees the container's real dimensions after layout
      requestAnimationFrame(() => { if (!cancelled) map.resize() })

      ;(map as unknown as { on: (e: string, cb: () => void) => void }).on('load', () => {
        if (cancelled) return

        map.resize()

        const { bldLow, bldMid, bldHigh, fogColor, fogHigh } = streetColors()

        map.addLayer({
          id: 'street-buildings',
          type: 'fill-extrusion',
          source: 'composite',
          'source-layer': 'building',
          minzoom: 12,
          paint: {
            'fill-extrusion-color': [
              'interpolate', ['linear'], ['coalesce', ['get', 'height'], 5],
              0,   bldLow,
              30,  bldMid,
              100, bldHigh,
            ],
            'fill-extrusion-height': ['coalesce', ['get', 'height'], 5],
            'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
            'fill-extrusion-opacity': 0.92,
          },
        })

        map.setFog({
          range: [2, 12],
          color: fogColor,
          'high-color': fogHigh,
          'horizon-blend': 0.04,
        })

        // Slow orbit — less distracting than CityViewScene
        orbitRef.current = setInterval(() => {
          if (cancelled) return
          bearingRef.current += 0.02
          map.setBearing(bearingRef.current)
        }, 200)
      })
    }

    void init()

    return () => {
      cancelled = true
      if (orbitRef.current) { clearInterval(orbitRef.current); orbitRef.current = null }
      mapRef.current?.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, token])

  // Update initial bearing when heading prop changes (time-of-day orientation)
  useEffect(() => {
    if (!mapRef.current) return
    bearingRef.current = heading
    mapRef.current.setBearing(heading)
  }, [heading])

  if (!token) {
    return (
      <div className="h-full w-full">
        <Skybox month={month} crimeSignal={0} serviceSignal={null} transitSignal={0} fullBleed showElements />
      </div>
    )
  }

  return <div ref={containerRef} className="h-full w-full" />
}
