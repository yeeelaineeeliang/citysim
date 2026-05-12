import { hasSupabaseCredentials, createSupabaseAdminClient } from '@/lib/supabase'
import { getCoordinateByName } from '@/lib/neighborhoodCoordinates'
import type {
  ChatRequest,
  CommuteResult,
  CrimeResult,
  EntertainmentResult,
  MapAction,
  ToolResult,
  TransitResult,
} from '@/lib/tools/types'

interface ToolObservation {
  name: string
  result: ToolResult
}

interface CrimeAreaContext {
  cityAverage: number | null
  boundaryGeojson?: unknown
}

interface BuildMapActionsDeps {
  getCrimeAreaContext?: (neighborhood: string, month: number, year: number) => Promise<CrimeAreaContext | null>
}

function isEntertainmentResult(result: ToolResult): result is EntertainmentResult {
  return 'restaurants' in result && 'bars' in result && 'farmers_markets' in result
}

function isCommuteResult(result: ToolResult): result is CommuteResult {
  return 'estimated_minutes' in result && 'estimates' in result
}

function isTransitResult(result: ToolResult): result is TransitResult {
  return 'l_ridership' in result && 'bus_ridership' in result && 'route_summary' in result
}

function isCrimeResult(result: ToolResult): result is CrimeResult {
  return 'total' in result && 'violent_count' in result && 'property_count' in result
}

function validPoint(lat?: number, lng?: number) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  )
}

function observations(toolNames: string[], results: ToolResult[]): ToolObservation[] {
  return results.map((result, index) => ({
    name: toolNames[index] ?? '',
    result,
  }))
}

function findResult<T extends ToolResult>(
  items: ToolObservation[],
  toolName: string,
  predicate: (result: ToolResult) => result is T,
): T | null {
  for (const item of items) {
    if (item.name === toolName && predicate(item.result)) return item.result
  }

  for (const item of items) {
    if (predicate(item.result)) return item.result
  }

  return null
}

function normalizeRouteValue(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return `Route ${value}`
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^route\s+/i.test(trimmed)) return trimmed
  if (/^(cta\s+)?[a-z0-9]{1,8}$/i.test(trimmed)) return `Route ${trimmed.replace(/^cta\s+/i, '')}`
  return trimmed.length <= 40 ? trimmed : null
}

function routeLabelFromTransit(transit: TransitResult | null): string | null {
  if (!transit) return null

  const summary = transit.route_summary
  const preferredKeys = ['route_label', 'routeLabel', 'route_name', 'routeName', 'route', 'route_id', 'routeId', 'top_route', 'topRoute']

  for (const key of preferredKeys) {
    const label = normalizeRouteValue(summary[key])
    if (label) return label
  }

  const entries = Object.entries(summary)
  if (entries.length === 1) {
    const [key, value] = entries[0]
    if (typeof value === 'number' || typeof value === 'string') {
      const label = normalizeRouteValue(key)
      if (label) return label
    }
  }

  return null
}

function crimeLevel(total: number, cityAverage: number | null): Pick<Extract<MapAction, { type: 'crime_area_signal' }>, 'level' | 'ratio' | 'fillColor' | 'fillOpacity' | 'label'> {
  if (!cityAverage || cityAverage <= 0) {
    return {
      level: 'unknown',
      ratio: null,
      fillColor: '#c8b478',
      fillOpacity: 0.15,
      label: 'Area-level crime signal; city average is not loaded.',
    }
  }

  const ratio = Number((total / cityAverage).toFixed(2))
  if (ratio <= 0.85) {
    return {
      level: 'below_average',
      ratio,
      fillColor: '#64a064',
      fillOpacity: 0.15,
      label: 'Below the city average this month.',
    }
  }

  if (ratio >= 1.15) {
    return {
      level: 'above_average',
      ratio,
      fillColor: '#b4503c',
      fillOpacity: 0.18,
      label: 'Above the city average this month.',
    }
  }

  return {
    level: 'near_average',
    ratio,
    fillColor: '#c8b478',
    fillOpacity: 0.15,
    label: 'Near the city average this month.',
  }
}

