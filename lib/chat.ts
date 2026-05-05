import Groq from 'groq-sdk'
import { TOOL_DEFINITIONS } from './tools/definitions'
import { executeToolCall } from './tools/executor'
import type { ChatRequest, ChatResponse, ToolResult, UserProfile } from './tools/types'

const MODEL = 'llama-3.3-70b-versatile'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Step 1: routing prompt — model's job is tool selection only, no narration yet
function buildRoutingPrompt(neighborhood: string, month: number): string {
  const monthName = MONTH_NAMES[month - 1] ?? 'this month'
  return `You are the CityLiving Sim data routing agent. Call the most appropriate tool(s) to answer the user's question about ${neighborhood} in ${monthName}. Do not generate any response text — only call tools.`.trim()
}

// Step 2: narration prompt — model has tool results in context, now narrates
function buildNarrationPrompt(profile: UserProfile, neighborhood: string, month: number): string {
  const monthName = MONTH_NAMES[month - 1] ?? 'this month'
  const topPriority = Object.entries(profile.priorities)
    .sort((a, b) => b[1] - a[1])[0]?.[0]
    ?.replaceAll(/([A-Z])/g, ' $1')
    .toLowerCase() ?? 'quality of life'
  const lifestyleStr = profile.lifestyle.length > 0 ? profile.lifestyle.join(', ') : 'not specified'

  return `You are CityLiving Sim, a neighborhood advisor. You have just queried real civic data for ${neighborhood} in ${monthName} and have the results in this conversation. Answer the user's question using only that data.

User profile:
- Monthly budget: ${profile.budgetRange}
- Workplace: ${profile.workplace}
- Commute preference: ${profile.commutePref}
- Top priority: ${topPriority}
- Lifestyle: ${lifestyleStr}
${profile.notes ? `- Context: ${profile.notes}` : ''}

Rules:
- Write in second person: "your commute", "your block", "you'd wait"
- Translate numbers into experience: incidents per month → how safe the walk home feels, rides per day → how crowded the bus feels
- Never lead with a raw number. Experience first, data as supporting detail
- Answer from this specific user's perspective — not generically about the neighborhood
- If a tool returned empty or sparse data, say so explicitly rather than filling in
- 3–5 sentences. Prose only. No bullet points.`.trim()
}

// Check whether the narrative response references at least one value from the tool results
function responseCitesData(text: string, results: ToolResult[]): boolean {
  const allNumbers = JSON.stringify(results).match(/\d+(\.\d+)?/g) ?? []
  const normalized = text.replaceAll(',', '')
  return allNumbers.slice(0, 30).some((n) => normalized.includes(n))
}

// Template-based responses when Groq is unavailable — uses first tool result
function deterministicResponse(neighborhood: string, month: number, results: ToolResult[]): string {
  const monthName = MONTH_NAMES[month - 1] ?? 'this month'

  if (results.length === 0) {
    return `I queried real data for ${neighborhood} in ${monthName} but did not receive results. This neighborhood may not have data loaded yet.`
  }

  const r = results[0]

  // Crime result
  if ('total' in r && 'by_type' in r && 'trend' in r) {
    const topType = Object.entries(r.by_type as Record<string, number>)
      .sort((a, b) => b[1] - a[1])[0]
    const feel = r.total < 85
      ? 'relatively quiet — below average for comparable south-side neighborhoods'
      : r.total > 110
        ? 'busier than average, with the usual Chicago pattern of property crime leading violent crime by a wide margin'
        : 'typical for an active urban neighborhood'
    return `In ${neighborhood} in ${monthName}, your block saw ${r.total} reported incidents — ${topType ? `${topType[0]} led` : 'property crime led'} the count. The trend was ${r.trend}. Overall the picture is ${feel}.`
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
    const speed = (r.avg_response_days as number) <= 4
      ? 'faster than the city average — issues on your block tend to get resolved within a few days'
      : (r.avg_response_days as number) >= 6
        ? 'slower than average — expect to wait a week or more for routine repairs'
        : 'close to the city average of about five days'
    return `In ${neighborhood} in ${monthName}, the city handled ${r.total_requests} service requests. Average response time was ${r.avg_response_days} days — ${speed}.`
  }

  // Housing result
  if ('affordable_units' in r && 'avg_rent_estimate' in r) {
    return `${neighborhood} has ${r.affordable_units} affordable rental units in the development database. The estimated average rent is around $${(r.avg_rent_estimate as number).toLocaleString()}/month — ${(r.avg_rent_estimate as number) <= 1200 ? 'well below the city median, which gives your budget real room to work with' : (r.avg_rent_estimate as number) >= 1800 ? 'on the higher end for Chicago, so your budget may limit options to smaller units' : 'in the mid-range for Chicago'}.`
  }

  // Entertainment result
  if ('restaurants' in r && 'bars' in r) {
    const season = month >= 5 && month <= 9 ? 'peak season — outdoor dining and park use are at their best' : 'the slower season, but indoor spots are well-represented'
    return `${neighborhood} has ${r.restaurants} restaurants and ${r.bars} bars within the community area${(r.parks as string[]).length > 0 ? `, with green space at ${(r.parks as string[])[0]}` : ''}. ${monthName} is ${season}.`
  }

  // Neighborhood profile
  if ('summary' in r) {
    return `${(r as { summary: string }).summary}`
  }

  return `I retrieved data for ${neighborhood} in ${monthName}. Raw result: ${JSON.stringify(r).slice(0, 200)}`
}

