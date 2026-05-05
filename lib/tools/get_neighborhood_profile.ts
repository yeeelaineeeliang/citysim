import { hasSupabaseCredentials, createSupabaseAdminClient } from '@/lib/supabase'
import type { NeighborhoodProfile } from './types'

// Builds a readable summary from the descriptors text[] column.
// e.g. ["University", "Lakefront", "Transit-rich"] → "University · Lakefront · Transit-rich"
function buildSummary(name: string, descriptors: string[]): string {
  if (descriptors.length === 0) return `${name}, a Chicago community area.`
  return `${name} — ${descriptors.join(' · ')}`
}

// Hardcoded summaries as fallback when descriptors are empty or Supabase is unavailable.
const SUMMARIES: Record<string, string> = {
  'hyde park':       'University neighborhood on the lakefront — academic, walkable, quiet nights, Green Line and Metra Electric access along 55th and 63rd.',
  'woodlawn':        'Immediately south of Hyde Park, adjacent to the Obama Presidential Center site, with Green Line stops and some of the most affordable rents on the south lakefront.',
  'south shore':     'Lakefront neighborhood with a large park district campus on the water, Metra Electric access downtown, and rents well below the city median.',
  'bronzeville':     'Historic African-American neighborhood on the near-south lakefront, seeing reinvestment, with Green Line access and an active affordable housing stock.',
  'pilsen':          'Mexican-American cultural neighborhood with a strong arts community, Pink Line access, murals on nearly every block, and affordable rents for the near-south side.',
  'logan square':    'Northwest-side neighborhood with a vibrant food and arts scene, tree-lined boulevards, and strong bus and Blue Line connections downtown.',
  'wicker park':     'Dense, walkable neighborhood known for nightlife, independent retail, and Blue Line connectivity. Highest walkability scores outside the Loop.',
  'lincoln park':    'Affluent north-side neighborhood with premium dining, Lincoln Park Zoo, and strong Red/Brown/Purple Line access. One of the highest-rent areas in the city.',
  'lakeview':        'Busy north lakefront neighborhood surrounding Wrigley Field — dense dining and bar scene, strong Red/Brown/Purple Line access, competitive rents.',
  'uptown':          'Diverse north-side neighborhood with a large immigrant community, strong transit (Red Line, multiple bus lines), and some of the most diverse dining options in the city.',
  'rogers park':     'Northernmost neighborhood in Chicago — known for diversity, lakefront access, Red Line terminus, and the lowest rents of any lakefront neighborhood.',
  'near north side': 'Dense, high-income lakefront district encompassing River North, Gold Coast, and Streeterville — excellent transit, premium rents, walkable to Loop.',
}

async function fromSupabase(neighborhood: string): Promise<NeighborhoodProfile | null> {
  const supabase = createSupabaseAdminClient()

  const { data } = await supabase
    .from('community_areas')
    .select('name, population, area_sq_miles, descriptors')
    .ilike('name', neighborhood)
    .limit(1)
    .single()

  if (!data) return null

  const descriptors = Array.isArray(data.descriptors) ? (data.descriptors as string[]) : []
  const key = (data.name as string).toLowerCase().trim()
  const summary = descriptors.length > 0
    ? buildSummary(data.name as string, descriptors)
    : (SUMMARIES[key] ?? buildSummary(data.name as string, []))

  return {
    name: data.name as string,
    summary,
    population: (data.population as number) ?? 0,
    area_sq_miles: Number(data.area_sq_miles ?? 0),
  }
}

export async function getNeighborhoodProfile(neighborhood: string): Promise<NeighborhoodProfile> {
  if (hasSupabaseCredentials()) {
    try {
      const result = await fromSupabase(neighborhood)
      if (result) return result
    } catch {
      // fall through to hardcoded fallback
    }
  }

  const key = neighborhood.toLowerCase().trim()
  const summary = SUMMARIES[key] ?? `${neighborhood}, a Chicago community area.`
  return { name: neighborhood, summary, population: 0, area_sq_miles: 0 }
}
