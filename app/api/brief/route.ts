import { NextResponse } from 'next/server'
import { runBrief } from '@/lib/chat'
import {
  jsonError,
  RATE_LIMITS,
  rateLimitRequest,
  rejectOversizedRequest,
  requireApiUser,
  validateBriefBody,
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
    const validated = validateBriefBody(rawBody)
    if (!validated.ok) return jsonError(validated.error, 400)

    const result = await runBrief(validated.value)

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Brief generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
