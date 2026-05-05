import { hasSupabaseCredentials, createSupabaseAdminClient } from '@/lib/supabase'
import type { TransitResult } from './types'

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
  1:  { l_ridership: 41200, bus_ridership: 112000, crowding_level: 'moderate', stops: ['Garfield (Green/Red)', '55th-56th-57th (Metra)', '63rd (Green)'] },
  2:  { l_ridership: 38900, bus_ridership: 106000, crowding_level: 'low',      stops: ['Garfield (Green/Red)', '55th-56th-57th (Metra)', '63rd (Green)'] },
  3:  { l_ridership: 44100, bus_ridership: 118000, crowding_level: 'moderate', stops: ['Garfield (Green/Red)', '55th-56th-57th (Metra)', '63rd (Green)'] },
  4:  { l_ridership: 46500, bus_ridership: 122000, crowding_level: 'moderate', stops: ['Garfield (Green/Red)', '55th-56th-57th (Metra)', '63rd (Green)'] },
  5:  { l_ridership: 49200, bus_ridership: 128000, crowding_level: 'high',     stops: ['Garfield (Green/Red)', '55th-56th-57th (Metra)', '63rd (Green)'] },
  6:  { l_ridership: 35800, bus_ridership: 98000,  crowding_level: 'low',      stops: ['Garfield (Green/Red)', '55th-56th-57th (Metra)', '63rd (Green)'] },
  7:  { l_ridership: 33600, bus_ridership: 94000,  crowding_level: 'low',      stops: ['Garfield (Green/Red)', '55th-56th-57th (Metra)', '63rd (Green)'] },
  8:  { l_ridership: 34900, bus_ridership: 97000,  crowding_level: 'low',      stops: ['Garfield (Green/Red)', '55th-56th-57th (Metra)', '63rd (Green)'] },
  9:  { l_ridership: 48300, bus_ridership: 127000, crowding_level: 'high',     stops: ['Garfield (Green/Red)', '55th-56th-57th (Metra)', '63rd (Green)'] },
  10: { l_ridership: 47100, bus_ridership: 124000, crowding_level: 'high',     stops: ['Garfield (Green/Red)', '55th-56th-57th (Metra)', '63rd (Green)'] },
  11: { l_ridership: 43800, bus_ridership: 116000, crowding_level: 'moderate', stops: ['Garfield (Green/Red)', '55th-56th-57th (Metra)', '63rd (Green)'] },
  12: { l_ridership: 40200, bus_ridership: 108000, crowding_level: 'moderate', stops: ['Garfield (Green/Red)', '55th-56th-57th (Metra)', '63rd (Green)'] },
}

const DEFAULT: TransitResult = {
  l_ridership: 44000, bus_ridership: 118000, crowding_level: 'moderate',
  stops: ['nearest L stop', 'local bus routes'],
}

async function fromSupabase(neighborhood: string, month: number): Promise<TransitResult | null> {
  const supabase = createSupabaseAdminClient()

  const { data: ca } = await supabase
    .from('community_areas')
    .select('id')
    .ilike('name', neighborhood)
    .limit(1)
    .single()

  if (!ca) return null

  const { data } = await supabase
    .from('transit_monthly')
    .select('l_ridership, bus_ridership, metra_ridership, crowding_level, avg_peak_wait_minutes, stop_summary')
    .eq('community_area_id', ca.id)
    .eq('year', 2024)
    .eq('month', month)
    .single()

  if (!data) return null

  const stops = extractStopNames(data.stop_summary)

  return {
    l_ridership: (data.l_ridership as number) ?? 0,
    bus_ridership: (data.bus_ridership as number) ?? 0,
    crowding_level: (['low', 'moderate', 'high', 'very_high'].includes(data.crowding_level as string)
      ? data.crowding_level
      : 'moderate') as TransitResult['crowding_level'],
    stops: stops.length > 0 ? stops : [],
  }
}

export async function queryTransit(neighborhood: string, month: number): Promise<TransitResult> {
  if (hasSupabaseCredentials()) {
    try {
      const result = await fromSupabase(neighborhood, month)
      if (result) return result
    } catch {
      // fall through to stub
    }
  }

  const key = neighborhood.toLowerCase().trim()
  if (key === 'hyde park') return HYDE_PARK_2024[month] ?? DEFAULT
  return { ...DEFAULT, crowding_level: 'moderate' }
}
