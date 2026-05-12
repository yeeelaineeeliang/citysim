import assert from 'node:assert/strict'
import test from 'node:test'

import { buildMapActions } from './mapActions'
import type { ChatRequest, ToolResult } from './tools/types'

const profile: ChatRequest['profile'] = {
  budgetRange: '$2,000+',
  workplace: 'The University of Chicago',
  workplaceLat: 41.7886,
  workplaceLng: -87.5987,
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

function request(overrides: Partial<Pick<ChatRequest, 'neighborhood' | 'month' | 'year' | 'profile'>> = {}) {
  return {
    neighborhood: 'Hyde Park',
    month: 10,
    year: 2024,
    profile,
    ...overrides,
  }
}

test('builds an aggregate entertainment marker from count data', async () => {
  const results: ToolResult[] = [{
    restaurants: 94,
    bars: 12,
    parks: ['Promontory Point', 'Jackson Park'],
    farmers_markets: true,
  }]

  const actions = await buildMapActions(request(), ['query_entertainment'], results)
  assert.equal(actions.length, 1)
  const action = actions[0]

  assert.equal(action.type, 'entertainment_summary')
  if (action.type !== 'entertainment_summary') return
  assert.equal(action.restaurants, 94)
  assert.equal(action.bars, 12)
  assert.deepEqual(action.center, { lat: 41.7943, lng: -87.5918 })
  assert.equal(action.farmersMarkets, true)
})

test('builds a coarse commute route without inventing a route label', async () => {
  const results: ToolResult[] = [
    {
      origin_neighborhood: 'Hyde Park',
      destination: 'The University of Chicago',
      mode: 'transit',
      distance_miles: 0.5,
      estimated_minutes: 8,
      estimates: {
        transit_minutes: 8,
        driving_minutes: 5,
        walking_minutes: 10,
        biking_minutes: 4,
      },
      confidence: 'medium',
      note: 'Coarse estimate.',
    },
    {
      l_ridership: 47100,
      bus_ridership: 124000,
      metra_ridership: 0,
      crowding_level: 'high',
      avg_peak_wait_minutes: 8,
      route_summary: {},
      stops: ['55th-56th-57th (Metra)'],
    },
  ]

  const actions = await buildMapActions(request(), ['query_commute', 'query_transit'], results)
  const action = actions.find((item) => item.type === 'commute_route')

  assert.ok(action)
  if (action.type !== 'commute_route') return
  assert.equal(action.estimatedMinutes, 8)
  assert.equal(action.distanceMiles, 0.5)
  assert.equal(action.routeLabel, null)
  assert.deepEqual(action.destination, { lat: 41.7886, lng: -87.5987 })
})

test('builds crime area signal thresholds and falls back without boundary geometry', async () => {
  const results: ToolResult[] = [{
    total: 130,
    violent_count: 40,
    property_count: 70,
    by_type: { theft: 60 },
    trend: 'above average',
  }]

  const actions = await buildMapActions(
    request(),
    ['query_crime'],
    results,
    { getCrimeAreaContext: async () => ({ cityAverage: 100 }) },
  )
  const action = actions[0]

  assert.equal(action.type, 'crime_area_signal')
  if (action.type !== 'crime_area_signal') return
  assert.equal(action.level, 'above_average')
  assert.equal(action.ratio, 1.3)
  assert.equal(action.boundaryGeojson, undefined)
  assert.equal(action.fillColor, '#b4503c')
})

test('attaches crime boundary geometry when it is available', async () => {
  const boundary = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[[-87.6, 41.79], [-87.59, 41.79], [-87.59, 41.8], [-87.6, 41.79]]],
    },
  }
  const results: ToolResult[] = [{
    total: 70,
    violent_count: 20,
    property_count: 40,
    by_type: { theft: 30 },
    trend: 'below average',
  }]

  const actions = await buildMapActions(
    request(),
    ['query_crime'],
    results,
    { getCrimeAreaContext: async () => ({ cityAverage: 100, boundaryGeojson: boundary }) },
  )
  const action = actions[0]

  assert.equal(action.type, 'crime_area_signal')
  if (action.type !== 'crime_area_signal') return
  assert.equal(action.level, 'below_average')
  assert.equal(action.boundaryGeojson, boundary)
})
