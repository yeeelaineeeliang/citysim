import assert from "node:assert/strict";
import test from "node:test";

import {
  fallbackNeighborhoodMatches,
  rankNeighborhoodMatches,
  type MatchUserProfile,
  type NeighborhoodData,
} from "./neighborhoodMatch";

const neighborhoods: NeighborhoodData[] = [
  {
    communityAreaNumber: 1,
    name: "Safety Harbor",
    slug: "safety-harbor",
    descriptors: ["Tree-lined"],
    scores: { crime: 8, transit: 45, housing: 45, cityServices: 80, entertainment: 30 },
    housing: { medianRent: 2200 },
    commute: { transitMinutes: 34 },
  },
  {
    communityAreaNumber: 2,
    name: "Transit Square",
    slug: "transit-square",
    descriptors: ["Blue Line"],
    scores: { crime: 42, transit: 96, housing: 55, cityServices: 70, entertainment: 82 },
    housing: { medianRent: 1650 },
    commute: { transitMinutes: 14 },
  },
  {
    communityAreaNumber: 3,
    name: "Budget Park",
    slug: "budget-park",
    descriptors: ["Affordable"],
    scores: { crime: 55, transit: 52, housing: 98, cityServices: 55, entertainment: 36 },
    housing: { medianRent: 925 },
    commute: { transitMinutes: 30 },
  },
  {
    communityAreaNumber: 4,
    name: "Night Market",
    slug: "night-market",
    descriptors: ["Restaurants"],
    scores: { crime: 62, transit: 72, housing: 36, cityServices: 58, entertainment: 98 },
    housing: { medianRent: 1950 },
    commute: { transitMinutes: 24 },
  },
  {
    communityAreaNumber: 5,
    name: "Civic Gardens",
    slug: "civic-gardens",
    descriptors: ["Parks"],
    scores: { crime: 35, transit: 50, housing: 62, cityServices: 98, entertainment: 50 },
    housing: { medianRent: 1450 },
    commute: { transitMinutes: 28 },
  },
  {
    communityAreaNumber: 6,
    name: "Middle Village",
    slug: "middle-village",
    descriptors: ["Balanced"],
    scores: { crime: 38, transit: 62, housing: 66, cityServices: 64, entertainment: 62 },
    housing: { medianRent: 1350 },
    commute: { transitMinutes: 26 },
  },
];

test("ranks transit-focused profiles toward transit-rich neighborhoods", () => {
  const profile: MatchUserProfile = {
    budget: 1800,
    commute_preference: "transit",
    priority_weights: {
      safety: 1,
      transit: 7,
      affordability: 2,
      city_services: 1,
      entertainment: 2,
    },
  };

  const [top] = rankNeighborhoodMatches(profile, neighborhoods);

  assert.equal(top.name, "Transit Square");
  assert.ok(top.descriptors.some((label) => /14 min commute/.test(label)));
  assert.match(top.matchReason, /14 min commute/i);
  assert.equal("fitScore" in top, false);
});

test("ranks safety-focused profiles toward lower-crime neighborhoods", () => {
  const profile: MatchUserProfile = {
    budgetRange: "$2,000+",
    commutePref: "driving",
    priorities: {
      safety: 0.75,
      transit: 0.05,
      affordability: 0.05,
      cityServices: 0.1,
      entertainment: 0.05,
    },
  };

  const [top] = rankNeighborhoodMatches(profile, neighborhoods);

  assert.equal(top.name, "Safety Harbor");
  assert.ok(top.descriptors.includes("Low crime rate"));
});

test("ranks affordability-focused profiles toward budget-fit neighborhoods", () => {
  const profile: MatchUserProfile = {
    budget: 1000,
    commute_preference: "transit",
    priority_weights: {
      safety: 1,
      transit: 1,
      affordability: 8,
      city_services: 1,
      entertainment: 1,
    },
  };

  const [top] = rankNeighborhoodMatches(profile, neighborhoods);

  assert.equal(top.name, "Budget Park");
  assert.ok(top.descriptors.some((label) => /fits your budget/i.test(label)));
  assert.match(top.matchReason, /est\. \$925\/mo/i);
});

test("returns only the requested number of public match fields", () => {
  const profile: MatchUserProfile = {
    budget: 1600,
    commute_preference: "transit",
    priority_weights: {
      safety: 1,
      transit: 1,
      affordability: 1,
      city_services: 1,
      entertainment: 1,
    },
  };

  const matches = rankNeighborhoodMatches(profile, neighborhoods, 5);

  assert.equal(matches.length, 5);
  for (const match of matches) {
    assert.deepEqual(Object.keys(match).sort(), [
      "communityAreaNumber",
      "descriptors",
      "matchReason",
      "name",
      "slug",
    ]);
    assert.ok(match.descriptors.length >= 1 && match.descriptors.length <= 3);
    assert.ok(match.matchReason.length > 0);
  }
});

test("fallback matching returns deploy-safe neighborhood results without Supabase", () => {
  const profile: MatchUserProfile = {
    budgetRange: "$1,000–$1,500",
    workplace: "University of Chicago",
    workplaceLat: 41.7886,
    workplaceLng: -87.5987,
    commutePref: "transit",
    priorities: {
      safety: 0.1,
      transit: 0.7,
      affordability: 0.05,
      cityServices: 0.05,
      entertainment: 0.1,
    },
    lifestyle: ["Short commute"],
    notes: "",
  };

  const matches = fallbackNeighborhoodMatches(profile, 5);

  assert.equal(matches.length, 5);
  assert.equal(matches[0].name, "Hyde Park");
  assert.ok(matches[0].descriptors.length > 0);
  assert.match(matches[0].matchReason, /min from University of Chicago/i);
});
