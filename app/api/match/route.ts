import { NextResponse } from 'next/server'
import { matchNeighborhoods } from '@/lib/neighborhoodMatch'
import {
  jsonError,
  RATE_LIMITS,
  rateLimitPublicRequest,
  rejectOversizedRequest,
  validateMatchBody,
} from '@/lib/apiSecurity'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const rateLimited = await rateLimitPublicRequest(request, RATE_LIMITS.standard)
    if (rateLimited) return rateLimited

    const tooLarge = rejectOversizedRequest(request)
    if (tooLarge) return tooLarge

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return jsonError('request body must be valid JSON', 400)
    }
    const validated = validateMatchBody(rawBody)
    if (!validated.ok) return jsonError(validated.error, 400)

    const matches = await matchNeighborhoods(validated.value.profile, validated.value.topN)

    return NextResponse.json({ matches })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Matching failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
