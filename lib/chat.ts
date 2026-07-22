import Groq from 'groq-sdk'
import { TOOL_DEFINITIONS } from './tools/definitions'
import { executeToolCall } from './tools/executor'
import { buildMapActions } from './mapActions'
import type {
  ChatRequest,
  ChatResponse,
  CommuteResult,
  CrimeResult,
  DataSummary,
  HousingResult,
  MapAction,
  ServiceResult,
  ToolResult,
  TransitResult,
  UserProfile,
} from './tools/types'

export type { DataSummary }

export interface BriefRequest {
  neighborhood: string
  month: number
  year?: number
  profile: UserProfile
  prevMonthSummaries?: string[]
  actContext?: 'spring' | 'summer' | 'autumn' | 'winter'
}

const MODEL = 'llama-3.3-70b-versatile'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAYS_BY_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

const CRIME_NARRATIVE_RULES = `
Narrative output rules - crime responses:
- Use these rules whenever the user asks about crime, safety, danger, violence, theft, robbery, assault, battery, police activity, or how safe a neighborhood feels.
- Ground every claim in tool-returned data before narrating.
- Lead with the experiential signal: what walking these streets feels like this month.
- Anchor all magnitude language to a meaningful reference point from the tool data: a city average, comparable neighborhood, or tangible frequency such as reported incidents per day. If the tool did not return a citywide or peer-neighborhood baseline, do not invent one.
- Identify the dominant crime type only when it shapes daily life; name one pattern, not a list.
- End with a forward signal: what this means for how the user would actually live here, with something actionable or orienting rather than a verdict.
- Speak with calibrated confidence. State what the data shows directly.
- Never quote raw incident counts as standalone figures. Raw counts may appear only inside an anchored comparison or tangible frequency.
- Use "you'd notice", "you might", and "you'd feel" sparingly; at most one of these phrases per response.
- Never repeat the same point in different words. Each sentence must add a new dimension.
- Never invent user context absent from the profile, such as commute routes, workplace proximity, or habits.
- Never end on a restatement of the data.
- Never use meta-commentary such as "the data suggests" or "the specific types of incidents contribute to".
- Voice: a knowledgeable friend who has lived in Chicago for 20 years and will tell the truth. Not a real estate agent, not a police report, not a cautious LLM.
- Structure every crime response in this order: experiential signal; anchored magnitude; dominant pattern if relevant; forward signal.
- Maximum 4 sentences. Density over length.
`.trim()

const HOUSING_NARRATIVE_RULES = `
Narrative output rules - housing and affordability responses:
- Use these rules whenever the user asks about rent, budget, affordability, housing, apartments, or whether they can afford a neighborhood.
- Compare the user's budget to avg_rent_estimate or median_rent_estimate as a concrete gap. Do not say the budget "should cover a place" without naming the estimate.
- Treat affordable_units as recorded subsidized housing stock in the database, never as currently open apartments or user-accessible availability.
- Do not say "available", "variety of options", or "allocate the rest" from affordable-unit counts.
- Do not invent unrelated spending categories such as groceries, transportation, utilities, or savings unless the profile includes them.
- End with the practical housing-search implication: live listings, unit size, income restrictions, or vacancy checks.
- Maximum 4 sentences. Prose only.
`.trim()

const TRANSIT_COMMUTE_NARRATIVE_RULES = `
Narrative output rules - transit and commute responses:
- Use these rules whenever the user asks about commuting, routes, transit, buses, trains, CTA, L stops, or getting to work or school.
- Separate neighborhood transit access from door-to-door commute routing.
- Never say the user would "rely on the L" unless tool-returned stop data and rail ridership support it.
- Never claim "several L stops" or specific transfer choices unless the tool returned those stops or routes.
- Convert monthly ridership into a usable signal: crowding level, daily scale, wait estimate, or stop access. Do not quote monthly ridership as the main answer.
- If exact routing is unavailable, convey what you know about the commute in resident terms — approximate time, what the neighborhood transit access is like — without breaking persona with technical qualifiers like "coarse estimate" or "not a CTA itinerary".
- End with the practical next check: starting block, nearest stop, transfer burden, or direct bus/rail access.
- Maximum 4 sentences. Prose only.
`.trim()

const SERVICE_311_NARRATIVE_RULES = `
Narrative output rules - city services (311) responses:
- Use these rules whenever the user asks about 311, city services, potholes, repairs, streetlights, graffiti, maintenance, or how responsive the city is.
- Open with what waiting for city services actually feels like as a resident — not with raw request counts.
- Translate avg_response_days into a human timeline: "about a week", "two to three weeks", never quote the raw decimal.
- Anchor magnitude: faster or slower than the Chicago average is useful context when you can state it clearly.
- Name the dominant request type only if it meaningfully shapes the user's day-to-day experience.
- End with a practical implication: what the wait time means for planning, what to expect when something breaks.
- Maximum 4 sentences. Prose only.
`.trim()

const ENTERTAINMENT_NARRATIVE_RULES = `
Narrative output rules - entertainment, dining, and weekend activities responses:
- Use these rules whenever the user asks about restaurants, bars, food, nightlife, parks, things to do, or weekend activities.
- Never lead with raw venue counts. "161 restaurants" is not an answer — what you would actually do there is.
- Characterize the scene: the density and feel of the food and bar options, not just how many exist.
- If parks are named in the tool data, mention at least one by name with a seasonal note about what it is useful for this month.
- Weave in the season: what October (or whatever month) specifically changes about how you'd spend a weekend here.
- End with one concrete thing worth doing or checking out this month.
- Maximum 5 sentences. Prose only.
`.trim()

