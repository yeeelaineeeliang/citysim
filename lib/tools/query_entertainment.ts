import { hasSupabaseCredentials, createSupabaseAdminClient } from '@/lib/supabase'
import type { EntertainmentResult } from './types'

// Parks column is jsonb string array: ["Jackson Park", "Midway Plaisance"]
// farmers_markets boolean = seasonal presence (true means active May–Oct)
const FARMERS_MARKET_SEASON_START = 5  // May
const FARMERS_MARKET_SEASON_END   = 10 // October

function isFarmersMarketActive(hasFarmersMarket: boolean, month?: number): boolean {
  if (!hasFarmersMarket) return false
  if (month === undefined) return hasFarmersMarket
  return month >= FARMERS_MARKET_SEASON_START && month <= FARMERS_MARKET_SEASON_END
}

interface EntStub {
  restaurants: number
  bars: number
  parks: string[]
  farmers_markets: boolean
}

const STUBS: Record<string, EntStub> = {
  'hyde park':    { restaurants: 148, bars: 34,  parks: ['Jackson Park', 'Midway Plaisance', 'Bixler Park'],           farmers_markets: true  },
  'logan square': { restaurants: 214, bars: 67,  parks: ['Logan Square Boulevards', 'Humboldt Park', 'Palmer Square'],  farmers_markets: true  },
  'wicker park':  { restaurants: 187, bars: 82,  parks: ['Wicker Park', 'Holstein Park'],                               farmers_markets: true  },
  'lincoln park': { restaurants: 312, bars: 95,  parks: ['Lincoln Park', 'Oz Park', 'Jonquil Park'],                    farmers_markets: true  },
  'pilsen':       { restaurants: 142, bars: 41,  parks: ['Harrison Park', 'Dvorak Park'],                               farmers_markets: true  },
  'lakeview':     { restaurants: 286, bars: 108, parks: ['Wrigley Field area', 'Wrightwood Park'],                      farmers_markets: true  },
  'south shore':  { restaurants: 94,  bars: 22,  parks: ['South Shore Cultural Center', 'Rainbow Beach Park'],          farmers_markets: true  },
  'bronzeville':  { restaurants: 88,  bars: 18,  parks: ['Douglas Park', 'Dunbar Park'],                                farmers_markets: false },
  'woodlawn':     { restaurants: 62,  bars: 14,  parks: ['Woodlawn Park', 'Burnham Park'],                              farmers_markets: false },
  'uptown':       { restaurants: 178, bars: 61,  parks: ['Sunnyside Park', 'Wilson Yard'],                              farmers_markets: true  },
}

const DEFAULT: EntStub = { restaurants: 95, bars: 28, parks: ['local community park'], farmers_markets: false }

async function fromSupabase(neighborhood: string, month?: number): Promise<EntertainmentResult | null> {
  const supabase = createSupabaseAdminClient()

  const { data: ca } = await supabase
    .from('community_areas')
    .select('id')
    .ilike('name', neighborhood)
    .limit(1)
    .single()

  if (!ca) return null

  const { data } = await supabase
    .from('entertainment_metrics')
    .select('restaurants, bars, parks, libraries, farmers_markets')
    .eq('community_area_id', ca.id)
    .eq('year', 2024)
    .single()

  if (!data) return null

  // Parks and libraries are stored as [{name: "..."}, ...] objects from ETL seeding.
  // We support both plain strings (legacy) and {name} objects.
  function extractNames(raw: unknown): string[] {
    if (!Array.isArray(raw)) return []
    return raw.flatMap((item) => {
      if (typeof item === 'string') return [item]
      if (item && typeof item === 'object' && 'name' in (item as Record<string, unknown>)) {
        const n = (item as Record<string, unknown>).name
        return typeof n === 'string' && n ? [n] : []
      }
      return []
    })
  }

  const parks     = extractNames(data.parks)
  const libraries = extractNames(data.libraries)
  // Merge libraries into parks list so the agent can mention both green space and civic amenities
  const parksPlusLibraries = [
    ...parks,
    ...libraries.map((l) => `${l} (library)`),
  ]

  return {
    restaurants: (data.restaurants as number) ?? 0,
    bars: (data.bars as number) ?? 0,
    parks: parksPlusLibraries,
    farmers_markets: isFarmersMarketActive(Boolean(data.farmers_markets), month),
  }
}

export async function queryEntertainment(neighborhood: string, month?: number): Promise<EntertainmentResult> {
  if (hasSupabaseCredentials()) {
    try {
      const result = await fromSupabase(neighborhood, month)
      if (result) return result
    } catch {
      // fall through to stub
    }
  }

  const key = neighborhood.toLowerCase().trim()
  const stub = STUBS[key] ?? DEFAULT
  return {
    restaurants: stub.restaurants,
    bars: stub.bars,
    parks: stub.parks,
    farmers_markets: isFarmersMarketActive(stub.farmers_markets, month),
  }
}
