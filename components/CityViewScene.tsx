"use client"

import { useEffect, useRef, useState } from "react"
import type {
  CrimeAreaSignalMapAction,
  CommuteRouteMapAction,
  EntertainmentSummaryMapAction,
  MapAction,
} from "@/lib/tools/types"

interface Props {
  lat: number
  lng: number
  month: number
  timeProgress: number
  mapActions: MapAction[]
}

function phaseColors(p: number) {
  // Night: warm amber-lit facades stand out against near-black sky
  if (p > 0.78) return { bldLow: '#4a5a3a', bldMid: '#6a7a50', bldHigh: '#8a9a68', fogColor: '#060c14', fogHigh: '#0e1a28' }
  // Dusk: warm orange glow on buildings, deep-red horizon
  if (p > 0.60) return { bldLow: '#6a4828', bldMid: '#8a6038', bldHigh: '#aa7848', fogColor: '#1e0c04', fogHigh: '#6a2808' }
  // Day: crisp blue-steel buildings against lighter sky
  return { bldLow: '#4a7090', bldMid: '#6090b8', bldHigh: '#78acd4', fogColor: '#1a2a40', fogHigh: '#2c4868' }
}

function crimeColor(level: CrimeAreaSignalMapAction['level']): string {
  if (level === 'above_average') return '#c04010'
  if (level === 'near_average') return '#b08020'
  return '#20784a'
}

function crimeOpacity(level: CrimeAreaSignalMapAction['level']): number {
  return level === 'above_average' ? 0.28 : level === 'near_average' ? 0.20 : 0.16
}

type MapboxMap = {
  isStyleLoaded: () => boolean
  getLayer: (id: string) => unknown
  removeLayer: (id: string) => void
  getSource: (id: string) => unknown
  removeSource: (id: string) => void
  addSource: (id: string, src: unknown) => void
  addLayer: (layer: unknown) => void
  setPaintProperty: (id: string, prop: string, val: unknown) => void
  setFog: (fog: unknown) => void
  setBearing: (b: number) => void
  flyTo: (opts: object) => void
  resize: () => void
  remove: () => void
}

