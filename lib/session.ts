/**
 * Session management — stores conversation history per simulation session
 * in Supabase so context carries across months and page refreshes.
 *
 * Tables used:
 *   simulation_sessions  — one row per (user × neighborhood × year)
 *   conversation_messages — one row per chat turn, linked to session
 */

import { hasSupabaseCredentials, createSupabaseAdminClient } from '@/lib/supabase'
import type { ChatMessage } from '@/lib/tools/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionContext {
  sessionId: string
  cityId: string
  communityAreaId: string
  clerkUserId: string
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

async function getChicagoCityId(supabase: ReturnType<typeof createSupabaseAdminClient>): Promise<string | null> {
  const { data } = await supabase.from('cities').select('id').eq('slug', 'chicago').single()
  return (data as { id: string } | null)?.id ?? null
}

async function getCommunityAreaId(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  cityId: string,
  neighborhood: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('community_areas')
    .select('id')
    .eq('city_id', cityId)
    .ilike('name', neighborhood)
    .limit(1)
    .single()
  return (data as { id: string } | null)?.id ?? null
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Create or retrieve a simulation session for this (neighborhood, year) pair.
 * Returns null if Supabase is unavailable.
 */
export async function getOrCreateSession(
  neighborhood: string,
  year = 2024,
  clerkUserId: string,
): Promise<SessionContext | null> {
  if (!hasSupabaseCredentials()) return null

  try {
    const supabase = createSupabaseAdminClient()
    const cityId = await getChicagoCityId(supabase)
    if (!cityId) return null

    const communityAreaId = await getCommunityAreaId(supabase, cityId, neighborhood)
    if (!communityAreaId) return null

    // Look for an existing active session for this neighborhood/year
    const { data: existing } = await supabase
      .from('simulation_sessions')
      .select('id')
      .eq('city_id', cityId)
      .eq('community_area_id', communityAreaId)
      .eq('clerk_user_id', clerkUserId)
      .eq('start_year', year)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      return { sessionId: (existing as { id: string }).id, cityId, communityAreaId, clerkUserId }
    }

    // Create a new session
    const { data: created, error } = await supabase
      .from('simulation_sessions')
      .insert({
        city_id: cityId,
        community_area_id: communityAreaId,
        clerk_user_id: clerkUserId,
        start_year: year,
        current_month: 1,
        status: 'active',
        persona_snapshot: {},
      })
      .select('id')
      .single()

    if (error || !created) return null
    return { sessionId: (created as { id: string }).id, cityId, communityAreaId, clerkUserId }
  } catch {
    return null
  }
}

/**
 * Persist a user + assistant exchange to Supabase.
 * Silently no-ops if Supabase is unavailable or session is null.
 */
export async function saveMessages(
  ctx: SessionContext,
  month: number,
  year: number,
  userMessage: string,
  assistantMessage: string,
  toolsUsed: string[],
): Promise<void> {
  if (!hasSupabaseCredentials()) return

  try {
    const supabase = createSupabaseAdminClient()
    await supabase.from('conversation_messages').insert([
      {
        session_id:        ctx.sessionId,
        city_id:           ctx.cityId,
        community_area_id: ctx.communityAreaId,
        month,
        year,
        role:    'user',
        content: userMessage,
        citations: [],
      },
      {
        session_id:        ctx.sessionId,
        city_id:           ctx.cityId,
        community_area_id: ctx.communityAreaId,
        month,
        year,
        role:       'assistant',
        content:    assistantMessage,
        tool_name:  toolsUsed[0] ?? null,
        tool_result: null,
        citations:  toolsUsed,
      },
    ])
  } catch {
    // Non-fatal — conversation still works, just not persisted
  }
}

/**
 * Load the last N conversation turns from a session, most recent last.
 * Returns [] if unavailable.
 */
export async function loadSessionHistory(
  sessionId: string,
  clerkUserId: string,
  limit = 20,
): Promise<ChatMessage[]> {
  if (!hasSupabaseCredentials()) return []

  try {
    const supabase = createSupabaseAdminClient()
    const { data: session } = await supabase
      .from('simulation_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('clerk_user_id', clerkUserId)
      .eq('status', 'active')
      .maybeSingle()

    if (!session) return []

    const { data } = await supabase
      .from('conversation_messages')
      .select('role, content, month, year')
      .eq('session_id', sessionId)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: true })
      .limit(limit)

    if (!data) return []

    return (data as Array<{ role: string; content: string; month: number; year: number }>).map((row) => ({
      role: row.role as 'user' | 'assistant',
      content: row.content,
    }))
  } catch {
    return []
  }
}
