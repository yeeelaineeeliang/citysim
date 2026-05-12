import { queryCrime } from './query_crime'
import { queryTransit } from './query_transit'
import { queryCommute } from './query_commute'
import { query311 } from './query_311'
import { queryHousing } from './query_housing'
import { queryEntertainment } from './query_entertainment'
import { getNeighborhoodProfile } from './get_neighborhood_profile'
import type { ToolResult, UserProfile } from './types'

export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const neighborhood = typeof args.neighborhood === 'string' ? args.neighborhood : ''
  const month = typeof args.month === 'number' ? args.month : 1
  const year = typeof args.year === 'number' ? args.year : 2024
  const workplace = typeof args.workplace === 'string' ? args.workplace : ''
  const mode = (
    args.mode === 'driving' ||
    args.mode === 'walking' ||
    args.mode === 'biking' ||
    args.mode === 'transit'
      ? args.mode
      : 'transit'
  ) as UserProfile['commutePref']
  const workplaceLat = typeof args.workplaceLat === 'number' ? args.workplaceLat : undefined
  const workplaceLng = typeof args.workplaceLng === 'number' ? args.workplaceLng : undefined

  switch (name) {
    case 'query_crime':
      return queryCrime(neighborhood, month, year)
    case 'query_transit':
      return queryTransit(neighborhood, month)
    case 'query_commute':
      return queryCommute(neighborhood, workplace, mode, workplaceLat, workplaceLng)
    case 'query_311':
      return query311(neighborhood, month)
    case 'query_housing':
      return queryHousing(neighborhood)
    case 'query_entertainment':
      return queryEntertainment(
        neighborhood,
        typeof args.month === 'number' ? args.month : undefined,
      )
    case 'get_neighborhood_profile':
      return getNeighborhoodProfile(neighborhood)
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
