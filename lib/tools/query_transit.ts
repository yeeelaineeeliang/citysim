import { hasSupabaseCredentials, createSupabaseAdminClient } from '@/lib/supabase'
import type { TransitResult } from './types'

function transitResult(
  l_ridership: number,
  bus_ridership: number,
  crowding_level: TransitResult['crowding_level'],
  stops: string[],
  options: Partial<Pick<TransitResult, 'metra_ridership' | 'avg_peak_wait_minutes' | 'route_summary' | 'note'>> = {},
): TransitResult {
  return {
    l_ridership,
    bus_ridership,
    metra_ridership: options.metra_ridership ?? 0,
    crowding_level,
    avg_peak_wait_minutes: options.avg_peak_wait_minutes ?? null,
    route_summary: options.route_summary ?? {},
    stops,
    note: options.note,
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

// Extracts stop names from stop_summary jsonb.
// Handles both string arrays and object arrays (format TBD from PySpark pipeline).
function extractStopNames(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) return []
  return raw
    .map((s) => {
      if (typeof s === 'string') return s
      if (typeof s === 'object' && s !== null && 'name' in s) {
        const n = (s as { name: unknown }).name
        return typeof n === 'string' ? n : ''
      }
      return ''
    })
    .filter(Boolean)
}

// Monthly stubs for Hyde Park (community area 41), 2024.
// Ridership dips in summer (students away), peaks Sep–May (academic year).
const HYDE_PARK_2024: Record<number, TransitResult> = {
  1:  transitResult(41200, 112000, 'moderate', ['Garfield (Green/Red)', '55th-56th-57th (Metra)', '63rd (Green)'], { avg_peak_wait_minutes: 9 }),
  2:  transitResult(38900, 106000, 'low',      ['Garfield (Green/Red)', '55th-56th-57th (Metra)', '63rd (Green)'], { avg_peak_wait_minutes: 11 }),
  3:  transitResult(44100, 118000, 'moderate', ['Garfield (Green/Red)', '55th-56th-57th (Metra)', '63rd (Green)'], { avg_peak_wait_minutes: 9 }),
  4:  transitResult(46500, 122000, 'moderate', ['Garfield (Green/Red)', '55th-56th-57th (Metra)', '63rd (Green)'], { avg_peak_wait_minutes: 8 }),
  5:  transitResult(49200, 128000, 'high',     ['Garfield (Green/Red)', '55th-56th-57th (Metra)', '63rd (Green)'], { avg_peak_wait_minutes: 8 }),
  6:  transitResult(35800, 98000,  'low',      ['Garfield (Green/Red)', '55th-56th-57th (Metra)', '63rd (Green)'], { avg_peak_wait_minutes: 12 }),
  7:  transitResult(33600, 94000,  'low',      ['Garfield (Green/Red)', '55th-56th-57th (Metra)', '63rd (Green)'], { avg_peak_wait_minutes: 12 }),
  8:  transitResult(34900, 97000,  'low',      ['Garfield (Green/Red)', '55th-56th-57th (Metra)', '63rd (Green)'], { avg_peak_wait_minutes: 12 }),
  9:  transitResult(48300, 127000, 'high',     ['Garfield (Green/Red)', '55th-56th-57th (Metra)', '63rd (Green)'], { avg_peak_wait_minutes: 8 }),
  10: transitResult(47100, 124000, 'high',     ['Garfield (Green/Red)', '55th-56th-57th (Metra)', '63rd (Green)'], { avg_peak_wait_minutes: 8 }),
  11: transitResult(43800, 116000, 'moderate', ['Garfield (Green/Red)', '55th-56th-57th (Metra)', '63rd (Green)'], { avg_peak_wait_minutes: 9 }),
  12: transitResult(40200, 108000, 'moderate', ['Garfield (Green/Red)', '55th-56th-57th (Metra)', '63rd (Green)'], { avg_peak_wait_minutes: 10 }),
}

const OAKLAND_2024: TransitResult = transitResult(0, 64573, 'moderate', [], {
  note: 'No L station stop list is loaded for Oakland. Treat this as neighborhood transit volume, not a door-to-door route plan.',
})

const DEFAULT: TransitResult = transitResult(44000, 118000, 'moderate', ['nearest L stop', 'local bus routes'])

const NO_L_DATA: TransitResult = transitResult(0, 0, 'low', [], {
  note: 'No L station data for this community area — it is primarily served by buses or is car-dependent. The agent should say so explicitly rather than estimating.',
})

async function fromSupabase(neighborhood: string, month: number): Promise<TransitResult | 'not_found' | null> {
  const supabase = createSupabaseAdminClient()

  const { data: ca } = await supabase
    .from('community_areas')
    .select('id')
    .ilike('name', neighborhood)
    .limit(1)
    .single()

  if (!ca) return null  // name not recognized — fall through to stubs

  const { data } = await supabase
    .from('transit_monthly')
    .select('l_ridership, bus_ridership, metra_ridership, crowding_level, avg_peak_wait_minutes, route_summary, stop_summary')
    .eq('community_area_id', ca.id)
    .eq('year', 2024)
    .eq('month', month)
    .maybeSingle()

  if (!data) return 'not_found'  // area known but no L stop data

  const stops = extractStopNames(data.stop_summary)

  return {
    l_ridership: (data.l_ridership as number) ?? 0,
    bus_ridership: (data.bus_ridership as number) ?? 0,
    metra_ridership: (data.metra_ridership as number) ?? 0,
    crowding_level: (['low', 'moderate', 'high', 'very_high'].includes(data.crowding_level as string)
      ? data.crowding_level
      : 'moderate') as TransitResult['crowding_level'],
    avg_peak_wait_minutes: data.avg_peak_wait_minutes == null ? null : Number(data.avg_peak_wait_minutes),
    route_summary: asRecord(data.route_summary),
    stops: stops.length > 0 ? stops : [],
    note: stops.length > 0
      ? undefined
      : 'No stop list was returned for this community area. Treat ridership as an access signal, not a route plan.',
  }
}

export async function queryTransit(neighborhood: string, month: number): Promise<TransitResult> {
  if (hasSupabaseCredentials()) {
    try {
      const result = await fromSupabase(neighborhood, month)
      if (result === 'not_found') return NO_L_DATA
      if (result) return result
    } catch {
      // fall through to stub
    }
  }

  const key = neighborhood.toLowerCase().trim()
  if (key === 'hyde park') return HYDE_PARK_2024[month] ?? DEFAULT
  if (key === 'oakland') return OAKLAND_2024
  return { ...DEFAULT, crowding_level: 'moderate' }
}
