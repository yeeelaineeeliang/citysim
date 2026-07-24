import type { DataSummary, MapAction, UserProfile } from './tools/types'
import type { SimAct } from '@/app/sim/types'

export const DEMO_PROFILE: UserProfile = {
  budgetRange: '$1,001–$1,500',
  monthlyBudget: 1400,
  workplace: 'University of Chicago',
  workplaceLat: 41.7886,
  workplaceLng: -87.5987,
  commutePref: 'transit',
  priorities: {
    safety: 5,
    transit: 4,
    affordability: 3,
    cityServices: 2,
    entertainment: 4,
  },
  lifestyle: ['parks', 'restaurants'],
  notes: 'Near the Red Line',
}

export const DEMO_NEIGHBORHOOD = 'Hyde Park'
export const DEMO_MONTH = 10

const HYDE_PARK_POINT = { lat: 41.7943, lng: -87.5918 }
const UCHICAGO_POINT = { lat: 41.7886, lng: -87.5987 }
const DEMO_TRANSIT_GEOMETRY: [number, number][] = [
  [41.7943, -87.5918],
  [41.79308, -87.58602],
  [41.7908, -87.58934],
  [41.78935, -87.59422],
  [41.7886, -87.5987],
]

// Numbers below are seeded from the ingested 2024 civic data (entertainment_metrics,
// crime_monthly, service_requests_311_monthly, housing_metrics) — keep in sync
// with the database, not invented for narrative convenience.
function demoEntertainmentAction(month: number): MapAction {
  return {
    type: 'entertainment_summary',
    id: `demo-entertainment-${month}`,
    title: 'Hyde Park entertainment',
    center: HYDE_PARK_POINT,
    restaurants: 133,
    bars: 35,
    parks: ['Burnham Park & Promontory Point', 'Midway Plaisance', 'Nichols Park'],
    farmersMarkets: month >= 5 && month <= 10,
  }
}

function demoCommuteAction(month: number, estimatedMinutes: number): MapAction {
  return {
    type: 'commute_route',
    id: `demo-commute-${month}`,
    title: `~${estimatedMinutes} min · 0.5 mi · Route 6`,
    originName: DEMO_NEIGHBORHOOD,
    destinationName: DEMO_PROFILE.workplace,
    origin: HYDE_PARK_POINT,
    destination: UCHICAGO_POINT,
    mode: 'transit',
    distanceMiles: 0.5,
    estimatedMinutes,
    routeLabel: 'Route 6',
    caveat: 'Pre-verified CTA Route 6 corridor for Hyde Park ↔ UChicago, matching the cached GTFS shape — shown from saved demo data rather than a live per-request lookup.',
    geometry: DEMO_TRANSIT_GEOMETRY,
    segments: [{
      mode: 'transit',
      label: 'CTA Route 6',
      geometry: DEMO_TRANSIT_GEOMETRY,
      fromName: '55th Street',
      toName: 'University of Chicago',
    }],
    source: 'demo_seed',
    confidence: 'medium',
  }
}

function demoCrimeAction(month: number, total: number, cityAverage: number): MapAction {
  const ratio = Number((total / cityAverage).toFixed(2))
  return {
    type: 'crime_area_signal',
    id: `demo-crime-${month}`,
    title: 'Hyde Park crime signal',
    neighborhood: DEMO_NEIGHBORHOOD,
    center: HYDE_PARK_POINT,
    total,
    cityAverage,
    ratio,
    level: ratio <= 0.85 ? 'below_average' : ratio >= 1.15 ? 'above_average' : 'near_average',
    fillColor: ratio <= 0.85 ? '#64a064' : ratio >= 1.15 ? '#b4503c' : '#c8b478',
    fillOpacity: ratio >= 1.15 ? 0.18 : 0.15,
    label: ratio <= 0.85
      ? 'Below the city average this month.'
      : ratio >= 1.15
        ? 'Above the city average this month.'
        : 'Near the city average this month.',
  }
}

export const DEMO_OPENING =
  'October in Hyde Park has that crisp fall feel, with campus foot traffic picking up and the lake getting dramatic. Ask me anything you want to size up here.'

export const DEMO_BRIEF =
  "October in Hyde Park is one of the better months to land here — the month logged 231 reported incidents, roughly 7.5 a day, which sounds like a lot until you see the citywide picture: the average Chicago community area ran about 292 in October, so Hyde Park sits below the city norm for a neighborhood this active. Theft is the dominant pattern — 90 reports, versus 45 violent incidents — so the risk you'd actually manage day-to-day is keeping your bike locked and being alert around parked cars, not your personal safety on a walk home. Your commute to UChicago is essentially a short hop — the 6 Express runs directly along the corridor, with the Metra Electric at 55th–56th–57th as the rail option — so you'll see some crowding at 8 AM but nothing that makes you wait for a second bus. The lakefront is still in full use this time of year, 53rd Street is at its most walkable before the cold sets in, and the neighborhood genuinely rewards the kind of month where you explore on foot."

