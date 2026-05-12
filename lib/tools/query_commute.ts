import { getCoordinateByName } from '@/lib/neighborhoodCoordinates'
import type { CommuteResult, UserProfile } from './types'

const KNOWN_WORKPLACES: Record<string, { lat: number; lng: number }> = {
  uchicago: { lat: 41.7886, lng: -87.5987 },
  'university of chicago': { lat: 41.7886, lng: -87.5987 },
  'the university of chicago': { lat: 41.7886, lng: -87.5987 },
  'uchicago campus': { lat: 41.7886, lng: -87.5987 },
  loop: { lat: 41.8781, lng: -87.6298 },
  'the loop': { lat: 41.8781, lng: -87.6298 },
  downtown: { lat: 41.8781, lng: -87.6298 },
}

function normalizePlace(value: string): string {
  return value.toLowerCase().trim().replace(/[.,]/g, '').replace(/\s+/g, ' ')
}

function resolveWorkplace(
  workplace: string,
  workplaceLat?: number,
  workplaceLng?: number,
): { lat: number; lng: number } | null {
  if (
    typeof workplaceLat === 'number' &&
    typeof workplaceLng === 'number' &&
    Number.isFinite(workplaceLat) &&
    Number.isFinite(workplaceLng)
  ) {
    return { lat: workplaceLat, lng: workplaceLng }
  }

  const key = normalizePlace(workplace)
  if (!key) return null
  if (KNOWN_WORKPLACES[key]) return KNOWN_WORKPLACES[key]

  for (const [known, coords] of Object.entries(KNOWN_WORKPLACES)) {
    if (key.includes(known) || known.includes(key)) return coords
  }
  return null
}

function distanceMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const radiusMiles = 3958.8
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng *
      sinLng
  return radiusMiles * 2 * Math.asin(Math.sqrt(h))
}

function estimateMinutes(distance: number) {
  return {
    transit_minutes: Math.max(8, Math.round(distance * 8)),
    driving_minutes: Math.max(5, Math.round(distance * 4)),
    walking_minutes: Math.max(5, Math.round(distance * 20)),
    biking_minutes: Math.max(4, Math.round(distance * 6)),
  }
}

export function queryCommute(
  neighborhood: string,
  workplace: string,
  mode: UserProfile['commutePref'] = 'transit',
  workplaceLat?: number,
  workplaceLng?: number,
): CommuteResult {
  const origin = getCoordinateByName(neighborhood)
  const destination = resolveWorkplace(workplace, workplaceLat, workplaceLng)

  if (!origin || !destination) {
    return {
      origin_neighborhood: neighborhood,
      destination: workplace || 'not specified',
      mode,
      distance_miles: null,
      estimated_minutes: null,
      estimates: {
        transit_minutes: null,
        driving_minutes: null,
        walking_minutes: null,
        biking_minutes: null,
      },
      confidence: 'low',
      note: 'Commute estimate unavailable because the neighborhood or workplace coordinates are missing. Do not invent routes, stops, transfers, or travel times.',
    }
  }

  const distance = Number(distanceMiles({ lat: origin.lat, lng: origin.lng }, destination).toFixed(1))
  const estimates = estimateMinutes(distance)
  const key = `${mode}_minutes` as keyof CommuteResult['estimates']

  return {
    origin_neighborhood: neighborhood,
    destination: workplace || 'not specified',
    mode,
    distance_miles: distance,
    estimated_minutes: estimates[key],
    estimates,
    confidence: 'medium',
    note: 'Coarse estimate from community-area coordinate to workplace coordinate. This is not a CTA route plan and does not identify exact stops, transfers, or door-to-door timing.',
  }
}