// Simple keyword router for the deterministic fallback — picks the most relevant tool
function inferToolFromMessage(message: string): string {
  const m = message.toLowerCase()
  if (/crime|safe|danger|incident|police|assault|theft|violent/.test(m)) return 'query_crime'
  if (/transit|commute|bus|train|cta|\bl\b|ride|crowded|stop|metra/.test(m)) return 'query_transit'
  if (/311|service|repair|pothole|streetlight|graffiti|maintenance|city (fix|respond)/.test(m)) return 'query_311'
  if (/rent|afford|housing|apartment|cost|budget|unit/.test(m)) return 'query_housing'
  if (/restaurant|bar|food|eat|drink|park|entertainment|weekend|nightlife|coffee|do here/.test(m)) return 'query_entertainment'
  return 'get_neighborhood_profile'
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
    const toolName = inferToolFromMessage(message)
    const result = await executeToolCall(toolName, { neighborhood, month, year })
    return {
      response: deterministicResponse(neighborhood, month, [result]),
      toolsUsed: [`${toolName} (deterministic)`],
    }
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  try {
    // --- Step 1: Route — force at least one tool call ---
    const routingCall = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0,
      max_tokens: 150,
      messages: [
        { role: 'system', content: buildRoutingPrompt(neighborhood, month) },
        ...conversationMessages,
      ],
      tools: TOOL_DEFINITIONS,
      tool_choice: 'required',
    })

    const assistantMsg = routingCall.choices[0]?.message
    if (!assistantMsg) throw new Error('Groq returned no message on routing call')

    const toolCalls = assistantMsg.tool_calls ?? []

    // Safety net: if tool_choice: required somehow returned no calls, infer from message
    if (toolCalls.length === 0) {
      const toolName = inferToolFromMessage(message)
      toolCalls.push({
        id: 'fallback-0',
        type: 'function',
        function: { name: toolName, arguments: JSON.stringify({ neighborhood, month, year }) },
      })
    }

    // --- Step 2: Execute every tool the model called ---
    const toolsUsed: string[] = []
    const toolResultMessages: Groq.Chat.Completions.ChatCompletionMessageParam[] = []
    const rawResults: ToolResult[] = []

    for (const tc of toolCalls) {
      const args = JSON.parse(tc.function.arguments) as Record<string, unknown>
      if (!args.neighborhood) args.neighborhood = neighborhood
      if (args.month === undefined) args.month = month
      if (args.year === undefined) args.year = year

      const result = await executeToolCall(tc.function.name, args)
      toolsUsed.push(tc.function.name)
      rawResults.push(result)
      toolResultMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      })
    }

    // --- Step 3: Narrate from tool results ---
    const narrateCall = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      max_tokens: 300,
      messages: [
        { role: 'system', content: narrationPrompt },
        ...conversationMessages,
        assistantMsg as Groq.Chat.Completions.ChatCompletionMessageParam,
        ...toolResultMessages,
      ],
    })

    const response = narrateCall.choices[0]?.message?.content?.trim()
    if (!response) throw new Error('Groq returned empty narrative')

    if (responseCitesData(response, rawResults)) {
      return { response, toolsUsed }
    }

    // --- Step 4: Retry with explicit grounding instruction ---
    const retryCall = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.1,
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: narrationPrompt + '\n\nCRITICAL: You MUST cite at least one specific number from the tool data in your response. Do not give a generic answer.',
        },
        ...conversationMessages,
        assistantMsg as Groq.Chat.Completions.ChatCompletionMessageParam,
        ...toolResultMessages,
      ],
    })

    const retryResponse = retryCall.choices[0]?.message?.content?.trim()
    if (retryResponse) return { response: retryResponse, toolsUsed }

    throw new Error('Grounding check failed after retry')
  } catch {
    // --- Fallback: deterministic response from keyword-routed tool ---
    const toolName = inferToolFromMessage(message)
    const result = await executeToolCall(toolName, { neighborhood, month, year })
    return {
      response: deterministicResponse(neighborhood, month, [result]),
      toolsUsed: [`${toolName} (deterministic fallback)`],
    }
  }
}
