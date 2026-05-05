import { hasSupabaseCredentials, createSupabaseAdminClient } from '@/lib/supabase'
import type { ServiceResult } from './types'

// Monthly stubs for Hyde Park (community area 41), 2024.
// City average response: ~5.2 days. Hyde Park tracks close to average.
const HYDE_PARK_2024: Record<number, ServiceResult> = {
  1:  { total_requests: 142, by_type: { pothole: 41, 'streetlight outage': 31, 'graffiti removal': 22, 'tree debris': 28, other: 20 }, avg_response_days: 4.1 },
  2:  { total_requests: 128, by_type: { pothole: 38, 'streetlight outage': 28, 'graffiti removal': 20, 'tree debris': 22, other: 20 }, avg_response_days: 4.3 },
  3:  { total_requests: 161, by_type: { pothole: 52, 'streetlight outage': 29, 'graffiti removal': 24, 'tree debris': 35, other: 21 }, avg_response_days: 5.1 },
  4:  { total_requests: 174, by_type: { pothole: 55, 'streetlight outage': 27, 'graffiti removal': 28, 'tree debris': 40, other: 24 }, avg_response_days: 5.4 },
  5:  { total_requests: 188, by_type: { pothole: 56, 'streetlight outage': 26, 'graffiti removal': 32, 'tree debris': 48, other: 26 }, avg_response_days: 5.8 },
  6:  { total_requests: 196, by_type: { pothole: 58, 'streetlight outage': 25, 'graffiti removal': 36, 'tree debris': 51, other: 26 }, avg_response_days: 6.2 },
  7:  { total_requests: 201, by_type: { pothole: 57, 'streetlight outage': 24, 'graffiti removal': 38, 'tree debris': 54, other: 28 }, avg_response_days: 6.5 },
  8:  { total_requests: 193, by_type: { pothole: 55, 'streetlight outage': 25, 'graffiti removal': 35, 'tree debris': 50, other: 28 }, avg_response_days: 6.1 },
  9:  { total_requests: 176, by_type: { pothole: 51, 'streetlight outage': 28, 'graffiti removal': 30, 'tree debris': 44, other: 23 }, avg_response_days: 5.6 },
  10: { total_requests: 162, by_type: { pothole: 47, 'streetlight outage': 30, 'graffiti removal': 26, 'tree debris': 38, other: 21 }, avg_response_days: 4.9 },
  11: { total_requests: 149, by_type: { pothole: 43, 'streetlight outage': 32, 'graffiti removal': 23, 'tree debris': 31, other: 20 }, avg_response_days: 4.5 },
  12: { total_requests: 138, by_type: { pothole: 40, 'streetlight outage': 33, 'graffiti removal': 21, 'tree debris': 25, other: 19 }, avg_response_days: 4.2 },
}

const DEFAULT: ServiceResult = {
  total_requests: 160,
  by_type: { pothole: 48, 'streetlight outage': 29, 'graffiti removal': 28, other: 55 },
  avg_response_days: 5.2,
}

async function fromSupabase(neighborhood: string, month: number): Promise<ServiceResult | null> {
  const supabase = createSupabaseAdminClient()

  const { data: ca } = await supabase
    .from('community_areas')
    .select('id')
    .ilike('name', neighborhood)
    .limit(1)
    .single()

  if (!ca) return null

  const { data } = await supabase
    .from('service_requests_311_monthly')
    .select('total_requests, by_type, avg_response_days')
    .eq('community_area_id', ca.id)
    .eq('year', 2024)
    .eq('month', month)
    .single()

  if (!data) return null

  return {
    total_requests: (data.total_requests as number) ?? 0,
    by_type: (data.by_type as Record<string, number>) ?? {},
    avg_response_days: Number(data.avg_response_days ?? 5.2),
  }
}

export async function query311(neighborhood: string, month: number): Promise<ServiceResult> {
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
  return { ...DEFAULT, avg_response_days: 5.5 }
}
