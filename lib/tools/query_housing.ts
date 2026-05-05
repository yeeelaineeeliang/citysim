import { hasSupabaseCredentials, createSupabaseAdminClient } from '@/lib/supabase'
import type { HousingResult } from './types'

// Stubs for common neighborhoods. Replaced by housing_metrics once populated.
const STUBS: Record<string, HousingResult> = {
  'hyde park':    { affordable_units: 312, avg_rent_estimate: 1420 },
  'woodlawn':     { affordable_units: 298, avg_rent_estimate: 890  },
  'south shore':  { affordable_units: 521, avg_rent_estimate: 980  },
  'bronzeville':  { affordable_units: 463, avg_rent_estimate: 1100 },
  'pilsen':       { affordable_units: 389, avg_rent_estimate: 1240 },
  'logan square': { affordable_units: 428, avg_rent_estimate: 1680 },
  'wicker park':  { affordable_units: 185, avg_rent_estimate: 1890 },
  'lincoln park': { affordable_units: 147, avg_rent_estimate: 2100 },
  'lakeview':     { affordable_units: 203, avg_rent_estimate: 1950 },
  'uptown':       { affordable_units: 612, avg_rent_estimate: 1380 },
}

const DEFAULT: HousingResult = { affordable_units: 200, avg_rent_estimate: 1350 }

async function fromSupabase(neighborhood: string): Promise<HousingResult | null> {
  const supabase = createSupabaseAdminClient()

  const { data: ca } = await supabase
    .from('community_areas')
    .select('id')
    .ilike('name', neighborhood)
    .limit(1)
    .single()

  if (!ca) return null

  const { data } = await supabase
    .from('housing_metrics')
    .select('affordable_units, avg_rent_estimate')
    .eq('community_area_id', ca.id)
    .eq('year', 2024)
    .single()

  if (!data) return null

  return {
    affordable_units: (data.affordable_units as number) ?? 0,
    avg_rent_estimate: (data.avg_rent_estimate as number) ?? 0,
  }
}

export async function queryHousing(neighborhood: string): Promise<HousingResult> {
  if (hasSupabaseCredentials()) {
    try {
      const result = await fromSupabase(neighborhood)
      if (result) return result
    } catch {
      // fall through to stub
    }
  }

  const key = neighborhood.toLowerCase().trim()
  return STUBS[key] ?? DEFAULT
}
