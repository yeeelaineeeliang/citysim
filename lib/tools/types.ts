export interface UserProfile {
  budgetRange: string
  monthlyBudget?: number
  workplace: string
  workplaceLat?: number
  workplaceLng?: number
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
  metra_ridership: number
  crowding_level: 'low' | 'moderate' | 'high' | 'very_high'
  avg_peak_wait_minutes: number | null
  route_summary: Record<string, unknown>
  stops: string[]
  note?: string
}

export interface CommuteResult {
  origin_neighborhood: string
  destination: string
  mode: UserProfile['commutePref']
  distance_miles: number | null
  estimated_minutes: number | null
  estimates: {
    transit_minutes: number | null
    driving_minutes: number | null
    walking_minutes: number | null
    biking_minutes: number | null
  }
  confidence: 'low' | 'medium'
  note: string
}

export interface ServiceResult {
  total_requests: number
  by_type: Record<string, number>
  avg_response_days: number
}

export interface HousingResult {
  affordable_units: number
  affordable_developments: number
  // null = no estimate loaded for this area. Never coerce to 0 — a zero rent
  // reads as "fits any budget" downstream in verdicts.
  avg_rent_estimate: number | null
  median_rent_estimate: number | null
  note?: string
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

export interface MapPoint {
  lat: number
  lng: number
}

export type EntertainmentPlaceCategory = 'food' | 'bar' | 'park' | 'civic' | 'entertainment'

export interface EntertainmentPlace {
  id: string
  name: string
  category: EntertainmentPlaceCategory
  lat: number
  lng: number
  neighborhood?: string
  address?: string
  source?: string
  description?: string
}

export interface EntertainmentSummaryMapAction {
  type: 'entertainment_summary'
  id: string
  title: string
  center: MapPoint
  restaurants: number
  bars: number
  parks: string[]
  farmersMarkets: boolean
  places?: EntertainmentPlace[]
}

export interface CommuteRouteSegment {
  mode: UserProfile['commutePref'] | 'walk'
  label: string
  geometry: [number, number][]
  fromName?: string
  toName?: string
}

export interface CommuteRouteMapAction {
  type: 'commute_route'
  id: string
  title: string
  originName: string
  destinationName: string
  origin: MapPoint
  destination: MapPoint
  mode: UserProfile['commutePref']
  distanceMiles: number | null
  estimatedMinutes: number | null
  routeLabel: string | null
  caveat: string
  geometry?: [number, number][]
  segments?: CommuteRouteSegment[]
  source?: 'cta_gtfs_cached' | 'osrm' | 'estimate' | 'demo_seed'
  confidence?: 'low' | 'medium'
}

export interface CrimeAreaSignalMapAction {
  type: 'crime_area_signal'
  id: string
  title: string
  neighborhood: string
  center: MapPoint
  total: number
  cityAverage: number | null
  ratio: number | null
  level: 'below_average' | 'near_average' | 'above_average' | 'unknown'
  fillColor: string
  fillOpacity: number
  label: string
  byType?: Record<string, number>
  boundaryGeojson?: unknown
}

export interface TransitStop {
  name: string
  lat: number
  lng: number
  routeLabel: string
  mode: 'bus' | 'rail'
}

export interface TransitStopsMapAction {
  type: 'transit_stops'
  id: string
  neighborhood: string
  stops: TransitStop[]
}

export type MapAction =
  | EntertainmentSummaryMapAction
  | CommuteRouteMapAction
  | CrimeAreaSignalMapAction
  | TransitStopsMapAction

export type ToolResult =
  | CrimeResult
  | TransitResult
  | CommuteResult
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
  mapActions?: MapAction[]
}

export interface DataSummary {
  crime: number | null
  transitRiders: number | null
  requests311: number | null
  avgRent: number | null
  commuteMinutes: number | null
}
