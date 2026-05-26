import type { DayEvent } from './dailySchedule'

interface FlavorCtx {
  event: DayEvent
  month: number
  neighborhood: string
  workplace?: string
}

function isWinter(m: number) { return m === 12 || m <= 2 }
function isSummer(m: number) { return m >= 6 && m <= 8 }
function isSpring(m: number) { return m >= 3 && m <= 5 }

const FLAVOR_MAP: Partial<Record<DayEvent['kind'], (ctx: FlavorCtx) => string>> = {
  home: ({ month, neighborhood }) => {
    if (isWinter(month)) return `You make coffee and watch frost build on the window. ${neighborhood} is quiet this early.`
    if (isSummer(month)) return `The morning is already warm before you open the door. A good Chicago summer day.`
    if (isSpring(month)) return `The neighborhood is greening up. You notice it every morning now.`
    return `The block is still in that golden-hour light. Good morning, ${neighborhood}.`
  },
  transit: ({ event, month }) => {
    if (event.activityLabel.toLowerCase().includes('bus') || event.activityLabel.toLowerCase().includes('transit')) {
      if (isWinter(month)) return `The shelter doesn't do much against the wind. Bus comes on time though.`
      if (isSummer(month)) return `The bus is already warm inside. You catch a seat near the window.`
      return `The ride is easy at this hour. You watch the neighborhood slide by.`
    }
    if (event.activityLabel.toLowerCase().includes('walk')) {
      if (isWinter(month)) return `The cold bites at your face but the sidewalks are clear. You walk fast.`
      if (isSummer(month)) return `A good morning to walk — warm but not yet humid.`
      return `Twenty minutes on foot. You've learned the shortcuts by now.`
    }
    if (event.activityLabel.toLowerCase().includes('bike')) {
      if (isWinter(month)) return `Cold fingers by the time you lock up. Worth it for the empty streets.`
      return `The route has become automatic. You barely think about it anymore.`
    }
    if (event.activityLabel.toLowerCase().includes('driv')) {
      if (isWinter(month)) return `Traffic is light in the snow. You leave ten minutes early just in case.`
      return `The drive takes less time than expected. Good light on the way.`
    }
    return `You make your way through the neighborhood. It's starting to feel like a pattern.`
  },
  work: ({ event, workplace, month }) => {
    if (event.timeLabel.includes('9:00') || event.timeLabel.includes('9 AM')) {
      if (isWinter(month)) return `The office is warmer than outside. You settle in with whatever you left open yesterday.`
      return `Morning at ${workplace ?? 'work'}. The day's shape is becoming clear.`
    }
    return `Back to it. The afternoon always goes faster than the morning.`
  },
  lunch: ({ event, neighborhood }) => {
    const place = event.activityLabel.replace(/^lunch at /i, '').replace(/^lunch$/i, '')
    if (place && place !== event.activityLabel) {
      return `${place} is a good call. The lunch crowd fills in fast — you're glad you came early.`
    }
    return `You step out into ${neighborhood} for the break. The midday feels different from the morning commute.`
  },
  park: ({ event, month, neighborhood }) => {
    const place = event.activityLabel.replace(/^(evening run|long run|afternoon|out) at /i, '').trim()
    if (isWinter(month)) return `${place ?? neighborhood} in winter — cold enough to keep the path to yourself. You like that.`
    if (isSummer(month)) return `${place ?? neighborhood} in the evening light. The whole city seems to have the same idea.`
    if (isSpring(month)) return `${place ?? neighborhood} finally feels like spring. You stay longer than planned.`
    return `The light is right at this hour. ${place ?? 'The park'} earns its place in your routine.`
  },
  errand: ({ neighborhood, month }) => {
    if (isWinter(month)) return `Quick errand — you don't linger in the cold. ${neighborhood} has what you need within a few blocks.`
    return `A short loop through the neighborhood. You're starting to know which spots are worth it.`
  },
  social: ({ event, month }) => {
    if (event.timeLabel === '9:30 PM') {
      // Monthly surprise — special moment
      return `One of those Chicago nights you'll remember. The neighborhood shows its character.`
    }
    const place = event.activityLabel.replace(/^dinner at /i, '')
    if (isWinter(month)) return `${place} is warm and full tonight. A good reason to be out in the cold.`
    if (isSummer(month)) return `You eat outside. The evening air is perfect — the kind of night that makes Chicago worth it.`
    return `Good dinner. The kind of evening that makes staying in the neighborhood feel right.`
  },
  night: ({ neighborhood, month }) => {
    if (isWinter(month)) return `Home for the night. The wind outside makes it easy to stay put.`
    if (isSummer(month)) return `The windows are open. ${neighborhood} at night has its own soundtrack.`
    return `You wind down. ${neighborhood} goes quiet around you.`
  },
}

export function getActivityFlavor(ctx: FlavorCtx): string {
  const fn = FLAVOR_MAP[ctx.event.kind]
  return fn ? fn(ctx) : `${ctx.event.activityLabel} in ${ctx.neighborhood}.`
}