// Step 1: routing prompt — model's job is tool selection only, no narration yet
function buildRoutingPrompt(neighborhood: string, month: number): string {
  const monthName = MONTH_NAMES[month - 1] ?? 'this month'
  return `You are the LivingThere data routing agent. Call the most appropriate tool(s) to answer the user's question about ${neighborhood} in ${monthName}. For commute or route questions, call both query_commute and query_transit. Do not generate any response text — only call tools.`.trim()
}

// Step 2: narration prompt — model has tool results in context, now narrates
function buildNarrationPrompt(profile: UserProfile, neighborhood: string, month: number): string {
  const monthName = MONTH_NAMES[month - 1] ?? 'this month'
  const topPriority = Object.entries(profile.priorities)
    .sort((a, b) => b[1] - a[1])[0]?.[0]
    ?.replaceAll(/([A-Z])/g, ' $1')
    .toLowerCase() ?? 'quality of life'
  const lifestyleStr = profile.lifestyle.length > 0 ? profile.lifestyle.join(', ') : 'not specified'

  return `You are Sam, a long-time resident of ${neighborhood}. You've just pulled up real civic data for the neighborhood in ${monthName} — answer the user's question using only that data.

User profile:
- Monthly budget: ${profile.budgetRange}
- Workplace: ${profile.workplace}
- Commute preference: ${profile.commutePref}
- Top priority: ${topPriority}
- Lifestyle: ${lifestyleStr}
${profile.notes ? `- Context: ${profile.notes}` : ''}

PERSONA RULE (highest priority): You are Sam, a real resident. Never break character with any of these phrases: "the data", "tool-returned", "the database", "coarse estimate", "not a CTA itinerary", "does not return", "no stop list", "sparse results", "this estimate", "the tool", "according to". Speak from lived experience, not from a data report.

Rules:
- Speak as a local who knows this neighborhood personally. Use "around here", "on my end of the neighborhood", or "honestly" once per response at most — just enough warmth to feel human, not so much it becomes a character bit.
- Address the user in second person: "your commute", "your block", "you'd wait"
- Translate numbers into experience: incidents per month → how safe the walk home feels, rides per day → how crowded the bus feels
- Never lead with a raw number. Experience first, data as supporting detail
- Answer from this specific user's perspective — not generically about the neighborhood
- If a tool returned empty or sparse data, convey what you experientially know — never surface system limitations as prose
- For non-crime responses, use 3–5 sentences. Prose only. No bullet points.

${CRIME_NARRATIVE_RULES}

${HOUSING_NARRATIVE_RULES}

${TRANSIT_COMMUTE_NARRATIVE_RULES}

${SERVICE_311_NARRATIVE_RULES}

${ENTERTAINMENT_NARRATIVE_RULES}`.trim()
}

// Check whether the narrative response references at least one value from the tool results
function responseCitesData(text: string, results: ToolResult[]): boolean {
  const allNumbers = JSON.stringify(results).match(/\d+(\.\d+)?/g) ?? []
  const normalized = text.replaceAll(',', '')
  return allNumbers.slice(0, 30).some((n) => normalized.includes(n))
}

function sentenceCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString()}`
}

function parseBudgetAmount(range: string): number | null {
  const numbers = range.match(/\d[\d,]*/g)?.map((n) => Number(n.replaceAll(',', ''))) ?? []
  if (numbers.length === 0) return null
  if (/under/i.test(range)) return numbers[0]
  if (/\+/.test(range)) return numbers[0]
  return numbers[numbers.length - 1]
}

function isHousingResult(result: ToolResult): result is HousingResult {
  return 'affordable_units' in result && 'avg_rent_estimate' in result
}

function isTransitResult(result: ToolResult): result is TransitResult {
  return 'l_ridership' in result && 'bus_ridership' in result
}

function isCommuteResult(result: ToolResult): result is CommuteResult {
  return 'estimated_minutes' in result && 'estimates' in result
}

function isServiceResult(r: ToolResult): r is ServiceResult {
  return 'total_requests' in r && 'avg_response_days' in r
}

function describeBudgetFit(profile: UserProfile | undefined, rentEstimate: number): string {
  const budget = typeof profile?.monthlyBudget === "number" ? profile.monthlyBudget : profile ? parseBudgetAmount(profile.budgetRange) : null
  if (!budget) {
    return `The loaded rent estimate is ${formatMoney(rentEstimate)}/month, but your profile does not give a precise budget ceiling to compare against`
  }

  const gap = budget - rentEstimate
  const budgetLabel = typeof profile?.monthlyBudget === "number" ? formatMoney(profile.monthlyBudget) : profile?.budgetRange ?? formatMoney(budget)
  if (gap >= 0) {
    return `Against your ${budgetLabel} budget, the loaded rent estimate of ${formatMoney(rentEstimate)}/month leaves about ${formatMoney(gap)} of room before that budget mark`
  }
  return `Against your ${budgetLabel} budget, the loaded rent estimate of ${formatMoney(rentEstimate)}/month is about ${formatMoney(Math.abs(gap))} above that budget mark`
}

function crowdingPhrase(level: TransitResult['crowding_level']): string {
  if (level === 'very_high') return 'very crowded at peak times'
  if (level === 'high') return 'crowded at peak times'
  if (level === 'low') return 'light by CTA standards'
  return 'moderate, busy enough to plan around but not a red flag by itself'
}

function toolArgsFor(name: string, req: ChatRequest, args: Record<string, unknown> = {}): Record<string, unknown> {
  const next = { ...args }
  if (!next.neighborhood) next.neighborhood = req.neighborhood
  if (next.month === undefined) next.month = req.month
  if (next.year === undefined) next.year = req.year ?? 2024

  if (name === 'query_commute') {
    if (!next.workplace) next.workplace = req.profile.workplace
    if (!next.mode) next.mode = req.profile.commutePref
    if (next.workplaceLat === undefined && typeof req.profile.workplaceLat === 'number') {
      next.workplaceLat = req.profile.workplaceLat
    }
    if (next.workplaceLng === undefined && typeof req.profile.workplaceLng === 'number') {
      next.workplaceLng = req.profile.workplaceLng
    }
  }

  return next
}

function validationIssue(text: string, results: ToolResult[]): string | null {
  const lower = text.toLowerCase()
  const housing = results.some(isHousingResult)
  const transit = results.find(isTransitResult)
  const commute = results.some(isCommuteResult)

  if (housing) {
    if (/affordable.{0,80}available|available.{0,80}affordable/i.test(text)) {
      return 'Affordable-unit counts were described as availability. Say they are recorded subsidized housing stock, not open apartments.'
    }
    if (/variety of options|allocate the rest|other expenses|grocer|should cover a place|will cover a place/i.test(text)) {
      return 'The housing answer overstates certainty or adds generic budget filler. Compare the budget to the rent estimate and end with a search implication.'
    }
  }

  if (transit || commute) {
    const hasRailEvidence = Boolean(transit && transit.l_ridership > 0 && transit.stops.length > 0)
    if (!hasRailEvidence && /rely on (the )?['’]?l\b|several ['’]?l stops|l stops to choose|choose from/i.test(text)) {
      return 'The commute answer invented rail reliance or L-stop choice without returned stop data.'
    }
    if (/\d{1,3}(,\d{3})+\s+(riders|rides)\s+per\s+month|ridership\s+(is|of|adds)\s+(around\s+)?\d/i.test(text)) {
      return 'The transit answer quoted monthly ridership as the explanation. Translate it into crowding, wait, stop access, or commute orientation.'
    }
    if (/route that suits your needs|relatively short commute|convenient to get to/i.test(text)) {
      return 'The commute answer used generic route filler. State what is known and what exact routing still needs a route planner.'
    }
  }

  return null
}

function responseIssue(text: string, results: ToolResult[]): string | null {
  return validationIssue(text, results) ??
    (responseCitesData(text, results)
      ? null
      : 'The response did not include a specific tool-backed value. Ground it in one returned estimate, ratio, wait, distance, or count.')
}

// Template-based responses when Groq is unavailable — uses first tool result
function deterministicResponse(
  neighborhood: string,
  month: number,
  results: ToolResult[],
  profile?: UserProfile,
): string {
  const monthName = MONTH_NAMES[month - 1] ?? 'this month'

  if (results.length === 0) {
    return `I queried real data for ${neighborhood} in ${monthName} but did not receive results. This neighborhood may not have data loaded yet.`
  }

  const housing = results.find(isHousingResult)
  if (housing) {
    const rentEstimate = housing.median_rent_estimate ?? housing.avg_rent_estimate
    if (!rentEstimate || rentEstimate <= 0) {
      return `${neighborhood} has sparse loaded housing data: there is no usable rent estimate in the current records. The affordable-housing fields show ${housing.affordable_units} recorded subsidized units, which is database stock rather than a vacancy signal. For this neighborhood, affordability needs to be checked against live listings before treating it as a budget fit.`
    }

    const stockSentence = housing.affordable_units > 0
      ? `${neighborhood} also shows ${housing.affordable_units.toLocaleString()} recorded subsidized units${housing.affordable_developments > 0 ? ` across ${housing.affordable_developments} developments` : ''}, but that is database stock, not open apartments.`
      : `${neighborhood} does not show recorded subsidized housing stock in the loaded development data.`
    const forward = housing.affordable_units > 0
      ? 'Use that as a map of where subsidized housing exists, then check live listings, income rules, and unit size before counting it as a real option.'
      : 'Use live listings as the deciding source here, because the civic housing data is too thin to prove affordability on its own.'

    return `${describeBudgetFit(profile, rentEstimate)}. ${stockSentence} ${forward}`
  }

  const commute = results.find(isCommuteResult)
  const transit = results.find(isTransitResult)
  if (commute || transit) {
    const modeVerb = commute?.mode === 'driving' ? 'drive' : commute?.mode === 'biking' ? 'bike ride' : commute?.mode === 'walking' ? 'walk' : 'commute'

    const commuteSentence = commute && commute.estimated_minutes && commute.distance_miles !== null
      ? `Your ${modeVerb} from ${neighborhood} to ${commute.destination} runs about ${commute.estimated_minutes} minutes — roughly ${commute.distance_miles.toFixed(1)} miles.`
      : `A door-to-door time to your workplace isn't in the loaded data for ${neighborhood}, but the neighborhood transit picture gives you a starting point.`

    const accessSentence = transit
      ? transit.stops.length > 0
        ? `${neighborhood} transit is ${crowdingPhrase(transit.crowding_level)}, centered on ${transit.stops.slice(0, 2).join(' and ')}${transit.avg_peak_wait_minutes ? ` — about ${Math.round(transit.avg_peak_wait_minutes)} min between peak arrivals` : ''}.`
        : `Transit in ${neighborhood} runs ${crowdingPhrase(transit.crowding_level)} — useful as a signal for how crowded your bus or train will feel, though you'll want to verify the exact stop on a route planner.`
      : ''

    const forward = 'Check the exact starting block in Maps before relying on this for lease decisions — which side of the neighborhood you land on can shift the real commute time.'

    return `${commuteSentence}${accessSentence ? ' ' + accessSentence : ''} ${forward}`.trim()
  }

  const r = results[0]

  // Crime result
  if ('total' in r && 'by_type' in r && 'trend' in r) {
    const topType = Object.entries(r.by_type as Record<string, number>)
      .sort((a, b) => b[1] - a[1])[0]
    const days = DAYS_BY_MONTH[month - 1] ?? 30
    const dailyReports = (r.total as number) / days
    const dailyText = dailyReports >= 10 ? dailyReports.toFixed(0) : dailyReports.toFixed(1)
    const violentCount = r.violent_count as number
    const propertyCount = r.property_count as number
    const propertyRatio = violentCount > 0 ? propertyCount / violentCount : null
    const propertyAnchor = propertyRatio
      ? `property crime runs about ${propertyRatio.toFixed(1)}x the violent-crime volume`
      : 'property crime is the larger category'
    const topShare = topType && (r.total as number) > 0
      ? Math.round((topType[1] / (r.total as number)) * 100)
      : null
    const feel = r.total < 85
      ? 'relatively quiet'
      : r.total > 110
        ? 'a busier, more watchful stretch'
        : 'typical for an active urban neighborhood'
    const pattern = topType
      ? `${sentenceCase(topType[0])} is the pattern that shapes daily awareness, accounting for about ${topShare}% of reports`
      : 'property crime is the pattern that shapes daily awareness'
    const forward = r.total > 110
      ? 'Late-night routes deserve block-level judgment, especially away from busier corridors.'
      : r.total < 85
        ? 'For routine daytime errands and earlier evenings, safety is manageable without making it the organizing concern.'
        : 'Treat it like a normal city neighborhood: daytime movement is manageable, while late-night plans call for well-lit blocks and direct routes.'
    return `${neighborhood} in ${monthName} reads as ${feel}, not deserted but not chaotic. The month comes out to roughly ${dailyText} reported incidents a day, and ${propertyAnchor}. ${pattern}; ${monthName} is ${r.trend}. ${forward}`
  }

  // Transit result
  if ('l_ridership' in r && 'bus_ridership' in r) {
    const crowd = r.crowding_level === 'high' || r.crowding_level === 'very_high'
      ? "busy — plan for standing room during peak hours"
      : r.crowding_level === 'low'
        ? "light — you'll almost always get a seat"
        : "moderate — manageable most days"
    return `In ${neighborhood} in ${monthName}, your commute runs through ${(r.stops as string[]).slice(0, 2).join(' and ')}. Bus ridership is around ${(r.bus_ridership as number).toLocaleString()} rides that month — service is ${crowd}. L ridership adds ${(r.l_ridership as number).toLocaleString()} rail trips on top.`
  }

  // 311 result
  if ('total_requests' in r && 'avg_response_days' in r) {
    const avgDays = r.avg_response_days as number
    const roundedDays = Math.round(avgDays)
    const weekPhrase = roundedDays <= 5
      ? 'under a week'
      : roundedDays <= 10
        ? 'about one to two weeks'
        : `close to ${Math.round(roundedDays / 7)} weeks`
    const speedLabel = avgDays <= 4
      ? 'on the faster end for Chicago — city crews tend to close requests here without much delay'
      : avgDays >= 10
        ? 'on the slow side for Chicago — longer than what most neighborhoods see'
        : 'around the city average'
    return `When something breaks on your block in ${neighborhood} this ${monthName} — a pothole, a busted streetlight, an overgrown parkway — expect the city to take ${weekPhrase} to respond, ${speedLabel}. The neighborhood logged ${r.total_requests as number} service requests this month. Factor that timeline into anything that directly affects your daily routine rather than assuming a quick turnaround.`
  }

  // Housing result
  if ('affordable_units' in r && 'avg_rent_estimate' in r) {
    const rent = r.avg_rent_estimate as number | null
    if (rent === null || rent <= 0) {
      return `${neighborhood} shows ${r.affordable_units} affordable rental units in the development database, but no rent estimate is loaded for this area — check live listings for actual market rent before treating affordability as settled.`
    }
    return `${neighborhood} has ${r.affordable_units} affordable rental units in the development database. The estimated average rent is around $${rent.toLocaleString()}/month — ${rent <= 1200 ? 'well below the city median, which gives your budget real room to work with' : rent >= 1800 ? 'on the higher end for Chicago, so your budget may limit options to smaller units' : 'in the mid-range for Chicago'}.`
  }

  // Entertainment result
  if ('restaurants' in r && 'bars' in r) {
    const restaurants = r.restaurants as number
    const bars = r.bars as number
    const parks = r.parks as string[]
    const sceneStrength = restaurants > 100
      ? `a solid food-and-bar scene — enough variety that you could eat somewhere new every week without repeating`
      : restaurants > 40
        ? `a workable dining scene for regular neighborhood meals, with enough variety to stay interesting`
        : `a compact but functional food scene — a few reliable spots rather than overwhelming choice`
    const parkNote = parks.length > 0
      ? `${parks[0]} anchors the green space${month >= 10 || month <= 3 ? ', though it shifts to cold-weather use this time of year' : ' and is at its best right now'}.`
      : ''
    const seasonNote = month >= 5 && month <= 9
      ? `${monthName} is prime time — outdoor dining and the parks are at their peak.`
      : month === 10
        ? `October is when indoor spots carry the week; campus events fill out the calendar through the end of the month.`
        : `${monthName} skews toward indoor spots and weekend meals rather than parks and patios.`
    return `${neighborhood} has ${sceneStrength}${bars > 30 ? `, and a bar scene large enough to suit different nights out` : ''}. ${parkNote ? parkNote + ' ' : ''}${seasonNote} Worth pulling up the map view here to see what's actually closest to your block.`
  }

  // Neighborhood profile
  if ('summary' in r) {
    return `${(r as { summary: string }).summary}`
  }

  return `I retrieved data for ${neighborhood} in ${monthName}. Raw result: ${JSON.stringify(r).slice(0, 200)}`
}