async function loadCrimeAreaContext(neighborhood: string, month: number, year: number): Promise<CrimeAreaContext | null> {
  if (!hasSupabaseCredentials()) return null

  try {
    const supabase = createSupabaseAdminClient()
    const { data: area } = await supabase
      .from('community_areas')
      .select('id, city_id, boundary_geojson')
      .ilike('name', neighborhood)
      .limit(1)
      .single()

    if (!area) return null

    const { data: rows } = await supabase
      .from('crime_monthly')
      .select('incident_count')
      .eq('city_id', area.city_id)
      .eq('year', year)
      .eq('month', month)

    const counts = (rows ?? [])
      .map((row) => Number(row.incident_count))
      .filter((value) => Number.isFinite(value) && value >= 0)

    const cityAverage = counts.length > 0
      ? counts.reduce((sum, value) => sum + value, 0) / counts.length
      : null

    return {
      cityAverage,
      boundaryGeojson: area.boundary_geojson ?? undefined,
    }
  } catch {
    return null
  }
}

export async function buildMapActions(
  req: Pick<ChatRequest, 'neighborhood' | 'month' | 'year' | 'profile'>,
  toolNames: string[],
  results: ToolResult[],
  deps: BuildMapActionsDeps = {},
): Promise<MapAction[]> {
  const year = req.year ?? 2024
  const coord = getCoordinateByName(req.neighborhood)
  if (!coord) return []

  const items = observations(toolNames, results)
  const actions: MapAction[] = []
  const center = { lat: coord.lat, lng: coord.lng }

  const entertainment = findResult(items, 'query_entertainment', isEntertainmentResult)
  if (entertainment) {
    actions.push({
      type: 'entertainment_summary',
      id: `entertainment-${req.neighborhood}-${year}-${req.month}`,
      title: `${req.neighborhood} entertainment`,
      center,
      restaurants: entertainment.restaurants,
      bars: entertainment.bars,
      parks: entertainment.parks,
      farmersMarkets: entertainment.farmers_markets,
    })
  }

  const commute = findResult(items, 'query_commute', isCommuteResult)
  const transit = findResult(items, 'query_transit', isTransitResult)
  if (
    commute &&
    validPoint(req.profile.workplaceLat, req.profile.workplaceLng)
  ) {
    const routeLabel = routeLabelFromTransit(transit)
    const timing = commute.estimated_minutes ? `~${commute.estimated_minutes} min` : 'Coarse commute'
    const distance = commute.distance_miles !== null ? `${commute.distance_miles.toFixed(1)} mi` : null
    actions.push({
      type: 'commute_route',
      id: `commute-${req.neighborhood}-${year}-${req.month}`,
      title: [timing, distance, routeLabel ?? commute.mode].filter(Boolean).join(' · '),
      originName: req.neighborhood,
      destinationName: commute.destination || req.profile.workplace || 'Workplace',
      origin: center,
      destination: {
        lat: req.profile.workplaceLat as number,
        lng: req.profile.workplaceLng as number,
      },
      mode: commute.mode,
      distanceMiles: commute.distance_miles,
      estimatedMinutes: commute.estimated_minutes,
      routeLabel,
      caveat: 'Coarse spatial estimate, not turn-by-turn navigation.',
    })
  }

  const crime = findResult(items, 'query_crime', isCrimeResult)
  if (crime) {
    const context = await (deps.getCrimeAreaContext ?? loadCrimeAreaContext)(req.neighborhood, req.month, year)
    const level = crimeLevel(crime.total, context?.cityAverage ?? null)
    actions.push({
      type: 'crime_area_signal',
      id: `crime-${req.neighborhood}-${year}-${req.month}`,
      title: `${req.neighborhood} crime signal`,
      neighborhood: req.neighborhood,
      center,
      total: crime.total,
      cityAverage: context?.cityAverage ?? null,
      boundaryGeojson: context?.boundaryGeojson,
      ...level,
    })
  }

  return actions
}
