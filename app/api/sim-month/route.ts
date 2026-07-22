import { NextResponse } from 'next/server'
import { runMonthFull, runMonthFullStream } from '@/lib/chat'
import {
  jsonError,
  RATE_LIMITS,
  rateLimitRequest,
  rejectOversizedRequest,
  requireApiUser,
  validateBriefBody,
} from '@/lib/apiSecurity'

export const dynamic = 'force-dynamic'

const encoder = new TextEncoder()

function sseEvent(data: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
}

export async function POST(request: Request) {
  try {
    const authResult = await requireApiUser()
    if (!authResult.ok) return authResult.response

    const rateLimited = await rateLimitRequest(request, authResult.userId, RATE_LIMITS.sim)
    if (rateLimited) return rateLimited

    const tooLarge = rejectOversizedRequest(request)
    if (tooLarge) return tooLarge

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return jsonError('request body must be valid JSON', 400)
    }

    const validated = validateBriefBody(rawBody)
    if (!validated.ok) return jsonError(validated.error, 400)

    const wantsSSE = request.headers.get('accept')?.includes('text/event-stream')

    if (wantsSSE) {
      const stream = new ReadableStream({
        async start(controller) {
          try {
            await runMonthFullStream(
              validated.value,
              ({ mapActions, toolsUsed, dataSummary }) => {
                controller.enqueue(sseEvent({ type: 'tools', mapActions, toolsUsed, dataSummary }))
              },
              (text) => {
                controller.enqueue(sseEvent({ type: 'chunk', text }))
              },
            )
            controller.enqueue(sseEvent({ type: 'done' }))
          } catch {
            controller.enqueue(sseEvent({ type: 'error', message: 'Stream failed' }))
          } finally {
            controller.close()
          }
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    // JSON fallback for non-SSE callers
    const result = await runMonthFull(validated.value)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Month simulation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