export interface DemoQA {
  month: number
  keywords: string[]
  answer: string
  toolsUsed: string[]
  mapActions?: MapAction[]
}

export const DEMO_QA: DemoQA[] = [
  // ── October ────────────────────────────────────────────────────────────────
  {
    month: 10,
    keywords: ['commute', 'morning', 'route', 'work', 'get to', 'getting to', 'transit', 'bus', 'train', 'cta'],
    answer:
      "Your commute from Hyde Park to UChicago in October is about as short as a transit commute in Chicago gets — the 6 Express runs directly along the corridor, and most of campus is within a mile of the neighborhood core, so the trip rarely tops 15 minutes door to door. Expect a crowded bus in the 8–9 AM window but nothing that would make you wait for a second one. Worth knowing: Hyde Park has no L station inside the neighborhood — the Metra Electric at 55th–56th–57th is your rail option for the Loop, and the Green Line at Garfield is a bus ride west. If you're within six blocks of campus your actual best option may be walking, and it's worth mapping your exact block before assuming the bus is even necessary.",
    toolsUsed: ['query_commute', 'query_transit'],
    mapActions: [demoCommuteAction(10, 8)],
  },
  {
    month: 10,
    keywords: ['safe', 'crime', 'safety', 'danger', 'incident', 'violent', 'police', 'theft', 'robbery'],
    answer:
      "Hyde Park in October logged 231 reported incidents — roughly 7.5 a day — but context matters: the average Chicago community area ran about 292 in October, so this sits below the citywide norm. Theft dominates with 90 reports, plus 26 motor vehicle thefts and 23 criminal damage reports, so the risk you'd actually manage day-to-day is keeping an eye on your bike lock and car, not personal safety on a daylight walk; violent incidents were 45 of the 231. The area around 53rd Street and the campus core stays well-lit and foot-trafficked well into the evening, which cuts the ambient risk further. Where you'd stay more alert is on blocks further east toward the lake after 10 PM — the usual city habits apply.",
    toolsUsed: ['query_crime'],
    mapActions: [demoCrimeAction(10, 231, 292)],
  },
  {
    month: 10,
    keywords: ['weekend', 'eat', 'restaurant', 'do here', 'food', 'bar', 'nightlife', 'outdoors', 'activities', 'park', 'fun'],
    answer:
      "Hyde Park has 133 restaurants and 35 bars in the active license records, and 53rd Street alone gives you a solid 45-minute walk of options — Medici, Valois, a handful of newer spots. October is the sweet spot for Promontory Point: the lakefront is still fully usable before the November cold cuts it, so Saturday mornings on the Point are genuinely one of the better free activities in Chicago. Between Burnham Park, the Midway Plaisance, and Nichols Park you have green space in every direction, the Promontory bar hosts live music most weekends, and the Logan Center on campus runs free performances through the fall quarter. You won't find the density of a Wicker Park Friday, but this neighborhood rewards the kind of weekend where you walk somewhere rather than plan ahead.",
    toolsUsed: ['query_entertainment'],
    mapActions: [demoEntertainmentAction(10)],
  },
  {
    month: 10,
    keywords: ['afford', 'rent', 'housing', 'budget', 'apartment', 'cost', 'expensive', 'cheap'],
    answer:
      "The loaded rent estimate for Hyde Park sits at $1,420/month — about $80 below the top of your $1,001–$1,500 budget, which makes this a tight but workable fit rather than a comfortable one. The neighborhood shows 111 recorded affordable housing units across 5 developments in the civic database — that's subsidized housing stock, not apartments you can call tomorrow, so don't treat that number as availability. For your actual search, blocks south of 55th Street tend to run lower than the 53rd Street corridor, and one-bedrooms in Hyde Park's older six-flats often come in below the neighborhood average. Live listings are the deciding source here; the estimate frames the budget conversation, it doesn't settle it.",
    toolsUsed: ['query_housing'],
  },
  {
    month: 10,
    keywords: ['311', 'city', 'service', 'repair', 'pothole', 'streetlight', 'maintenance', 'responsive', 'services'],
    answer:
      "Hyde Park in October logged 355 service requests through 311, with closed requests averaging about 24 days to resolution — actually the fastest month of the neighborhood's year, which peaked near 43 days in spring. The honest picture: Chicago 311 is a marathon, not a sprint, and Hyde Park is no exception. Traffic signal outages, water lead-test kit requests, abandoned vehicles, and rodent baiting make up the biggest categories this month. If something on your block breaks, file it and expect weeks rather than days — and know that October and December are when the backlog actually clears fastest here.",
    toolsUsed: ['query_311'],
  },

  // ── November ───────────────────────────────────────────────────────────────
  {
    month: 11,
    keywords: ['safe', 'crime', 'safety', 'november', 'danger', 'incident'],
    answer:
      "In October you saw 231 incidents in Hyde Park — November comes in lower at 203, which is typical as outdoor activity drops and with it the opportunity for street-level property crime. The pattern doesn't shift much: theft and property crime still drive the majority of reports (127 of the 203), with 46 violent incidents. The citywide November average per community area is around 256, so Hyde Park stays below the norm. If anything, the narrowing daylight is your biggest behavioral shift — the walk back from the 55th Street Metra stop after 5 PM is now in the dark, and it's worth knowing which blocks stay well-lit.",
    toolsUsed: ['query_crime'],
    mapActions: [demoCrimeAction(11, 203, 256)],
  },
  {
    month: 11,
    keywords: ['commute', 'cold', 'november', 'transit', 'bus', 'weather', 'morning', 'work'],
    answer:
      "Your October commute was largely walkable — November changes that math once the wind picks up off the lake, which it does reliably by mid-month. The 6 and 192 buses become the default even for a 10-minute walk, and expect the 8–9 AM buses to feel a bit more packed than October as the neighborhood collectively abandons the outdoor option. The Metra Electric at 55th–56th–57th stays consistent through November — commuter rail handles cold better than surface bus routes — so it's your more reliable Loop option if the buses are running slow in a cold snap. Hyde Park's lake-adjacent blocks get wind-tunnel effect on east–west streets, so routing through 55th rather than 53rd can shave a minute of wind exposure on your way to the stop.",
    toolsUsed: ['query_commute', 'query_transit'],
    mapActions: [demoCommuteAction(11, 8)],
  },
  {
    month: 11,
    keywords: ['weekend', 'indoor', 'november', 'restaurant', 'bar', 'do here', 'eat', 'activities'],
    answer:
      "Outdoor options contract in November but Hyde Park's indoor scene holds up well — the Promontory bar stays strong through the cold, and the Smart Museum and Oriental Institute on campus are genuinely excellent free options on a Sunday afternoon. 53rd Street restaurants see more traffic as people seek warmth, so weekends can have a wait at Medici and Valois by noon. The Hyde Park Art Center runs a fall show through mid-November worth a walk, and the Logan Center calendar stays full through the quarter. The neighborhood's character shifts more campus-oriented in winter — UChicago's schedule fills the week with talks and performances, most of them free and open to neighborhood residents.",
    toolsUsed: ['query_entertainment'],
    mapActions: [demoEntertainmentAction(11)],
  },

  // ── December ───────────────────────────────────────────────────────────────
  {
    month: 12,
    keywords: ['december', 'winter', 'holiday', 'park', 'cold', 'season', 'christmas', 'festive'],
    answer:
      "December in Hyde Park is quiet in the way that suits it — the campus slows between quarters, the lakefront is almost entirely yours on a weekday, and the 53rd Street strip has a low-key holiday feel without the State Street crowds. Promontory Point in December with no one else on it is one of Chicago's underrated free experiences, if you can handle the cold; the lake view on a clear day is worth the layers. The Museum of Science and Industry runs holiday exhibits that draw families from across the city, bumping foot traffic on the 55th corridor on weekends. Transit holds steady in December — the Metra Electric handles cold better than surface bus routes, so your Loop access stays consistent even in sub-20 conditions.",
    toolsUsed: ['query_entertainment', 'query_transit'],
    mapActions: [demoEntertainmentAction(12)],
  },
  {
    month: 12,
    keywords: ['rent', 'afford', 'housing', 'december', 'apartment', 'budget', 'cost', 'expensive'],
    answer:
      "The loaded rent estimate for Hyde Park holds at $1,420/month through December (median $1,450) — inside your $1,001–$1,500 budget, but with only about $80 of headroom, so this is a tight fit rather than a comfortable one. December is actually a reasonable time to search in Hyde Park because university-tied residents often move between quarters, creating unit turnover on a cycle most neighborhood renters don't know to watch for. The 111 recorded affordable units across 5 developments remain subsidized stock, not open listings — use that as a map of where affordable housing exists, then verify directly. One-bedrooms on the 56th–58th Street blocks, away from the higher-priced lakefront corridor, tend to run below the neighborhood average.",
    toolsUsed: ['query_housing'],
  },
]