// Simple keyword router for deterministic fallback and routing safety nets.
function inferToolsFromMessage(message: string): string[] {
  const m = message.toLowerCase()
  if (/crime|safe|danger|incident|police|assault|theft|violent/.test(m)) return ['query_crime']
  if (/commute|route|how (do|would|to) .*get|getting to|to uchicago|to university|to campus|workplace|school/.test(m)) {
    return ['query_commute', 'query_transit']
  }
  if (/transit|bus|train|cta|\bl\b|ride|crowded|stop|metra/.test(m)) return ['query_transit']
  if (/311|service|repair|pothole|streetlight|graffiti|maintenance|city (fix|respond)/.test(m)) return ['query_311']
  if (/rent|afford|housing|apartment|cost|budget|unit/.test(m)) return ['query_housing']
  if (/restaurant|bar|food|eat|drink|park|entertainment|weekend|nightlife|coffee|do here/.test(m)) return ['query_entertainment']
  return ['get_neighborhood_profile']
}

async function runDeterministic(req: ChatRequest, label: string): Promise<ChatResponse> {
  const { message, neighborhood, month } = req
  const year = req.year ?? 2024
  const toolNames = inferToolsFromMessage(message)
  const results: ToolResult[] = []

  for (const toolName of toolNames) {
    results.push(await executeToolCall(toolName, toolArgsFor(toolName, { ...req, year })))
  }

  const mapActions = await buildMapActions({ neighborhood, month, year, profile: req.profile }, toolNames, results)

  return {
    response: deterministicResponse(neighborhood, month, results, req.profile),
    toolsUsed: toolNames.map((toolName) => `${toolName} (${label})`),
    mapActions,
  }
}

