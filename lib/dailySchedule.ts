import type { EntertainmentPlace, UserProfile } from './tools/types'

const MONTHLY_SURPRISE: Record<number, string> = {
  1:  "Polar vortex — stayed in tonight",
  2:  "Valentine's dinner out",
  3:  "St. Patrick's Day — Chicago River dyed green",
  4:  "Cherry blossoms spotted near the lakefront",
  5:  "First farmers market of the season",
  6:  "Juneteenth festival on the lakefront",
  7:  "Fourth of July fireworks at Navy Pier",
  8:  "Lollapalooza weekend in the city",
  9:  "Chicago Jazz Fest at Millennium Park",
  10: "Halloween block party on 53rd Street",
  11: "First real snowfall of the season",
  12: "Ice skating at Millennium Park",
}

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
  namedPlaces?: EntertainmentPlace[],
): DayEvent[] {
  const events: DayEvent[] = []
  const hasCar = profile.commutePref === 'driving'
  const hasFitness = profile.lifestyle.includes('fitness')

  // Named places from local data — fall back to deterministic offsets
  const foodPlaces = namedPlaces?.filter(p => p.category === 'food') ?? []
  const parkPlaces = namedPlaces?.filter(p => p.category === 'park') ?? []
  const lunchNamedPlace = foodPlaces.length > 0 ? foodPlaces[month % foodPlaces.length] : null
  const dinnerNamedPlace = foodPlaces.length > 0 ? foodPlaces[(month * 3 + 1) % foodPlaces.length] : null
  const parkNamedPlace = parkPlaces[0] ?? null

  const parkName = parkNamedPlace?.name ?? parks[0] ?? `${neighborhoodName} Park`

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
      activityLabel: lunchNamedPlace ? `Lunch at ${lunchNamedPlace.name}` : 'Lunch break',
      contextLabel: lunchNamedPlace ? `${neighborhoodName} · ${lunchNamedPlace.name}` : `Near ${neighborhoodName}`,
      location: lunchNamedPlace ? { lat: lunchNamedPlace.lat, lng: lunchNamedPlace.lng } : lunchSpot,
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
      activityLabel: hasFitness ? `Evening run at ${parkName}` : `Out in ${parkName}`,
      contextLabel: parkName,
      location: parkNamedPlace ? { lat: parkNamedPlace.lat, lng: parkNamedPlace.lng } : parkSpot,
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
    activityLabel: dinnerNamedPlace ? `Dinner at ${dinnerNamedPlace.name}` : 'Dinner out',
    contextLabel: dinnerNamedPlace ? `${neighborhoodName} · ${dinnerNamedPlace.name}` : `${neighborhoodName} · Restaurant`,
    location: dinnerNamedPlace ? { lat: dinnerNamedPlace.lat, lng: dinnerNamedPlace.lng } : dinnerSpot,
    kind: 'social',
    dwellTicks: 20,
  })

  // 10 — Monthly surprise (one Chicago event per month)
  const surpriseLabel = MONTHLY_SURPRISE[month]
  if (surpriseLabel) {
    events.push({
      timeLabel: '9:30 PM',
      activityLabel: surpriseLabel,
      contextLabel: 'Chicago · Monthly',
      location: nearbyPoint(neighborhoodCenter, month * 13 + 6, month * 7 + 4, 0.012),
      kind: 'social',
      dwellTicks: 18,
    })
  }

  // 11 — Home for the night
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

