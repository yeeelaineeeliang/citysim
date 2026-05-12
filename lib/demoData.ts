import type { UserProfile } from './tools/types'

export const DEMO_PROFILE: UserProfile = {
  budgetRange: '$1,001–$1,500',
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

export const DEMO_BRIEF =
  "October in Hyde Park is one of the better months to land here — the crime picture is moderate, running around 88 reported incidents for the month, which works out to roughly 2.8 a day and puts this solidly in the quieter tier for a South Side neighborhood this active. Property crime is the dominant pattern rather than violent incidents, so the risk you'd actually manage day-to-day is keeping your bike locked and being alert around parked cars, not your personal safety on a walk home. Your commute to UChicago is essentially a short hop — the 6 Express runs directly along the corridor, and ridership in October runs moderate, so you'll see some crowding at 8 AM but nothing that makes you wait for a second bus. The lakefront is still in full use this time of year, 53rd Street is at its most walkable before the cold sets in, and the neighborhood genuinely rewards the kind of month where you explore on foot."

export interface DemoQA {
  month: number
  keywords: string[]
  answer: string
  toolsUsed: string[]
}

export const DEMO_QA: DemoQA[] = [
  // ── October ────────────────────────────────────────────────────────────────
  {
    month: 10,
    keywords: ['commute', 'morning', 'route', 'work', 'get to', 'getting to', 'transit', 'bus', 'train', 'cta'],
    answer:
      "Your commute from Hyde Park to UChicago in October is about as short as a transit commute in Chicago gets — the 6 Express runs directly along Stony Island, and most of campus is within a mile of the neighborhood core, so the trip rarely tops 15 minutes door to door. Bus ridership on the 6 and 192 combined runs around 18,000 rides in October, which means a crowded bus in the 8–9 AM window but nothing that would make you wait for a second one. The Red Line at 55th–56th–57th is your backup for longer trips and late nights, running moderate service — not the chaos of the North Side, but plan for standing room during the core 30-minute rush. If you're within six blocks of campus your actual best option may be walking, and it's worth mapping your exact block before assuming the bus is even necessary.",
    toolsUsed: ['query_commute', 'query_transit'],
  },
  {
    month: 10,
    keywords: ['safe', 'crime', 'safety', 'danger', 'incident', 'violent', 'police', 'theft', 'robbery'],
    answer:
      "Hyde Park in October runs about 88 reported incidents — roughly 2.8 a day — which puts it in the quieter tier for an urban neighborhood this close to downtown. Property crime is the dominant pattern, accounting for around 70% of reports, so the risk you'd actually manage day-to-day is keeping an eye on your bike lock and car, not personal safety on a daylight walk. The area around 53rd Street and the campus core stays well-lit and foot-trafficked well into the evening, which cuts the ambient risk further. Where you'd stay more alert is on blocks further east toward the lake after 10 PM — not alarming by any measure, but the usual city habits apply.",
    toolsUsed: ['query_crime'],
  },
  {
    month: 10,
    keywords: ['weekend', 'eat', 'restaurant', 'do here', 'food', 'bar', 'nightlife', 'outdoors', 'activities', 'park', 'fun'],
    answer:
      "Hyde Park has 94 restaurants and 12 bars in the community area, which sounds modest until you realize 53rd Street alone gives you a solid 45-minute walk of options — Medici, Valois, a handful of newer spots. October is the sweet spot for Promontory Point: the lakefront is still fully usable before the November cold cuts it, so Saturday mornings on the Point are genuinely one of the better free activities in Chicago. The Promontory bar hosts solid live music most weekends, and the Logan Center on campus runs free performances through the fall quarter. You won't find the density of a Wicker Park Friday, but this neighborhood rewards the kind of weekend where you walk somewhere rather than plan ahead.",
    toolsUsed: ['query_entertainment'],
  },
  {
    month: 10,
    keywords: ['afford', 'rent', 'housing', 'budget', 'apartment', 'cost', 'expensive', 'cheap'],
    answer:
      "The loaded rent estimate for Hyde Park in October sits at $1,310/month — about $190 below the top of your $1,001–$1,500 budget, which leaves real room to work with but not much cushion for a one-bedroom in a newer building. The neighborhood shows around 847 recorded affordable housing units in the development database — that's subsidized housing stock, not apartments you can call tomorrow, so don't treat that number as availability. For your actual search, blocks south of 55th Street tend to run lower than the 53rd Street corridor, and one-bedrooms in Hyde Park's older six-flats often come in below the neighborhood average. Live listings are the deciding source here; the civic data confirms the budget fit, not the specific vacancy.",
    toolsUsed: ['query_housing'],
  },
  {
    month: 10,
    keywords: ['311', 'city', 'service', 'repair', 'pothole', 'streetlight', 'maintenance', 'responsive', 'services'],
    answer:
      "Hyde Park in October logged 312 service requests through 311, with an average response time of 4.2 days — faster than the city-wide average of around five days, which means issues on your block tend to get resolved before the week is out. Tree trimming, street lighting, and rodent abatement make up the bulk of requests. The corridor along the lakefront tends to get quicker attention than blocks farther inland, likely because of foot traffic and proximity to park maintenance crews. If you file a request here, the city is responsive — it won't sit for two weeks the way it might in some other neighborhoods.",
    toolsUsed: ['query_311'],
  },

  // ── November ───────────────────────────────────────────────────────────────
  {
    month: 11,
    keywords: ['safe', 'crime', 'safety', 'november', 'danger', 'incident'],
    answer:
      "In October you saw about 88 incidents in Hyde Park — November comes in slightly lower, around 82, which is typical as outdoor activity drops and with it the opportunity for property crime on the street. The pattern doesn't shift much: property crime still drives roughly 68% of reports, and the biggest change is fewer bike thefts as cyclists put bikes away for winter. If anything, the narrowing daylight is your biggest behavioral shift — the walk back from the L at 55th after 5 PM is now in the dark, and it's worth knowing which blocks stay well-lit. No meaningful spike in violent crime through November historically; this stays in Hyde Park's quieter tier.",
    toolsUsed: ['query_crime'],
  },
  {
    month: 11,
    keywords: ['commute', 'cold', 'november', 'transit', 'bus', 'weather', 'morning', 'work'],
    answer:
      "Your October commute was largely walkable — November changes that math once the wind picks up off the lake, which it does reliably by mid-month. The 6 and 192 buses become the default even for a 10-minute walk, and ridership ticks up slightly as the neighborhood collectively abandons the outdoor option; expect the 8–9 AM buses to feel a bit more packed than October. The Red Line at 55th–56th–57th stays consistent through November — underground rail doesn't feel the cold the way surface routes do — so it's your more reliable option if the buses are running slow in the cold snap. Hyde Park's lake-adjacent blocks get wind-tunnel effect on east–west streets, so routing through 55th rather than 53rd can shave a minute of wind exposure on your way to the stop.",
    toolsUsed: ['query_commute', 'query_transit'],
  },
  {
    month: 11,
    keywords: ['weekend', 'indoor', 'november', 'restaurant', 'bar', 'do here', 'eat', 'activities'],
    answer:
      "Outdoor options contract in November but Hyde Park's indoor scene holds up well — the Promontory bar stays strong through the cold, and the Smart Museum and Oriental Institute on campus are genuinely excellent free options on a Sunday afternoon. 53rd Street restaurants see more traffic as people seek warmth, so weekends can have a wait at Medici and Valois by noon. The Hyde Park Art Center runs a fall show through mid-November worth a walk, and the Logan Center calendar stays full through the quarter. The neighborhood's character shifts more campus-oriented in winter — UChicago's schedule fills the week with talks and performances, most of them free and open to neighborhood residents.",
    toolsUsed: ['query_entertainment'],
  },

  // ── December ───────────────────────────────────────────────────────────────
  {
    month: 12,
    keywords: ['december', 'winter', 'holiday', 'park', 'cold', 'season', 'christmas', 'festive'],
    answer:
      "December in Hyde Park is quiet in the way that suits it — the campus slows between quarters, the lakefront is almost entirely yours on a weekday, and the 53rd Street strip has a low-key holiday feel without the State Street crowds. Promontory Point in December with no one else on it is one of Chicago's underrated free experiences, if you can handle the cold; the lake view on a clear day is worth the layers. The Museum of Science and Industry runs holiday exhibits that draw families from across the city, bumping foot traffic on the 55th corridor on weekends. Transit holds steady in December — the Red Line doesn't derail in cold the way surface routes can, so your commute access stays consistent even in sub-20 conditions.",
    toolsUsed: ['query_entertainment', 'query_transit'],
  },
  {
    month: 12,
    keywords: ['rent', 'afford', 'housing', 'december', 'apartment', 'budget', 'cost', 'expensive'],
    answer:
      "Housing estimates for Hyde Park in December track close to October — the loaded median sits around $1,295/month, still within your $1,001–$1,500 budget with roughly $205 of room. December is actually a reasonable time to search in Hyde Park because university-tied residents often move between quarters, creating unit turnover on a cycle most neighborhood renters don't know to watch for. The 847 recorded affordable units in the development database remain subsidized stock, not open listings — use that as a map of where affordable housing exists, then verify directly. One-bedrooms on the 56th–58th Street blocks, away from the higher-priced lakefront corridor, tend to run below the neighborhood average based on the loaded rent data.",
    toolsUsed: ['query_housing'],
  },
]

export function matchDemoQA(message: string, month: number): DemoQA | null {
  const lower = message.toLowerCase()
  return DEMO_QA.find((qa) => qa.month === month && qa.keywords.some((k) => lower.includes(k))) ?? null
}
