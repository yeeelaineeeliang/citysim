import { thinPolyline } from './decodePolyline'

type OSRMMode = 'foot' | 'driving' | 'bike'

export function commuteMode(pref: string): OSRMMode {
  if (pref === 'driving') return 'driving'
  if (pref === 'biking') return 'bike'
  return 'foot'
}

export async function fetchOSRMRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: OSRMMode = 'foot',
): Promise<[number, number][] | null> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/${mode}/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?overview=full&geometries=geojson`

    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null

    const data = (await res.json()) as {
      code: string
      routes?: Array<{ geometry: { coordinates: [number, number][] } }>
    }

    if (data.code !== 'Ok' || !data.routes?.[0]) return null

    // OSRM returns [lng, lat] — flip to [lat, lng] for Leaflet
    const coords: [number, number][] = data.routes[0].geometry.coordinates.map(
      ([lng, lat]) => [lat, lng],
    )
    return thinPolyline(coords, 30)
  } catch {
    return null
  }
}
