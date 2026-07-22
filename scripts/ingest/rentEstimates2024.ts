/**
 * Market rent estimates by community area number, 2024.
 * These are heuristics (seeded from the former lib/tools/query_housing.ts stubs),
 * NOT civic data — the affordable-housing dataset has no market rents. Areas
 * without an entry get null and the product surfaces "no rent estimate loaded".
 */

export const RENT_ESTIMATES_2024: Record<number, { avg: number; median: number }> = {
  3:  { avg: 1380, median: 1400 }, // Uptown
  6:  { avg: 1950, median: 1990 }, // Lake View
  7:  { avg: 2100, median: 2150 }, // Lincoln Park
  22: { avg: 1680, median: 1725 }, // Logan Square
  24: { avg: 1890, median: 1950 }, // West Town (Wicker Park)
  31: { avg: 1240, median: 1280 }, // Lower West Side (Pilsen)
  36: { avg: 831,  median: 875 },  // Oakland
  38: { avg: 1100, median: 1150 }, // Grand Boulevard (Bronzeville)
  41: { avg: 1420, median: 1450 }, // Hyde Park
  42: { avg: 890,  median: 925 },  // Woodlawn
  43: { avg: 980,  median: 1020 }, // South Shore
};