function selectBriefTools(profile: UserProfile): string[] {
  const tools: string[] = ['query_crime']
  const { priorities, commutePref } = profile

  if (priorities.transit >= 3 || commutePref === 'transit') {
    tools.push('query_commute', 'query_transit')
  } else if (priorities.affordability >= 3) {
    tools.push('query_housing')
  } else if (priorities.entertainment >= 3) {
    tools.push('query_entertainment')
  } else {
    tools.push('query_commute', 'query_transit')
  }

  return tools
}

const SEASON_NOTES: Record<number, string> = {
  1: 'bitter cold, often below 20°F, windchill off the lake',
  2: 'still harsh, coldest stretch of the year',
  3: 'thawing slowly, muddy and unpredictable',
  4: 'warming up, blossoms starting, chilly evenings',
  5: 'pleasant, outdoor season beginning',
  6: 'warm and humid, long evenings',
  7: 'hot and humid, peak summer, street festivals',
  8: 'still hot, summer winding down',
  9: 'beautiful crisp fall weather',
  10: 'colorful fall, leaves turning, cool nights',
  11: 'cold setting in, darkness arriving early',
  12: 'cold, dark, often windy off the lake',
}

function buildBriefNarrationPrompt(profile: UserProfile, neighborhood: string, month: number, prevMonthSummaries?: string[]): string {
  const monthName = MONTH_NAMES[month - 1] ?? 'this month'
  const seasonNote = SEASON_NOTES[month] ?? ''
  const topPriority = Object.entries(profile.priorities)
    .sort((a, b) => b[1] - a[1])[0]?.[0]
    ?.replaceAll(/([A-Z])/g, ' $1')
    .toLowerCase() ?? 'quality of life'
  const lifestyleStr = profile.lifestyle.length > 0 ? profile.lifestyle.join(', ') : 'not specified'

  const memorySection = prevMonthSummaries && prevMonthSummaries.length > 0
    ? `\n\nPrevious months (brief recap, use for continuity):\n${prevMonthSummaries.map((s, i) => `- Month ${month - prevMonthSummaries.length + i}: ${s}`).join('\n')}\n\nIf something from a prior month is genuinely relevant to this month's data, weave in a natural callback. Do not force it.`
    : ''

  return `You are Sam, a long-time resident of ${neighborhood}. You have just pulled real civic data for ${monthName} and are opening the simulation for the first time — before the user has asked anything.

User profile:
- Monthly budget: ${profile.budgetRange}
- Workplace: ${profile.workplace}
- Commute preference: ${profile.commutePref}
- Top priority: ${topPriority}
- Lifestyle: ${lifestyleStr}
${profile.notes ? `- Context: ${profile.notes}` : ''}
- Season: ${seasonNote}
${memorySection}
Your job: Write one paragraph (4–5 sentences) that sets the tone for what ${monthName} in ${neighborhood} would feel like for this specific user. This is an unprompted opening — not an answer to a question. Lead with the most important signal for this user's profile. Synthesize 2–3 data signals into a coherent sense of what this month is like, not a list.

Rules:
PERSONA RULE (highest priority): You are Sam, a real resident. Never break character with any of these phrases: "the data", "tool-returned", "the database", "coarse estimate", "not a CTA itinerary", "does not return", "no stop list", "sparse results", "this estimate", "the tool". Speak from lived experience, not from data report language.
- Speak as a local. Use "around here" or "honestly" once at most.
- Address the user in second person: "your commute", "your block", "you'd wait"
- Translate numbers into experience. Never lead with a raw number.
- Never invent data. If information is limited, convey what you experientially know about this part of the city — never surface system limitations or data gaps as prose.
- Do not say "Welcome" or introduce yourself. Open mid-thought, as if continuing a conversation.
- 4–5 sentences max. Prose only. No bullet points.

${CRIME_NARRATIVE_RULES}

${TRANSIT_COMMUTE_NARRATIVE_RULES}

${HOUSING_NARRATIVE_RULES}`.trim()
}

