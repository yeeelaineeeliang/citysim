import { NextResponse } from 'next/server'
import { runChat } from '@/lib/chat'
import { getOrCreateSession, saveMessages, loadSessionHistory } from '@/lib/session'
import {
  jsonError,
  RATE_LIMITS,
  rateLimitRequest,
  rejectOversizedRequest,
  requireApiUser,
  validateChatBody,
} from '@/lib/apiSecurity'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const authResult = await requireApiUser()
    if (!authResult.ok) return authResult.response

    const rateLimited = rateLimitRequest(request, authResult.userId, RATE_LIMITS.ai)
    if (rateLimited) return rateLimited

    const tooLarge = rejectOversizedRequest(request)
    if (tooLarge) return tooLarge

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return jsonError('request body must be valid JSON', 400)
    }
    const validated = validateChatBody(rawBody)
    if (!validated.ok) return jsonError(validated.error, 400)

    const { message, neighborhood, month, year, profile } = validated.value

    // ── Session continuity ─────────────────────────────────────────────────────
    // Always call getOrCreateSession to ensure cityId + communityAreaId are
    // available so saveMessages can persist every turn (not just the first).
    const sessionCtx = await getOrCreateSession(neighborhood, year, authResult.userId)

    let history = validated.value.history

    // Load DB history when the client has no in-memory history — this makes
    // context survive page refreshes and carry across months.
    if (sessionCtx?.sessionId && history.length === 0) {
      const dbHistory = await loadSessionHistory(sessionCtx.sessionId, authResult.userId, 20)
      if (dbHistory.length > 0) history = dbHistory
    }

    const chatReq = {
      message,
      neighborhood,
      month,
      year,
      profile,
      history,
    }

    const result = await runChat(chatReq)

    // Persist this turn to Supabase (non-blocking — failures are silent)
    if (sessionCtx?.sessionId && sessionCtx.cityId && sessionCtx.communityAreaId) {
      void saveMessages(
        sessionCtx,
        month,
        year,
        message,
        result.response,
        result.toolsUsed,
      )
    }

    return NextResponse.json({
      ...result,
      sessionId: sessionCtx?.sessionId ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chat failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
