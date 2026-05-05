import { NextResponse } from 'next/server'
import { runChat } from '@/lib/chat'
import type { ChatRequest } from '@/lib/tools/types'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ChatRequest>

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

    const result = await runChat(body as ChatRequest)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chat failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
