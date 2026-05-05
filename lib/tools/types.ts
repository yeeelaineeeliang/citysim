export interface UserProfile {
  budgetRange: string
  workplace: string
  commutePref: 'transit' | 'driving' | 'walking' | 'biking'
  priorities: {
    safety: number
    transit: number
    affordability: number
    cityServices: number
    entertainment: number
  }
  lifestyle: string[]
  notes: string
}

export interface CrimeResult {
  total: number
  violent_count: number
  property_count: number
  by_type: Record<string, number>
  trend: string
}

export interface TransitResult {
  l_ridership: number
  bus_ridership: number
  crowding_level: 'low' | 'moderate' | 'high' | 'very_high'
  stops: string[]
}

export interface ServiceResult {
  total_requests: number
  by_type: Record<string, number>
  avg_response_days: number
}

export interface HousingResult {
  affordable_units: number
  avg_rent_estimate: number
}

export interface EntertainmentResult {
  restaurants: number
  bars: number
  parks: string[]
  farmers_markets: boolean
}

export interface NeighborhoodProfile {
  name: string
  summary: string
  population: number
  area_sq_miles: number
}

export type ToolResult =
  | CrimeResult
  | TransitResult
  | ServiceResult
  | HousingResult
  | EntertainmentResult
  | NeighborhoodProfile

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  message: string
  neighborhood: string
  month: number
  year?: number
  profile: UserProfile
  history?: ChatMessage[]
}

export interface ChatResponse {
  response: string
  toolsUsed: string[]
}
