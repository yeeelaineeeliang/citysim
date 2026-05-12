import assert from 'node:assert/strict'
import test from 'node:test'

import { runChat } from './chat'
import type { ChatRequest } from './tools/types'

const DISABLED_ENV_KEYS = [
  'GROQ_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const

const savedEnv = new Map<string, string | undefined>(
  DISABLED_ENV_KEYS.map((key) => [key, process.env[key]]),
)

for (const key of DISABLED_ENV_KEYS) delete process.env[key]

test.after(() => {
  for (const [key, value] of savedEnv) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

const baseProfile: ChatRequest['profile'] = {
  budgetRange: '$2,000+',
  workplace: 'The University of Chicago',
  commutePref: 'transit',
  priorities: {
    safety: 0.2,
    transit: 0.35,
    affordability: 0.35,
    cityServices: 0.05,
    entertainment: 0.05,
  },
  lifestyle: ['Short commute'],
  notes: '',
}

function request(overrides: Partial<ChatRequest>): ChatRequest {
  return {
    message: 'Can I afford to live here?',
    neighborhood: 'Oakland',
    month: 10,
    year: 2024,
    profile: baseProfile,
    ...overrides,
  }
}

function assertNoGenericHousingFiller(response: string) {
  assert.doesNotMatch(response, /affordable.{0,80}available|available.{0,80}affordable/i)
  assert.doesNotMatch(response, /variety of options/i)
  assert.doesNotMatch(response, /allocate the rest/i)
  assert.doesNotMatch(response, /grocer|other expenses/i)
}

function assertNoInventedRail(response: string) {
  assert.doesNotMatch(response, /rely on (the )?['’]?l\b/i)
  assert.doesNotMatch(response, /several ['’]?l stops|l stops to choose|choose from/i)
  assert.doesNotMatch(response, /\d{1,3}(,\d{3})+\s+(riders|rides)\s+per\s+month/i)
}

test('answers Oakland affordability with budget gap and stock caveat', async () => {
  const result = await runChat(request({ message: 'Can I afford to live here?' }))

  assert.match(result.toolsUsed.join(','), /query_housing/)
  assert.match(result.response, /\$2,000\+ budget/i)
  assert.match(result.response, /\$(831|875)\/month/i)
  assert.match(result.response, /database stock|not open apartments/i)
  assert.match(result.response, /live listings|income rules|unit size/i)
  assertNoGenericHousingFiller(result.response)
})

test('answers Oakland to UChicago commute without inventing L-route certainty', async () => {
  const result = await runChat(request({ message: 'how to commute to UChicago' }))

  assert.match(result.toolsUsed.join(','), /query_commute/)
  assert.match(result.toolsUsed.join(','), /query_transit/)
  assert.match(result.response, /coarse transit estimate|not a CTA itinerary/i)
  assert.match(result.response, /about \d+ minutes/i)
  assert.match(result.response, /does not return an L stop list|not a route plan/i)
  assert.match(result.response, /exact starting block/i)
  assertNoInventedRail(result.response)
})

test('handles sparse housing records without pretending affordability is proven', async () => {
  const result = await runChat(request({
    message: 'Can I afford to live here?',
    neighborhood: 'Fuller Park',
  }))

  assert.match(result.response, /sparse loaded housing data|no usable rent estimate/i)
  assert.match(result.response, /database stock|vacancy signal/i)
  assert.match(result.response, /live listings/i)
  assertNoGenericHousingFiller(result.response)
})

test('handles transit access with no L stop list as a limitation', async () => {
  const result = await runChat(request({ message: 'How is transit in Oakland?' }))

  assert.match(result.toolsUsed.join(','), /query_transit/)
  assert.match(result.response, /does not return an L stop list/i)
  assert.match(result.response, /access signal, not a route plan/i)
  assertNoInventedRail(result.response)
})