export async function runBrief(req: BriefRequest): Promise<ChatResponse> {
  const { neighborhood, month, profile } = req
  const year = req.year ?? 2024
  const toolNames = selectBriefTools(profile)
  const results: ToolResult[] = []
  const toolsUsed: string[] = []

  for (const toolName of toolNames) {
    const args = toolArgsFor(toolName, { message: '', neighborhood, month, year, profile })
    results.push(await executeToolCall(toolName, args))
    toolsUsed.push(toolName)
  }

  if (!process.env.GROQ_API_KEY) {
    return {
      response: deterministicResponse(neighborhood, month, results, profile),
      toolsUsed: toolsUsed.map((t) => `${t} (deterministic)`),
    }
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const narrationPrompt = buildBriefNarrationPrompt(profile, neighborhood, month)

  const toolResultMessages: Groq.Chat.Completions.ChatCompletionMessageParam[] = results.map(
    (r, i) => ({
      role: 'tool' as const,
      tool_call_id: `brief-tool-${i}`,
      content: JSON.stringify(r),
    }),
  )

  // Fake assistant tool_calls message so tool results are valid in context
  const fakeToolCallsMsg: Groq.Chat.Completions.ChatCompletionMessageParam = {
    role: 'assistant',
    content: null,
    tool_calls: toolNames.map((name, i) => ({
      id: `brief-tool-${i}`,
      type: 'function' as const,
      function: {
        name,
        arguments: JSON.stringify(toolArgsFor(name, { message: '', neighborhood, month, year, profile })),
      },
    })),
  }

  try {
    const narrateCall = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      max_tokens: 300,
      messages: [
        { role: 'system', content: narrationPrompt },
        { role: 'user', content: `Open the ${MONTH_NAMES[month - 1] ?? 'monthly'} simulation for ${neighborhood}.` },
        fakeToolCallsMsg,
        ...toolResultMessages,
      ],
    })

    const response = narrateCall.choices[0]?.message?.content?.trim()
    if (!response) throw new Error('Groq returned empty brief')

    const issue = responseIssue(response, results)
    if (!issue) return { response, toolsUsed }

    const retryCall = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.1,
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: `${narrationPrompt}\n\nCRITICAL CORRECTION: ${issue} Rewrite so it is grounded, concrete, and within the domain-specific rules.`,
        },
        { role: 'user', content: `Open the ${MONTH_NAMES[month - 1] ?? 'monthly'} simulation for ${neighborhood}.` },
        fakeToolCallsMsg,
        ...toolResultMessages,
      ],
    })

    const retryResponse = retryCall.choices[0]?.message?.content?.trim()
    if (retryResponse && !responseIssue(retryResponse, results)) return { response: retryResponse, toolsUsed }

    return { response: deterministicResponse(neighborhood, month, results, profile), toolsUsed: toolsUsed.map((t) => `${t} (deterministic fallback)`) }
  } catch {
    return { response: deterministicResponse(neighborhood, month, results, profile), toolsUsed: toolsUsed.map((t) => `${t} (deterministic fallback)`) }
  }
}

const SEASONAL_CONTEXT: Record<string, string> = {
  spring: 'April in Chicago. Temperatures warming to 50–65°F. CTA delays easing after winter. Outdoor seating reopening.',
  summer: 'July in Chicago. Heat advisories common. Peak street festival season. Lakefront packed. CTA ridership high but frequent delays.',
  autumn: 'October in Chicago. Temperatures dropping fast. 311 requests climbing — potholes, tree debris. Last weeks of outdoor dining.',
  winter: 'January in Chicago. Wind chills below 0°F. Heating complaint calls at annual peak. CTA delays frequent. Streets icy.',
}

function buildSimNarrationPrompt(
  profile: UserProfile,
  neighborhood: string,
  month: number,
  rawResults: ToolResult[],
  prevMonthSummaries?: string[],
  actContext?: string,
): { system: string; user: string } {
  const monthName = MONTH_NAMES[month - 1] ?? 'this month'

  const crimeR = rawResults.find((r): r is CrimeResult => 'total' in r && 'by_type' in r)
  const transitR = rawResults.find(isTransitResult)
  const serviceR = rawResults.find(isServiceResult)
  const entertainmentR = rawResults.find((r) => 'places' in r && 'center' in r)
  const housingR = rawResults.find(isHousingResult)

  const prioritiesStr = Object.entries(profile.priorities)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k.replaceAll(/([A-Z])/g, ' $1').toLowerCase())
    .join(', ')

  const memorySection = prevMonthSummaries && prevMonthSummaries.length > 0
    ? `\n\nPrevious months (for continuity only — do not repeat):\n${prevMonthSummaries.map((s, i) => `- Month ${month - prevMonthSummaries.length + i}: ${s}`).join('\n')}`
    : ''

  const digest = [
    crimeR ? `Crime this month: ${crimeR.total} total incidents (${crimeR.violent_count ?? '?'} violent, ${crimeR.property_count ?? '?'} property). Trend: ${crimeR.trend ?? 'unknown'}.` : null,
    transitR ? `Transit this month: ${transitR.bus_ridership.toLocaleString()} bus riders, ${transitR.l_ridership.toLocaleString()} L riders. Crowding: ${transitR.crowding_level}. Avg peak wait: ${transitR.avg_peak_wait_minutes} min.` : null,
    serviceR ? `311 this month: ${serviceR.total_requests} service requests, avg ${serviceR.avg_response_days} days response.` : null,
    entertainmentR ? `Entertainment: ${(entertainmentR as Record<string, unknown>).total_places ?? '?'} places in the neighborhood this month.` : null,
  ].filter(Boolean).join('\n')

  const seasonalLine = actContext && SEASONAL_CONTEXT[actContext] ? `\n\nSeasonal context: ${SEASONAL_CONTEXT[actContext]}` : ''
  const system = `You are Sam, a neighborhood life advisor for Chicago. You speak in second person, present tense. You narrate what the user's daily life feels like this month, grounded entirely in the data provided. Never invent facts not in the data. If data is sparse, say so directly. Be specific, warm, and honest.${seasonalLine}`

  const user = `It is ${monthName} in ${neighborhood}.
The user's profile: budget $${profile.monthlyBudget ?? profile.budgetRange}/month, commute preference: ${profile.commutePref}, workplace: ${profile.workplace}, priorities: ${prioritiesStr}.${memorySection}

KEY FACTS FOR ${monthName.toUpperCase()} — YOU MUST USE THESE EXACT NUMBERS:
${digest || '(no data available this month)'}

Full data for context:
CRIME: ${JSON.stringify(crimeR ?? {})}
TRANSIT: ${JSON.stringify(transitR ?? {})}
311 SERVICES: ${JSON.stringify(serviceR ?? {})}
ENTERTAINMENT: ${JSON.stringify(entertainmentR ?? {})}
HOUSING: ${JSON.stringify(housingR ?? {})}

Write 3 paragraphs. Each paragraph MUST quote at least one specific number from KEY FACTS above. Do not use round or approximate numbers if the real number is available. Do not repeat the same statistic in two paragraphs. The numbers above are specific to ${monthName} — not a yearly average.

1. Morning and commute — what does getting to work feel like this month? Name the actual ridership or wait-time number.
2. Safety and street feel — what does the neighborhood feel like this month? Name the actual crime total.
3. Evening and weekend — what is there to do? Name the actual place count or 311 response time.

Do not mention housing costs unless this is January or 311 data shows housing-related service requests spiking this month.`

  return { system, user }
}

