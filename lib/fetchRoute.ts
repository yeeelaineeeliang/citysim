import { thinPolyline } from './decodePolyline'

export type OSRMMode = 'foot' | 'driving' | 'bike'

export interface OSRMRouteResult {
  coords: [number, number][] | null
  durationSeconds: number | null
  distanceMeters: number | null
}

export function commuteMode(pref: string): OSRMMode {
  if (pref === 'driving') return 'driving'
  if (pref === 'biking') return 'bike'
  return 'foot'
}

export async function fetchOSRMRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: OSRMMode = 'foot',
): Promise<OSRMRouteResult> {
  const empty: OSRMRouteResult = { coords: null, durationSeconds: null, distanceMeters: null }
  try {
    const url =
      `https://router.project-osrm.org/route/v1/${mode}/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?overview=full&geometries=geojson`

    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return empty

    const data = (await res.json()) as {
      code: string
      routes?: Array<{
        geometry: { coordinates: [number, number][] }
        duration: number
        distance: number
      }>
    }

    if (data.code !== 'Ok' || !data.routes?.[0]) return empty

    const route = data.routes[0]
    // OSRM returns [lng, lat] — flip to [lat, lng] for Leaflet
    const coords: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]) => [lat, lng],
    )
    return {
      coords: thinPolyline(coords, 30),
      durationSeconds: route.duration,
      distanceMeters: route.distance,
    }
  } catch {
    return empty
  }
}
