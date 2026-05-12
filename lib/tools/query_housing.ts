import { hasSupabaseCredentials, createSupabaseAdminClient } from '@/lib/supabase'
import type { HousingResult } from './types'

const STOCK_NOTE = 'Affordable units are recorded subsidized housing stock, not current rental availability.'

// Stubs for common neighborhoods. Replaced by housing_metrics once populated.
const STUBS: Record<string, HousingResult> = {
  'hyde park':    { affordable_units: 312, affordable_developments: 18, avg_rent_estimate: 1420, median_rent_estimate: 1450, note: STOCK_NOTE },
  'woodlawn':     { affordable_units: 298, affordable_developments: 15, avg_rent_estimate: 890,  median_rent_estimate: 925,  note: STOCK_NOTE },
  'south shore':  { affordable_units: 521, affordable_developments: 24, avg_rent_estimate: 980,  median_rent_estimate: 1020, note: STOCK_NOTE },
  'bronzeville':  { affordable_units: 463, affordable_developments: 22, avg_rent_estimate: 1100, median_rent_estimate: 1150, note: STOCK_NOTE },
  'oakland':      { affordable_units: 1032, affordable_developments: 31, avg_rent_estimate: 831,  median_rent_estimate: 875,  note: STOCK_NOTE },
  'fuller park':  { affordable_units: 0,   affordable_developments: 0,  avg_rent_estimate: 0,    median_rent_estimate: null, note: 'No affordable housing development or rent estimate records are loaded for this community area.' },
  'pilsen':       { affordable_units: 389, affordable_developments: 19, avg_rent_estimate: 1240, median_rent_estimate: 1280, note: STOCK_NOTE },
  'logan square': { affordable_units: 428, affordable_developments: 20, avg_rent_estimate: 1680, median_rent_estimate: 1725, note: STOCK_NOTE },
  'wicker park':  { affordable_units: 185, affordable_developments: 10, avg_rent_estimate: 1890, median_rent_estimate: 1950, note: STOCK_NOTE },
  'lincoln park': { affordable_units: 147, affordable_developments: 8,  avg_rent_estimate: 2100, median_rent_estimate: 2150, note: STOCK_NOTE },
  'lakeview':     { affordable_units: 203, affordable_developments: 12, avg_rent_estimate: 1950, median_rent_estimate: 1990, note: STOCK_NOTE },
  'uptown':       { affordable_units: 612, affordable_developments: 28, avg_rent_estimate: 1380, median_rent_estimate: 1400, note: STOCK_NOTE },
}

const DEFAULT: HousingResult = {
  affordable_units: 200,
  affordable_developments: 10,
  avg_rent_estimate: 1350,
  median_rent_estimate: 1375,
  note: STOCK_NOTE,
}

async function fromSupabase(neighborhood: string): Promise<HousingResult | 'not_found' | null> {
  const supabase = createSupabaseAdminClient()

  const { data: ca } = await supabase
    .from('community_areas')
    .select('id')
    .ilike('name', neighborhood)
    .limit(1)
    .single()

  if (!ca) return null  // name not recognized — fall through to stubs

  const { data } = await supabase
    .from('housing_metrics')
    .select('affordable_units, affordable_developments, avg_rent_estimate, median_rent_estimate')
    .eq('community_area_id', ca.id)
    .eq('year', 2024)
    .maybeSingle()

  if (!data) return 'not_found'  // area known but no affordable housing developments recorded

  return {
    affordable_units: (data.affordable_units as number) ?? 0,
    affordable_developments: (data.affordable_developments as number) ?? 0,
    avg_rent_estimate: (data.avg_rent_estimate as number) ?? 0,
    median_rent_estimate: (data.median_rent_estimate as number | null) ?? null,
    note: STOCK_NOTE,
  }
}

export async function queryHousing(neighborhood: string): Promise<HousingResult> {
  if (hasSupabaseCredentials()) {
    try {
      const result = await fromSupabase(neighborhood)
      if (result === 'not_found') {
        return {
          affordable_units: 0,
          affordable_developments: 0,
          avg_rent_estimate: 0,
          median_rent_estimate: null,
          note: 'No affordable housing development records for this community area.',
        }
      }
      if (result) return result
    } catch {
      // fall through to stub
    }
  }

  const key = neighborhood.toLowerCase().trim()
  return STUBS[key] ?? DEFAULT
}