export async function runMonthFullStream(
  req: BriefRequest,
  onToolsDone: (payload: { mapActions: MapAction[]; toolsUsed: string[]; dataSummary: DataSummary }) => void,
  onChunk: (token: string) => void,
): Promise<ChatResponse> {
  const { neighborhood, month, profile, prevMonthSummaries, actContext } = req
  const year = req.year ?? 2024
  const toolNames = ['query_crime', 'query_transit', 'query_311', 'query_entertainment', 'query_commute', 'get_neighborhood_profile', 'query_housing']

  const settled = await Promise.allSettled(
    toolNames.map((name) =>
      executeToolCall(name, toolArgsFor(name, { message: '', neighborhood, month, year, profile })),
    ),
  )

  const toolsUsed: string[] = []
  const rawResults: ToolResult[] = []
  for (const [i, result] of settled.entries()) {
    if (result.status === 'fulfilled') {
      toolsUsed.push(toolNames[i]!)
      rawResults.push(result.value)
    }
  }

  console.log(`Month ${month} tool results:`, rawResults)

  const crimeR = rawResults.find((r): r is CrimeResult => 'total' in r && 'by_type' in r)
  const transitR = rawResults.find(isTransitResult)
  const serviceR = rawResults.find(isServiceResult)
  const housingR = rawResults.find(isHousingResult)
  const commuteR = rawResults.find(isCommuteResult)
  const dataSummary: DataSummary = {
    crime: crimeR?.total ?? null,
    transitRiders: transitR ? Math.round((transitR.bus_ridership + transitR.l_ridership) / 1000) : null,
    requests311: serviceR?.total_requests ?? null,
    avgRent: housingR?.avg_rent_estimate ?? null,
    commuteMinutes: commuteR?.estimated_minutes ?? null,
  }

  const mapActions = await buildMapActions({ neighborhood, month, year, profile }, toolsUsed, rawResults)
  onToolsDone({ mapActions, toolsUsed, dataSummary })

  if (!process.env.GROQ_API_KEY) {
    const fallback = deterministicResponse(neighborhood, month, rawResults, profile)
    onChunk(fallback)
    return { response: fallback, toolsUsed: toolsUsed.map((t) => `${t} (deterministic)`), mapActions }
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const { system: narrationSystem, user: narrationUser } = buildSimNarrationPrompt(profile, neighborhood, month, rawResults, prevMonthSummaries, actContext)

  try {
    const stream = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.35,
      max_tokens: 700,
      stream: true,
      messages: [
        { role: 'system', content: narrationSystem },
        { role: 'user', content: narrationUser },
      ],
    })

    let fullText = ''
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? ''
      if (token) {
        fullText += token
        onChunk(token)
      }
    }

    return { response: fullText, toolsUsed, mapActions }
  } catch {
    const fallback = deterministicResponse(neighborhood, month, rawResults, profile)
    onChunk(fallback)
    return { response: fallback, toolsUsed: toolsUsed.map((t) => `${t} (deterministic fallback)`), mapActions }
  }
}

