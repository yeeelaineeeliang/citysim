import { hasSupabaseCredentials, createSupabaseAdminClient } from '@/lib/supabase'
import type { CrimeResult } from './types'

// Monthly stubs for Hyde Park (community area 41), 2024.
// Replaced by Supabase query once crime_monthly is populated.
const HYDE_PARK_2024: Record<number, CrimeResult> = {
  1:  { total: 82,  violent_count: 26, property_count: 47, by_type: { theft: 38, battery: 18, 'motor vehicle theft': 9,  assault: 8,  other: 9  }, trend: 'down from December' },
  2:  { total: 74,  violent_count: 23, property_count: 41, by_type: { theft: 34, battery: 16, 'motor vehicle theft': 7,  assault: 7,  other: 10 }, trend: 'seasonal low' },
  3:  { total: 88,  violent_count: 27, property_count: 48, by_type: { theft: 40, battery: 19, 'motor vehicle theft': 8,  assault: 8,  other: 13 }, trend: 'rising with foot traffic' },
  4:  { total: 94,  violent_count: 30, property_count: 52, by_type: { theft: 43, battery: 21, 'motor vehicle theft': 9,  assault: 9,  other: 12 }, trend: 'spring uptick' },
  5:  { total: 102, violent_count: 33, property_count: 58, by_type: { theft: 47, battery: 23, 'motor vehicle theft': 11, assault: 10, other: 11 }, trend: 'above annual average' },
  6:  { total: 115, violent_count: 37, property_count: 66, by_type: { theft: 53, battery: 26, 'motor vehicle theft': 13, assault: 11, other: 12 }, trend: 'summer peak' },
  7:  { total: 121, violent_count: 40, property_count: 70, by_type: { theft: 56, battery: 28, 'motor vehicle theft': 14, assault: 12, other: 11 }, trend: 'annual high' },
  8:  { total: 118, violent_count: 38, property_count: 68, by_type: { theft: 55, battery: 27, 'motor vehicle theft': 13, assault: 11, other: 12 }, trend: 'summer high' },
  9:  { total: 108, violent_count: 35, property_count: 62, by_type: { theft: 50, battery: 24, 'motor vehicle theft': 12, assault: 11, other: 11 }, trend: 'slight fall decline' },
  10: { total: 97,  violent_count: 32, property_count: 54, by_type: { theft: 44, battery: 22, 'motor vehicle theft': 10, assault: 10, other: 11 }, trend: 'below summer peak' },
  11: { total: 86,  violent_count: 27, property_count: 49, by_type: { theft: 40, battery: 19, 'motor vehicle theft': 9,  assault: 8,  other: 10 }, trend: 'declining toward winter' },
  12: { total: 79,  violent_count: 25, property_count: 45, by_type: { theft: 37, battery: 17, 'motor vehicle theft': 8,  assault: 8,  other: 9  }, trend: 'winter low' },
}

const DEFAULT: CrimeResult = {
  total: 90, violent_count: 29, property_count: 51,
  by_type: { theft: 42, battery: 20, 'motor vehicle theft': 10, assault: 9, other: 9 },
  trend: 'typical for neighborhood',
}

async function fromSupabase(neighborhood: string, month: number, year: number): Promise<CrimeResult | null> {
  const supabase = createSupabaseAdminClient()

  const { data: ca } = await supabase
    .from('community_areas')
    .select('id')
    .ilike('name', neighborhood)
    .limit(1)
    .single()

  if (!ca) return null

  const { data } = await supabase
    .from('crime_monthly')
    .select('incident_count, by_type, trend_label, violent_count, property_count')
    .eq('community_area_id', ca.id)
    .eq('year', year)
    .eq('month', month)
    .single()

  if (!data) return null

  return {
    total: data.incident_count as number,
    violent_count: (data.violent_count as number) ?? 0,
    property_count: (data.property_count as number) ?? 0,
    by_type: (data.by_type as Record<string, number>) ?? {},
    trend: (data.trend_label as string) ?? 'no trend data',
  }
}

export async function queryCrime(neighborhood: string, month: number, year = 2024): Promise<CrimeResult> {
  if (hasSupabaseCredentials()) {
    try {
      const result = await fromSupabase(neighborhood, month, year)
      if (result) return result
    } catch {
      // fall through to stub
    }
  }

  const key = neighborhood.toLowerCase().trim()
  if (key === 'hyde park') return HYDE_PARK_2024[month] ?? DEFAULT
  return { ...DEFAULT, trend: 'stub — real data pending' }
}