function buildWeekendSchedule(
  profile: UserProfile,
  homeCoords: { lat: number; lng: number },
  neighborhoodCenter: { lat: number; lng: number },
  parks: string[],
  month: number,
  neighborhoodName: string,
  namedPlaces?: EntertainmentPlace[],
): DayEvent[] {
  const hasFitness = profile.lifestyle.includes('fitness')

  const foodPlaces = namedPlaces?.filter(p => p.category === 'food') ?? []
  const parkPlaces = namedPlaces?.filter(p => p.category === 'park') ?? []
  const brunchNamedPlace = foodPlaces.length > 0 ? foodPlaces[(month * 2) % foodPlaces.length] : null
  const dinnerNamedPlace = foodPlaces.length > 0 ? foodPlaces[(month * 4 + 2) % foodPlaces.length] : null
  const parkNamedPlace = parkPlaces[0] ?? null
  const parkName = parkNamedPlace?.name ?? parks[0] ?? `${neighborhoodName} Park`

  // Weekend spots use different seeds from weekday to produce different locations
  const brunchSpot    = nearbyPoint(neighborhoodCenter, month * 4 + 9,  month * 8 + 3,  0.009)
  const afternoonSpot = nearbyPoint(neighborhoodCenter, month * 6 + 2,  month * 3 + 7,  0.007)
  const eveningSpot   = nearbyPoint(neighborhoodCenter, month * 9 + 5,  month * 5 + 4,  0.008)
  const parkSpot      = nearbyPoint(neighborhoodCenter, month * 2 + 5,  month * 6 + 3,  0.006)

  return [
    {
      timeLabel: '9:00 AM',
      activityLabel: 'Slow morning',
      contextLabel: `${neighborhoodName} · Home`,
      location: homeCoords,
      kind: 'home',
      dwellTicks: 35,
    },
    {
      timeLabel: '10:30 AM',
      activityLabel: 'Morning coffee',
      contextLabel: `${neighborhoodName}`,
      location: brunchSpot,
      kind: 'errand',
      dwellTicks: 20,
    },
    {
      timeLabel: '12:00 PM',
      activityLabel: brunchNamedPlace ? `Brunch at ${brunchNamedPlace.name}` : 'Brunch out',
      contextLabel: brunchNamedPlace ? `${neighborhoodName} · ${brunchNamedPlace.name}` : `${neighborhoodName} · Brunch`,
      location: brunchNamedPlace ? { lat: brunchNamedPlace.lat, lng: brunchNamedPlace.lng } : afternoonSpot,
      kind: 'lunch',
      dwellTicks: 30,
    },
    {
      timeLabel: '2:30 PM',
      activityLabel: hasFitness ? `Long run at ${parkName}` : `Afternoon at ${parkName}`,
      contextLabel: parkName,
      location: parkNamedPlace ? { lat: parkNamedPlace.lat, lng: parkNamedPlace.lng } : parkSpot,
      kind: 'park',
      dwellTicks: 40,
    },
    {
      timeLabel: '7:00 PM',
      activityLabel: dinnerNamedPlace ? `Dinner at ${dinnerNamedPlace.name}` : 'Dinner out',
      contextLabel: dinnerNamedPlace ? `${neighborhoodName} · ${dinnerNamedPlace.name}` : `${neighborhoodName} · Restaurant`,
      location: dinnerNamedPlace ? { lat: dinnerNamedPlace.lat, lng: dinnerNamedPlace.lng } : eveningSpot,
      kind: 'social',
      dwellTicks: 25,
    },
    {
      timeLabel: '10:00 PM',
      activityLabel: 'Home for the night',
      contextLabel: `${neighborhoodName} · Winding down`,
      location: homeCoords,
      kind: 'night',
      dwellTicks: 20,
    },
  ]
}

export function buildWeekSchedule(
  profile: UserProfile,
  homeCoords: { lat: number; lng: number },
  workCoords: { lat: number; lng: number } | null,
  neighborhoodCenter: { lat: number; lng: number },
  parks: string[],
  month: number,
  neighborhoodName: string,
  namedPlaces?: EntertainmentPlace[],
): DayEvent[] {
  return [
    ...buildDailySchedule(profile, homeCoords, workCoords, neighborhoodCenter, parks, month, neighborhoodName, namedPlaces),
    ...buildWeekendSchedule(profile, homeCoords, neighborhoodCenter, parks, month, neighborhoodName, namedPlaces),
  ]
}