export function CityViewScene({ lat, lng, month: _month, timeProgress, mapActions }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const bearingRef = useRef(0)
  const orbitRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const dashRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const dashTickRef = useRef(0)
  const [mapLoaded, setMapLoaded] = useState(false)
  // Capture initial center so the map is only created once (subsequent moves use flyTo)
  const initCenterRef = useRef<[number, number]>([lng, lat])

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  // ── Map initialisation — runs once per token ────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !token) return
    let cancelled = false

    const init = async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      if (cancelled || !containerRef.current) return

      // One-frame pause ensures any previous Mapbox instance (MapboxStreetScene)
      // has completed its map.remove() cleanup before we create a new GL context
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      if (cancelled || !containerRef.current) return

      mapboxgl.accessToken = token

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: initCenterRef.current,
        zoom: 15.5,      // street-level immersion
        pitch: 50,       // dramatic tilt — GTA helicopter angle
        bearing: 0,
        antialias: true,
        interactive: false,
        attributionControl: false,
      }) as unknown as MapboxMap

      mapRef.current = map

      // Deferred resize ensures Mapbox measures the container's real pixel dimensions
      // before tiles start loading — mirrors MapboxStreetScene pattern
      requestAnimationFrame(() => { if (!cancelled) map.resize() })

      const mapEl = map as unknown as { on: (e: string, cb: () => void) => void }

      mapEl.on('load', () => {
        if (cancelled) return

        map.resize()

        // 3D building extrusions — wrapped in try/catch: Mapbox GL v3 may raise
        // if composite/building isn't available in the loaded style version
        try {
          map.addLayer({
            id: 'sim-buildings',
            type: 'fill-extrusion',
            source: 'composite',
            'source-layer': 'building',
            minzoom: 12,
            paint: {
              'fill-extrusion-color': [
                'interpolate', ['linear'], ['coalesce', ['get', 'height'], 5],
                0,   '#4a7090',
                30,  '#6090b8',
                100, '#78acd4',
              ],
              'fill-extrusion-height': ['coalesce', ['get', 'height'], 5],
              'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
              'fill-extrusion-opacity': 0.90,
            },
          })
        } catch { /* style doesn't expose composite/building — base tiles still render */ }

        try {
          map.setFog({
            range: [3, 16],
            color: '#1e2e48',
            'high-color': '#304870',
            'horizon-blend': 0.04,
          })
        } catch { /* fog not supported in this style version */ }

        // Slow orbital camera
        orbitRef.current = setInterval(() => {
          if (cancelled) return
          bearingRef.current += 0.05
          map.setBearing(bearingRef.current)
        }, 100)

        setMapLoaded(true)
      })

      ;(map as unknown as { on: (e: string, cb: (...args: unknown[]) => void) => void })
        .on('error', (...args: unknown[]) => {
          console.error('[CityViewScene] Mapbox error:', ...args)
        })
    }

    void init()

    return () => {
      cancelled = true
      setMapLoaded(false)
      if (orbitRef.current) { clearInterval(orbitRef.current); orbitRef.current = null }
      if (dashRef.current) { clearInterval(dashRef.current); dashRef.current = null }
      mapRef.current?.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // ── Smooth flyTo on location change ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    map.flyTo({
      center: [lng, lat],
      zoom: 15.5,
      pitch: 50,
      duration: 2800,
      essential: true,
    })
  }, [lat, lng, mapLoaded])

  // ── Data layers — re-runs whenever map loads OR mapActions updates ───────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    for (const id of ['crime-fill', 'commute-line', 'entertainment-glow']) {
      if (map.getLayer(id)) map.removeLayer(id)
      if (map.getSource(id)) map.removeSource(id)
    }
    if (dashRef.current) { clearInterval(dashRef.current); dashRef.current = null }

    for (const action of mapActions) {
      if (action.type === 'crime_area_signal') {
        const a = action as CrimeAreaSignalMapAction
        if (!a.boundaryGeojson) continue
        map.addSource('crime-fill', { type: 'geojson', data: a.boundaryGeojson as object })
        map.addLayer({ id: 'crime-fill', type: 'fill', source: 'crime-fill', paint: { 'fill-color': crimeColor(a.level), 'fill-opacity': crimeOpacity(a.level) } })
      }

      if (action.type === 'commute_route') {
        const a = action as CommuteRouteMapAction
        if (!a.origin || !a.destination) continue
        map.addSource('commute-line', {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [[a.origin.lng, a.origin.lat], [a.destination.lng, a.destination.lat]] } },
        })
        map.addLayer({ id: 'commute-line', type: 'line', source: 'commute-line', paint: { 'line-color': '#5aafff', 'line-width': 3, 'line-dasharray': [2, 2], 'line-opacity': 0.90 } })
        dashTickRef.current = 0
        dashRef.current = setInterval(() => {
          dashTickRef.current += 1
          try { map.setPaintProperty('commute-line', 'line-dash-offset', -(dashTickRef.current * 0.15) % 4) } catch { /* removed */ }
        }, 80)
      }

      if (action.type === 'entertainment_summary') {
        const a = action as EntertainmentSummaryMapAction
        map.addSource('entertainment-glow', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Point', coordinates: [a.center.lng, a.center.lat] } } })
        map.addLayer({ id: 'entertainment-glow', type: 'circle', source: 'entertainment-glow', paint: { 'circle-color': '#e8a020', 'circle-radius': 70, 'circle-blur': 1, 'circle-opacity': 0.20 } })
      }
    }
  }, [mapActions, mapLoaded])

  // ── Day/night lighting ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    const { bldLow, bldMid, bldHigh, fogColor, fogHigh } = phaseColors(timeProgress)
    try {
      if (map.getLayer('sim-buildings')) {
        map.setPaintProperty('sim-buildings', 'fill-extrusion-color', ['interpolate', ['linear'], ['coalesce', ['get', 'height'], 5], 0, bldLow, 30, bldMid, 100, bldHigh])
        map.setPaintProperty('sim-buildings', 'fill-extrusion-opacity', 0.95)
      }
      map.setFog({ range: [3, 16], color: fogColor, 'high-color': fogHigh, 'horizon-blend': 0.04 })
    } catch { /* style may not support these operations */ }
  }, [timeProgress, mapLoaded])

  if (!token) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#0d1520]">
        <p className="max-w-sm rounded-xl border border-white/15 bg-white/8 px-5 py-4 text-center text-xs text-white/55">
          3D city view requires a Mapbox token.
          <br />
          Add <code className="font-mono text-white/75">NEXT_PUBLIC_MAPBOX_TOKEN</code> to{' '}
          <code className="font-mono text-white/75">.env.local</code>
        </p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ opacity: mapLoaded ? 1 : 0, transition: 'opacity 1.2s ease' }}
    />
  )
}
