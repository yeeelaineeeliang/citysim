import { NextResponse } from 'next/server'
import { runChat } from '@/lib/chat'
import { getOrCreateSession, saveMessages, loadSessionHistory } from '@/lib/session'
import type { ChatRequest } from '@/lib/tools/types'

export const dynamic = 'force-dynamic'

interface ChatBody extends Partial<ChatRequest> {
  sessionId?: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatBody

    if (!body.message || typeof body.message !== 'string' || !body.message.trim()) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }
    if (!body.neighborhood || typeof body.neighborhood !== 'string') {
      return NextResponse.json({ error: 'neighborhood is required' }, { status: 400 })
    }
    if (typeof body.month !== 'number' || body.month < 1 || body.month > 12) {
      return NextResponse.json({ error: 'month must be a number 1–12' }, { status: 400 })
    }
    if (!body.profile || typeof body.profile !== 'object') {
      return NextResponse.json({ error: 'profile is required' }, { status: 400 })
    }

    const year = body.year ?? 2024

    // ── Session continuity ─────────────────────────────────────────────────────
    // Always call getOrCreateSession to ensure cityId + communityAreaId are
    // available so saveMessages can persist every turn (not just the first).
    const sessionCtx = await getOrCreateSession(body.neighborhood, year)

    let history = body.history ?? []

    // Load DB history when the client has no in-memory history — this makes
    // context survive page refreshes and carry across months.
    if (sessionCtx?.sessionId && history.length === 0) {
      const dbHistory = await loadSessionHistory(sessionCtx.sessionId, 20)
      if (dbHistory.length > 0) history = dbHistory
    }

    const chatReq: ChatRequest = {
      message:      body.message.trim(),
      neighborhood: body.neighborhood,
      month:        body.month,
      year,
      profile:      body.profile,
      history,
    }

    const result = await runChat(chatReq)

    // Persist this turn to Supabase (non-blocking — failures are silent)
    if (sessionCtx?.sessionId && sessionCtx.cityId && sessionCtx.communityAreaId) {
      void saveMessages(
        sessionCtx,
        body.month,
        year,
        body.message.trim(),
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
