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

test("match reasons omit the higher-crime disclaimer hedge", () => {
  const profile: MatchUserProfile = {
    budget: 2600,
    commute_preference: "transit",
    priority_weights: {
      safety: 1,
      transit: 1,
      affordability: 1,
      city_services: 1,
      entertainment: 1,
    },
  };

  const matches = rankNeighborhoodMatches(profile, neighborhoods, 6);
  const higherCrimeMatch = matches.find((match) => match.name === "Civic Gardens");

  assert.ok(higherCrimeMatch);
  assert.doesNotMatch(higherCrimeMatch.matchReason, /check the data/i);
  assert.doesNotMatch(higherCrimeMatch.matchReason, /higher crime/i);
});

test("ranks Hyde Park top 3 for UChicago transit commuter with $2,000+ budget and default weights", () => {
  const uchicagoNeighborhoods: NeighborhoodData[] = [
    {
      communityAreaNumber: 41,
      name: "Hyde Park",
      slug: "hyde-park",
      descriptors: ["University village"],
      scores: { crime: 22, transit: 48, cityServices: 70, entertainment: 32 },
      housing: { medianRent: 1850 },
      commute: { transitMinutes: 4, drivingMinutes: 8, bikingMinutes: 6, walkingMinutes: 20 },
    },
    {
      communityAreaNumber: 32,
      name: "Loop",
      slug: "loop",
      descriptors: ["Downtown"],
      scores: { crime: 38, transit: 98, cityServices: 75, entertainment: 98 },
      housing: { medianRent: 2417 },
      commute: { transitMinutes: 48, drivingMinutes: 30, bikingMinutes: 50, walkingMinutes: 180 },
    },
    {
      communityAreaNumber: 54,
      name: "Riverdale",
      slug: "riverdale",
      descriptors: ["Far south"],
      scores: { crime: 95, transit: 18, cityServices: 45, entertainment: 12 },
      housing: { medianRent: 583 },
      commute: { transitMinutes: 80, drivingMinutes: 40, bikingMinutes: 84, walkingMinutes: 280 },
    },
    {
      communityAreaNumber: 8,
      name: "Near North Side",
      slug: "near-north-side",
      descriptors: ["Upscale"],
      scores: { crime: 28, transit: 85, cityServices: 72, entertainment: 92 },
      housing: { medianRent: 2800 },
      commute: { transitMinutes: 64, drivingMinutes: 38, bikingMinutes: 68, walkingMinutes: 240 },
    },
    {
      communityAreaNumber: 36,
      name: "Kenwood",
      slug: "kenwood",
      descriptors: ["Historic estates"],
      scores: { crime: 30, transit: 45, cityServices: 65, entertainment: 28 },
      housing: { medianRent: 1750 },
      commute: { transitMinutes: 8, drivingMinutes: 6, bikingMinutes: 8, walkingMinutes: 25 },
    },
    {
      communityAreaNumber: 34,
      name: "Armour Square",
      slug: "armour-square",
      descriptors: ["Historic"],
      scores: { crime: 55, transit: 60, cityServices: 55, entertainment: 45 },
      housing: { medianRent: 1200 },
      commute: { transitMinutes: 35, drivingMinutes: 20, bikingMinutes: 36, walkingMinutes: 120 },
    },
  ];

  const profile: MatchUserProfile = {
    budgetRange: "$2,000+",
    workplace: "University of Chicago",
    commutePref: "transit",
    priorities: {
      safety: 0.2,
      transit: 0.2,
      affordability: 0.2,
      cityServices: 0.2,
      entertainment: 0.2,
    },
    lifestyle: [],
    notes: "",
  } as MatchUserProfile;

  const matches = rankNeighborhoodMatches(profile, uchicagoNeighborhoods, 5);
  const top3Names = matches.slice(0, 3).map((m) => m.name);

  assert.ok(
    top3Names.includes("Hyde Park"),
    `Expected Hyde Park in top 3, got: ${top3Names.join(", ")}`,
  );
  assert.ok(
    !matches.some((m) => m.name === "Riverdale"),
    `Riverdale should not appear in top 5 for $2,000+ budget profiles`,
  );
  assert.ok(
    matches[0].name !== "Loop",
    `Loop should not be #1 for UChicago-anchored profiles, got: ${matches[0].name}`,
  );
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