export async function runMonthFull(req: BriefRequest): Promise<ChatResponse> {
  const { neighborhood, month, profile, prevMonthSummaries } = req
  const year = req.year ?? 2024
  const toolNames = ['query_crime', 'query_transit', 'query_entertainment', 'query_commute', 'get_neighborhood_profile', 'query_housing']

  const settled = await Promise.allSettled(
    toolNames.map((name) =>
      executeToolCall(name, toolArgsFor(name, { message: '', neighborhood, month, year, profile })),
    ),
  )

  const toolsUsed: string[] = []
  const rawResults: ToolResult[] = []
  for (const [i, result] of settled.entries()) {
    if (result.status === 'fulfilled') {
      toolsUsed.push(toolNames[i]!)
      rawResults.push(result.value)
    }
  }

  const mapActions = await buildMapActions({ neighborhood, month, year, profile }, toolsUsed, rawResults)
  const monthName = MONTH_NAMES[month - 1] ?? 'this month'

  if (!process.env.GROQ_API_KEY) {
    return {
      response: deterministicResponse(neighborhood, month, rawResults, profile),
      toolsUsed: toolsUsed.map((t) => `${t} (deterministic)`),
      mapActions,
    }
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const narrationPrompt = buildBriefNarrationPrompt(profile, neighborhood, month, prevMonthSummaries)

  const fakeToolCallsMsg: Groq.Chat.Completions.ChatCompletionMessageParam = {
    role: 'assistant',
    content: null,
    tool_calls: toolsUsed.map((name, i) => ({
      id: `month-tool-${i}`,
      type: 'function' as const,
      function: {
        name,
        arguments: JSON.stringify(toolArgsFor(name, { message: '', neighborhood, month, year, profile })),
      },
    })),
  }

  const toolResultMessages: Groq.Chat.Completions.ChatCompletionMessageParam[] = rawResults.map((r, i) => ({
    role: 'tool' as const,
    tool_call_id: `month-tool-${i}`,
    content: JSON.stringify(r),
  }))

  try {
    const call = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.35,
      max_tokens: 350,
      messages: [
        { role: 'system', content: narrationPrompt },
        {
          role: 'user',
          content: `Summarize what ${monthName} is like in ${neighborhood} for this person — cover the feel of the commute, how safe the streets read, and what there is to do here this month.`,
        },
        fakeToolCallsMsg,
        ...toolResultMessages,
      ],
    })

    const response = call.choices[0]?.message?.content?.trim()
    if (response) return { response, toolsUsed, mapActions }
  } catch {
    // fall through to deterministic
  }

  return {
    response: deterministicResponse(neighborhood, month, rawResults, profile),
    toolsUsed: toolsUsed.map((t) => `${t} (deterministic fallback)`),
    mapActions,
  }
}

export async function runChat(req: ChatRequest): Promise<ChatResponse> {
  const { message, neighborhood, month, year = 2024, profile, history = [] } = req
  const narrationPrompt = buildNarrationPrompt(profile, neighborhood, month)

  const conversationMessages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    ...history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user', content: message },
  ]

  // --- Deterministic path (no API key) ---
  if (!process.env.GROQ_API_KEY) {
    return runDeterministic({ ...req, year }, 'deterministic')
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  try {
    // --- Step 1: Route — force at least one tool call ---
    const routingCall = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0,
      max_tokens: 220,
      messages: [
        { role: 'system', content: buildRoutingPrompt(neighborhood, month) },
        ...conversationMessages,
      ],
      tools: TOOL_DEFINITIONS,
      tool_choice: 'required',
    })

    const assistantMsg = routingCall.choices[0]?.message
    if (!assistantMsg) throw new Error('Groq returned no message on routing call')

    const toolCalls = [...(assistantMsg.tool_calls ?? [])]

    // Safety net: if tool_choice: required somehow returned no calls, infer from message
    if (toolCalls.length === 0) {
      for (const [index, toolName] of inferToolsFromMessage(message).entries()) {
        toolCalls.push({
          id: `fallback-${index}`,
          type: 'function',
          function: { name: toolName, arguments: JSON.stringify(toolArgsFor(toolName, { ...req, year })) },
        })
      }
    } else {
      const inferredToolNames = inferToolsFromMessage(message)
      for (const toolName of inferredToolNames) {
        if (toolCalls.some((tc) => tc.function.name === toolName)) continue
        toolCalls.push({
          id: `fallback-${toolCalls.length}`,
          type: 'function',
          function: { name: toolName, arguments: JSON.stringify(toolArgsFor(toolName, { ...req, year })) },
        })
      }
    }
    const assistantWithToolCalls: Groq.Chat.Completions.ChatCompletionMessageParam = {
      ...assistantMsg,
      tool_calls: toolCalls,
    } as Groq.Chat.Completions.ChatCompletionMessageParam

    // --- Step 2: Execute every tool the model called ---
    const toolsUsed: string[] = []
    const toolResultMessages: Groq.Chat.Completions.ChatCompletionMessageParam[] = []
    const rawResults: ToolResult[] = []

    for (const tc of toolCalls) {
      const args = JSON.parse(tc.function.arguments) as Record<string, unknown>
      const toolArgs = toolArgsFor(tc.function.name, { ...req, year }, args)

      const result = await executeToolCall(tc.function.name, toolArgs)
      toolsUsed.push(tc.function.name)
      rawResults.push(result)
      toolResultMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      })
    }
    const mapActions = await buildMapActions({ neighborhood, month, year, profile }, toolsUsed, rawResults)

    // --- Step 3: Narrate from tool results ---
    const narrateCall = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      max_tokens: 300,
      messages: [
        { role: 'system', content: narrationPrompt },
        ...conversationMessages,
        assistantWithToolCalls,
        ...toolResultMessages,
      ],
    })

    const response = narrateCall.choices[0]?.message?.content?.trim()
    if (!response) throw new Error('Groq returned empty narrative')

    const issue = responseIssue(response, rawResults)
    if (!issue) {
      return { response, toolsUsed, mapActions }
    }

    // --- Step 4: Retry with explicit grounding instruction ---
    const retryCall = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.1,
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: `${narrationPrompt}\n\nCRITICAL CORRECTION: ${issue} Rewrite the answer so it is grounded, concrete, and within the domain-specific rules. For crime answers, raw incident counts must appear only as part of an anchored comparison or tangible frequency.`,
        },
        ...conversationMessages,
        assistantWithToolCalls,
        ...toolResultMessages,
      ],
    })

    const retryResponse = retryCall.choices[0]?.message?.content?.trim()
    if (retryResponse && !responseIssue(retryResponse, rawResults)) return { response: retryResponse, toolsUsed, mapActions }

    throw new Error('Grounding check failed after retry')
  } catch {
    // --- Fallback: deterministic response from keyword-routed tool ---
    return runDeterministic({ ...req, year }, 'deterministic fallback')
  }
}