// ── Cinematic 4-act demo run ──────────────────────────────────────────────────
// Pre-validated act data so the demo runs with zero API calls (auth-gated routes
// 401 for signed-out demo users). Numbers stay consistent with DEMO_QA above.

export interface DemoAct {
  narrative: string
  dataSummary: DataSummary
  mapActions: MapAction[]
}

export const DEMO_ACTS: Record<SimAct, DemoAct> = {
  1: {
    narrative:
      "April in Hyde Park starts gently — your 8 AM walk to the Route 6 stop is brisk but no longer bitter, and the bus to campus takes about 8 minutes door to door. You get a seat most mornings; Hyde Park has no L station of its own, so the 6 and the Metra Electric at 55th are the spine of your commute.\n\nThe street logs 186 reported incidents this month against a citywide area average of about 266 — theft leads with 54 reports, which in practice means locking your bike and little else. The blocks around 53rd Street and campus stay lit and trafficked well into the evening.\n\nOne thing you learn early: the city moves slowly here in spring — 366 service requests this month, and closed ones averaged over 40 days to resolve. Evenings, Promontory Point picks up its first joggers of the season, and the 53rd Street restaurants stop feeling like winter refuges.",
    dataSummary: { crime: 186, transitRiders: null, requests311: 366, avgRent: 1420, commuteMinutes: 8 },
    mapActions: [demoCommuteAction(4, 8), demoCrimeAction(4, 186, 266)],
  },
  2: {
    narrative:
      "It's midday in July and Hyde Park is at full volume — the lakefront at Promontory Point is busy from morning on, the farmers market runs, and with 133 restaurants and 35 bars in the active license records this is the month the neighborhood earns its lifestyle case.\n\nThe trade-off of summer: incidents rise to 224 this month — theft alone accounts for 89 — as more people and more bikes are out on the street. Still below the citywide July average of about 313, but this is the season to be deliberate about what you leave outside.\n\nSummer storms drive 311 to its yearly peak — 446 requests, led by tree emergencies and debris clean-up after the July winds come through. Your commute barely changes: about 9 minutes on the 6, running a touch emptier with the university between quarters.",
    dataSummary: { crime: 224, transitRiders: null, requests311: 446, avgRent: 1420, commuteMinutes: 9 },
    mapActions: [demoEntertainmentAction(7), demoCrimeAction(7, 224, 313)],
  },
  3: {
    narrative:
      "Late afternoon in October and the light is already thinning as you head home — the walk from the 55th Street Metra stop is now the coldest part of your day. The 6 runs crowded in the 8–9 AM window, but your door-to-door stays about 8 minutes.\n\nOctober is the year's peak on the street: 231 reported incidents, with theft at 90 and 26 motor vehicle thefts — still below the citywide October average of 292, but this is the month the bike lock and the empty car seat matter most.\n\nThe consolation is that the city is at its most responsive right now — 355 service requests with closed ones averaging about 24 days, the fastest of your year. The lakefront is in its last fully usable weeks; the neighborhood rewards one more Saturday on the Point before the season turns.",
    dataSummary: { crime: 231, transitRiders: null, requests311: 355, avgRent: 1420, commuteMinutes: 8 },
    mapActions: [demoCommuteAction(10, 8), demoCrimeAction(10, 231, 292)],
  },
  4: {
    narrative:
      "It's night in January and the wind off the lake owns the east–west streets. Your 8-minute commute is now closer to 12 — surface buses slow in the cold, and you learn to route through 55th instead of 53rd to cut the wind exposure. The Metra Electric becomes your reliable option for the Loop.\n\nWinter announces itself through 311: 372 requests this month, and the categories tell the story — 38 pothole complaints and 27 street lights out, with responses stretching near a month. If a block feels dark on your walk home, it probably stays that way for weeks.\n\nThe upside of deep winter: the street quiets to 185 incidents, the calmest stretch of your year and well under the citywide January average of 255. Rent holds at $1,420, and campus fills the calendar with free indoor talks and performances. It's the hardest month here — and the one that tells you the most.",
    dataSummary: { crime: 185, transitRiders: null, requests311: 372, avgRent: 1420, commuteMinutes: 12 },
    mapActions: [demoCommuteAction(1, 12), demoCrimeAction(1, 185, 255)],
  },
}

export function matchDemoQA(message: string, month: number): DemoQA | null {
  const lower = message.toLowerCase()
  return DEMO_QA.find((qa) => qa.month === month && qa.keywords.some((k) => lower.includes(k))) ?? null
}
