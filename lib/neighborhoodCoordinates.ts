/**
 * Hardcoded Street View coordinates for all 77 Chicago community areas.
 * Each pin points to a recognizable main-street corner in the neighborhood —
 * chosen for good Street View imagery rather than geometric centroid accuracy.
 *
 * Source: community area numbers per Chicago Data Portal (AREA_NUMBE).
 * Used by streetView.ts to generate cached Street View Static API URLs.
 * Hardcoded so it works in any runtime (Vercel, local) without CSV reads.
 */

export interface NeighborhoodCoordinate {
  communityAreaNumber: number
  name: string
  slug: string
  lat: number
  lng: number
}

export const NEIGHBORHOOD_COORDINATES: NeighborhoodCoordinate[] = [
  { communityAreaNumber: 1,  name: 'Rogers Park',         slug: 'rogers-park',         lat: 42.0183, lng: -87.6678 },
  { communityAreaNumber: 2,  name: 'West Ridge',          slug: 'west-ridge',          lat: 41.9985, lng: -87.6972 },
  { communityAreaNumber: 3,  name: 'Uptown',              slug: 'uptown',              lat: 41.9664, lng: -87.6544 },
  { communityAreaNumber: 4,  name: 'Lincoln Square',      slug: 'lincoln-square',      lat: 41.9689, lng: -87.6857 },
  { communityAreaNumber: 5,  name: 'North Center',        slug: 'north-center',        lat: 41.9542, lng: -87.6791 },
  { communityAreaNumber: 6,  name: 'Lake View',           slug: 'lake-view',           lat: 41.9396, lng: -87.6533 },
  { communityAreaNumber: 7,  name: 'Lincoln Park',        slug: 'lincoln-park',        lat: 41.9186, lng: -87.6364 },
  { communityAreaNumber: 8,  name: 'Near North Side',     slug: 'near-north-side',     lat: 41.8952, lng: -87.6241 },
  { communityAreaNumber: 9,  name: 'Edison Park',         slug: 'edison-park',         lat: 41.9883, lng: -87.8131 },
  { communityAreaNumber: 10, name: 'Norwood Park',        slug: 'norwood-park',        lat: 41.9874, lng: -87.8088 },
  { communityAreaNumber: 11, name: 'Jefferson Park',      slug: 'jefferson-park',      lat: 41.9696, lng: -87.7617 },
  { communityAreaNumber: 12, name: 'Forest Glen',         slug: 'forest-glen',         lat: 41.9856, lng: -87.7519 },
  { communityAreaNumber: 13, name: 'North Park',          slug: 'north-park',          lat: 41.9770, lng: -87.7276 },
  { communityAreaNumber: 14, name: 'Albany Park',         slug: 'albany-park',         lat: 41.9700, lng: -87.7120 },
  { communityAreaNumber: 15, name: 'Portage Park',        slug: 'portage-park',        lat: 41.9545, lng: -87.7648 },
  { communityAreaNumber: 16, name: 'Irving Park',         slug: 'irving-park',         lat: 41.9540, lng: -87.7399 },
  { communityAreaNumber: 17, name: 'Dunning',             slug: 'dunning',             lat: 41.9398, lng: -87.7939 },
  { communityAreaNumber: 18, name: 'Montclare',           slug: 'montclare',           lat: 41.9203, lng: -87.8023 },
  { communityAreaNumber: 19, name: 'Belmont Cragin',      slug: 'belmont-cragin',      lat: 41.9203, lng: -87.7457 },
  { communityAreaNumber: 20, name: 'Hermosa',             slug: 'hermosa',             lat: 41.9163, lng: -87.7278 },
  { communityAreaNumber: 21, name: 'Avondale',            slug: 'avondale',            lat: 41.9398, lng: -87.7120 },
  { communityAreaNumber: 22, name: 'Logan Square',        slug: 'logan-square',        lat: 41.9219, lng: -87.7038 },
  { communityAreaNumber: 23, name: 'Humboldt Park',       slug: 'humboldt-park',       lat: 41.8992, lng: -87.7253 },
  { communityAreaNumber: 24, name: 'West Town',           slug: 'west-town',           lat: 41.8960, lng: -87.6857 },
  { communityAreaNumber: 25, name: 'Austin',              slug: 'austin',              lat: 41.8952, lng: -87.7648 },
  { communityAreaNumber: 26, name: 'West Garfield Park',  slug: 'west-garfield-park',  lat: 41.8805, lng: -87.7253 },
  { communityAreaNumber: 27, name: 'East Garfield Park',  slug: 'east-garfield-park',  lat: 41.8805, lng: -87.7040 },
  { communityAreaNumber: 28, name: 'Near West Side',      slug: 'near-west-side',      lat: 41.8740, lng: -87.6676 },
  { communityAreaNumber: 29, name: 'North Lawndale',      slug: 'north-lawndale',      lat: 41.8553, lng: -87.7040 },
  { communityAreaNumber: 30, name: 'South Lawndale',      slug: 'south-lawndale',      lat: 41.8440, lng: -87.7253 },
  { communityAreaNumber: 31, name: 'Lower West Side',     slug: 'lower-west-side',     lat: 41.8553, lng: -87.6544 },
  { communityAreaNumber: 32, name: 'Loop',                slug: 'loop',                lat: 41.8819, lng: -87.6278 },
  { communityAreaNumber: 33, name: 'Near South Side',     slug: 'near-south-side',     lat: 41.8676, lng: -87.6278 },
  { communityAreaNumber: 34, name: 'Armour Square',       slug: 'armour-square',       lat: 41.8344, lng: -87.6313 },
  { communityAreaNumber: 35, name: 'Douglas',             slug: 'douglas',             lat: 41.8304, lng: -87.6150 },
  { communityAreaNumber: 36, name: 'Oakland',             slug: 'oakland',             lat: 41.8214, lng: -87.6099 },
  { communityAreaNumber: 37, name: 'Fuller Park',         slug: 'fuller-park',         lat: 41.8121, lng: -87.6313 },
  { communityAreaNumber: 38, name: 'Grand Boulevard',     slug: 'grand-boulevard',     lat: 41.8085, lng: -87.6150 },
  { communityAreaNumber: 39, name: 'Kenwood',             slug: 'kenwood',             lat: 41.8085, lng: -87.5988 },
  { communityAreaNumber: 40, name: 'Washington Park',     slug: 'washington-park',     lat: 41.7940, lng: -87.6150 },
  { communityAreaNumber: 41, name: 'Hyde Park',           slug: 'hyde-park',           lat: 41.7943, lng: -87.5918 },
  { communityAreaNumber: 42, name: 'Woodlawn',            slug: 'woodlawn',            lat: 41.7734, lng: -87.6051 },
  { communityAreaNumber: 43, name: 'South Shore',         slug: 'south-shore',         lat: 41.7620, lng: -87.5757 },
  { communityAreaNumber: 44, name: 'Chatham',             slug: 'chatham',             lat: 41.7494, lng: -87.6150 },
  { communityAreaNumber: 45, name: 'Avalon Park',         slug: 'avalon-park',         lat: 41.7424, lng: -87.5855 },
  { communityAreaNumber: 46, name: 'South Chicago',       slug: 'south-chicago',       lat: 41.7266, lng: -87.5527 },
  { communityAreaNumber: 47, name: 'Burnside',            slug: 'burnside',            lat: 41.7253, lng: -87.6051 },
  { communityAreaNumber: 48, name: 'Calumet Heights',     slug: 'calumet-heights',     lat: 41.7193, lng: -87.5757 },
  { communityAreaNumber: 49, name: 'Roseland',            slug: 'roseland',            lat: 41.6919, lng: -87.6213 },
  { communityAreaNumber: 50, name: 'Pullman',             slug: 'pullman',             lat: 41.6921, lng: -87.6051 },
  { communityAreaNumber: 51, name: 'South Deering',       slug: 'south-deering',       lat: 41.6842, lng: -87.5528 },
  { communityAreaNumber: 52, name: 'East Side',           slug: 'east-side',           lat: 41.7012, lng: -87.5282 },
  { communityAreaNumber: 53, name: 'West Pullman',        slug: 'west-pullman',        lat: 41.6757, lng: -87.6479 },
  { communityAreaNumber: 54, name: 'Riverdale',           slug: 'riverdale',           lat: 41.6428, lng: -87.6241 },
  { communityAreaNumber: 55, name: 'Hegewisch',           slug: 'hegewisch',           lat: 41.6563, lng: -87.5463 },
  { communityAreaNumber: 56, name: 'Garfield Ridge',      slug: 'garfield-ridge',      lat: 41.7950, lng: -87.7648 },
  { communityAreaNumber: 57, name: 'Archer Heights',      slug: 'archer-heights',      lat: 41.8121, lng: -87.7253 },
  { communityAreaNumber: 58, name: 'Brighton Park',       slug: 'brighton-park',       lat: 41.8085, lng: -87.6857 },
  { communityAreaNumber: 59, name: 'McKinley Park',       slug: 'mckinley-park',       lat: 41.8264, lng: -87.6857 },
  { communityAreaNumber: 60, name: 'Bridgeport',          slug: 'bridgeport',          lat: 41.8339, lng: -87.6479 },
  { communityAreaNumber: 61, name: 'New City',            slug: 'new-city',            lat: 41.8085, lng: -87.6544 },
  { communityAreaNumber: 62, name: 'West Elsdon',         slug: 'west-elsdon',         lat: 41.7950, lng: -87.7253 },
  { communityAreaNumber: 63, name: 'Gage Park',           slug: 'gage-park',           lat: 41.7950, lng: -87.7040 },
  { communityAreaNumber: 64, name: 'Clearing',            slug: 'clearing',            lat: 41.7800, lng: -87.7648 },
  { communityAreaNumber: 65, name: 'West Lawn',           slug: 'west-lawn',           lat: 41.7800, lng: -87.7253 },
  { communityAreaNumber: 66, name: 'Chicago Lawn',        slug: 'chicago-lawn',        lat: 41.7734, lng: -87.6857 },
  { communityAreaNumber: 67, name: 'West Englewood',      slug: 'west-englewood',      lat: 41.7770, lng: -87.6544 },
  { communityAreaNumber: 68, name: 'Englewood',           slug: 'englewood',           lat: 41.7770, lng: -87.6278 },
  { communityAreaNumber: 69, name: 'Greater Grand Crossing', slug: 'greater-grand-crossing', lat: 41.7620, lng: -87.6051 },
  { communityAreaNumber: 70, name: 'Ashburn',             slug: 'ashburn',             lat: 41.7494, lng: -87.7040 },
  { communityAreaNumber: 71, name: 'Auburn Gresham',      slug: 'auburn-gresham',      lat: 41.7440, lng: -87.6479 },
  { communityAreaNumber: 72, name: 'Beverly',             slug: 'beverly',             lat: 41.7193, lng: -87.6703 },
  { communityAreaNumber: 73, name: 'Washington Heights',  slug: 'washington-heights',  lat: 41.7051, lng: -87.6479 },
  { communityAreaNumber: 74, name: 'Mount Greenwood',     slug: 'mount-greenwood',     lat: 41.6919, lng: -87.7153 },
  { communityAreaNumber: 75, name: 'Morgan Park',         slug: 'morgan-park',         lat: 41.6919, lng: -87.6857 },
  { communityAreaNumber: 76, name: "O'Hare",              slug: 'ohare',               lat: 41.9796, lng: -87.9017 },
  { communityAreaNumber: 77, name: 'Edgewater',           slug: 'edgewater',           lat: 41.9820, lng: -87.6569 },
]

const _byNumber = new Map(NEIGHBORHOOD_COORDINATES.map((c) => [c.communityAreaNumber, c]))
const _bySlug   = new Map(NEIGHBORHOOD_COORDINATES.map((c) => [c.slug, c]))
const _byName   = new Map(NEIGHBORHOOD_COORDINATES.map((c) => [c.name.toLowerCase(), c]))

export function getCoordinateByNumber(n: number): NeighborhoodCoordinate | null {
  return _byNumber.get(n) ?? null
}

export function getCoordinateBySlug(slug: string): NeighborhoodCoordinate | null {
  return _bySlug.get(slug) ?? null
}

export function getCoordinateByName(name: string): NeighborhoodCoordinate | null {
  return _byName.get(name.toLowerCase().trim()) ?? null
}

/** All 77 entries, sorted by community area number. */
export function getAllCoordinates(): NeighborhoodCoordinate[] {
  return NEIGHBORHOOD_COORDINATES
}
