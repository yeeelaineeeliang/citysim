import { NextResponse } from 'next/server'
import { matchNeighborhoods } from '@/lib/neighborhoodMatch'
import type { UserProfile } from '@/lib/tools/types'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { profile?: UserProfile; topN?: number }

    if (!body.profile || typeof body.profile !== 'object') {
      return NextResponse.json({ error: 'profile is required' }, { status: 400 })
    }

    const matches = await matchNeighborhoods(body.profile, body.topN ?? 5)

    return NextResponse.json({ matches })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Matching failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
