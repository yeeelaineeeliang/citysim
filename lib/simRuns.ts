/**
 * Saved cinematic runs — one immutable sim_runs row per completed 4-act run.
 * The verdict is computed server-side at save time and frozen with its
 * VERDICT_VERSION so history shows what the user actually saw.
 */

import { hasSupabaseCredentials, createSupabaseAdminClient } from '@/lib/supabase'
import { getChicagoCityId, getCommunityAreaId } from '@/lib/session'
import { computeVerdict, VERDICT_VERSION, type VerdictSignal } from '@/lib/verdict'
import type { DataSummary, UserProfile } from '@/lib/tools/types'
import type { SimAct } from '@/app/sim/types'

export interface SimRunVerdict {
  version: number
  signals: VerdictSignal[]
}

export interface SimRunSummary {
  id: string
  neighborhood: string
  year: number
  createdAt: string
  verdict: SimRunVerdict
}

export interface SimRunDetail extends SimRunSummary {
  profile: UserProfile
  actSummaries: Partial<Record<SimAct, DataSummary>>
}

type SimRunRow = {
  id: string
  neighborhood: string
  year: number
  created_at: string
  verdict: SimRunVerdict
  profile_snapshot?: UserProfile
  act_summaries?: Partial<Record<SimAct, DataSummary>>
}

export async function saveSimRun(
  clerkUserId: string,
  neighborhood: string,
  year: number,
  profile: UserProfile,
  actSummaries: Partial<Record<SimAct, DataSummary>>,
): Promise<string | null> {
  if (!hasSupabaseCredentials()) return null

  try {
    const supabase = createSupabaseAdminClient()
    const cityId = await getChicagoCityId(supabase)
    if (!cityId) return null
    const communityAreaId = await getCommunityAreaId(supabase, cityId, neighborhood)
    if (!communityAreaId) return null

    const verdict: SimRunVerdict = {
      version: VERDICT_VERSION,
      signals: computeVerdict(neighborhood, profile, actSummaries),
    }

    const { data, error } = await supabase
      .from('sim_runs')
      .insert({
        clerk_user_id: clerkUserId,
        city_id: cityId,
        community_area_id: communityAreaId,
        neighborhood,
        year,
        profile_snapshot: profile,
        act_summaries: actSummaries,
        verdict,
      })
      .select('id')
      .single()

    if (error || !data) return null
    return (data as { id: string }).id
  } catch {
    return null
  }
}

export async function listSimRuns(clerkUserId: string, limit = 20): Promise<SimRunSummary[]> {
  if (!hasSupabaseCredentials()) return []

  try {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from('sim_runs')
      .select('id, neighborhood, year, created_at, verdict')
      .eq('clerk_user_id', clerkUserId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return (data as SimRunRow[]).map((row) => ({
      id: row.id,
      neighborhood: row.neighborhood,
      year: row.year,
      createdAt: row.created_at,
      verdict: row.verdict,
    }))
  } catch {
    return []
  }
}

export async function getSimRun(id: string, clerkUserId: string): Promise<SimRunDetail | null> {
  if (!hasSupabaseCredentials()) return null

  try {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from('sim_runs')
      .select('id, neighborhood, year, created_at, verdict, profile_snapshot, act_summaries')
      .eq('id', id)
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (error || !data) return null
    const row = data as SimRunRow
    return {
      id: row.id,
      neighborhood: row.neighborhood,
      year: row.year,
      createdAt: row.created_at,
      verdict: row.verdict,
      profile: row.profile_snapshot as UserProfile,
      actSummaries: row.act_summaries ?? {},
    }
  } catch {
    return null
  }
}
