import type { UserProfile } from './tools/types'

export interface DayEvent {
  timeLabel: string
  activityLabel: string
  contextLabel: string
  location: { lat: number; lng: number }
  kind: 'home' | 'transit' | 'work' | 'lunch' | 'errand' | 'park' | 'social' | 'night'
  dwellTicks: number
}

// Deterministic pseudo-random offset in range [-scale, scale]
function seededOffset(seed: number, scale: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return ((x - Math.floor(x)) * 2 - 1) * scale
}

function nearbyPoint(
  base: { lat: number; lng: number },
  latSeed: number,
  lngSeed: number,
  scale: number,
): { lat: number; lng: number } {
  return {
    lat: base.lat + seededOffset(latSeed, scale),
    lng: base.lng + seededOffset(lngSeed, scale),
  }
}

function commuteModeLabel(mode: UserProfile['commutePref']): string {
  switch (mode) {
    case 'transit': return 'On the bus'
    case 'driving': return 'Driving in'
    case 'walking': return 'Walking to work'
    case 'biking': return 'Biking in'
  }
}

function eveningCommuteLabel(mode: UserProfile['commutePref']): string {
  if (mode === 'driving') return 'Driving home'
  if (mode === 'biking') return 'Biking home'
  if (mode === 'walking') return 'Walking home'
  return 'Heading home'
}

function isSummer(month: number): boolean {
  return month >= 6 && month <= 8
}

export function buildDailySchedule(
  profile: UserProfile,
  homeCoords: { lat: number; lng: number },
  workCoords: { lat: number; lng: number } | null,
  neighborhoodCenter: { lat: number; lng: number },
  parks: string[],
  month: number,
  neighborhoodName: string,
): DayEvent[] {
  const events: DayEvent[] = []
  const hasCar = profile.commutePref === 'driving'
  const parkName = parks[0] ?? `${neighborhoodName} Park`
  const hasFitness = profile.lifestyle.includes('fitness')

  // Deterministic nearby spots — vary by month so they shift each month
  const lunchSpot = nearbyPoint(neighborhoodCenter, month * 3 + 1, month * 7 + 2, 0.008)
  const errandSpot = nearbyPoint(neighborhoodCenter, month * 5 + 3, month * 2 + 8, 0.005)
  const dinnerSpot = nearbyPoint(neighborhoodCenter, month * 4 + 7, month * 11 + 1, 0.007)
  const parkSpot = nearbyPoint(neighborhoodCenter, month * 2 + 5, month * 6 + 3, 0.006)
  const busStop = nearbyPoint(homeCoords, month + 1, month + 2, 0.003)

  // 1 — Wake up at home
  events.push({
    timeLabel: '7:15 AM',
    activityLabel: 'Good morning',
    contextLabel: `${neighborhoodName} · Home`,
    location: homeCoords,
    kind: 'home',
    dwellTicks: 25,
  })

  if (workCoords) {
    // 2 — Walk to bus stop (skip for driving)
    if (!hasCar) {
      events.push({
        timeLabel: '8:05 AM',
        activityLabel: 'Walking to the bus stop',
        contextLabel: `${neighborhoodName} · Home block`,
        location: busStop,
        kind: 'transit',
        dwellTicks: 8,
      })
    }

    // 3 — Commute arrival marker (0 dwell; label shown during the transit leg)
    events.push({
      timeLabel: '8:20 AM',
      activityLabel: commuteModeLabel(profile.commutePref),
      contextLabel: `Morning commute · ${profile.workplace}`,
      location: workCoords,
      kind: 'transit',
      dwellTicks: 0,
    })

    // 4 — At work
    events.push({
      timeLabel: '9:00 AM',
      activityLabel: 'At work',
      contextLabel: `${profile.workplace}`,
      location: workCoords,
      kind: 'work',
      dwellTicks: 45,
    })

    // 5 — Lunch
    events.push({
      timeLabel: '12:30 PM',
      activityLabel: 'Lunch break',
      contextLabel: `Near ${neighborhoodName}`,
      location: lunchSpot,
      kind: 'lunch',
      dwellTicks: 30,
    })

    // 6 — Back at work
    events.push({
      timeLabel: '1:15 PM',
      activityLabel: 'Back at work',
      contextLabel: `${profile.workplace}`,
      location: workCoords,
      kind: 'work',
      dwellTicks: 30,
    })

    // 7 — Evening commute arrival marker (0 dwell; label shown during the return leg)
    events.push({
      timeLabel: '5:15 PM',
      activityLabel: eveningCommuteLabel(profile.commutePref),
      contextLabel: `Evening commute · ${neighborhoodName}`,
      location: homeCoords,
      kind: 'transit',
      dwellTicks: 0,
    })
  }

  // 8 — Evening activity (varies by season and lifestyle)
  if (isSummer(month) || hasFitness) {
    events.push({
      timeLabel: '6:00 PM',
      activityLabel: hasFitness ? 'Evening run' : 'Out in the park',
      contextLabel: parkName,
      location: parkSpot,
      kind: 'park',
      dwellTicks: 25,
    })
  } else {
    events.push({
      timeLabel: '6:00 PM',
      activityLabel: 'Quick errand',
      contextLabel: `${neighborhoodName}`,
      location: errandSpot,
      kind: 'errand',
      dwellTicks: 20,
    })
  }

  // 9 — Dinner out
  events.push({
    timeLabel: '7:30 PM',
    activityLabel: 'Dinner out',
    contextLabel: `${neighborhoodName} · Restaurant`,
    location: dinnerSpot,
    kind: 'social',
    dwellTicks: 20,
  })

  // 10 — Home for the night
  events.push({
    timeLabel: '10:30 PM',
    activityLabel: 'Home for the night',
    contextLabel: `${neighborhoodName} · Winding down`,
    location: homeCoords,
    kind: 'night',
    dwellTicks: 20,
  })

  return events
}
