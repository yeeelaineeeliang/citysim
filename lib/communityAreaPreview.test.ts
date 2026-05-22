import assert from "node:assert/strict";
import test from "node:test";

import { buildCommunityAreaPreview, type CommunityAreaPreviewInput } from "./communityAreaPreview";

const baseInput: CommunityAreaPreviewInput = {
  neighborhood: "Hyde Park",
  workplace: "The University of Chicago, Chicago",
  workplaceLat: 41.7886,
  workplaceLng: -87.5987,
  commutePref: "transit",
  budgetRange: "$2,000+",
  month: 10,
  year: 2024,
};

test("community area preview creates a UChicago commute label", () => {
  const preview = buildCommunityAreaPreview(baseInput, {
    descriptors: ["Lakefront", "University town"],
  });

  assert.match(preview.commute.label, /~\d+ min by transit to UChicago/i);
  assert.match(preview.fitLine, /UChicago/i);
});

test("long UChicago commute returns a caution commute tone", () => {
  const preview = buildCommunityAreaPreview({
    ...baseInput,
    neighborhood: "Logan Square",
    priorities: {
      safety: 0.1,
      transit: 0.6,
      affordability: 0.1,
      cityServices: 0.1,
      entertainment: 0.1,
    },
  });

  assert.equal(preview.commute.tone, "caution");
  assert.match(preview.commute.label, /long commute/i);
  assert.match(preview.verdict.label, /commute/i);
});

test("$2,000+ budget does not invent rent fit when rent data is missing", () => {
  const preview = buildCommunityAreaPreview(baseInput, {
    descriptors: ["Lakefront", "University town"],
    rentEstimate: null,
  });

  assert.equal(preview.budget.label, "Rent data not loaded yet");
  assert.equal(preview.budget.tone, "unknown");
  assert.doesNotMatch(preview.budget.label, /fits|under/i);
});

test("missing rent and safety metrics use honest unavailable labels", () => {
  const preview = buildCommunityAreaPreview({
    ...baseInput,
    neighborhood: "Near West Side",
    workplaceLat: undefined,
    workplaceLng: undefined,
  });

  assert.equal(preview.budget.label, "Rent data not loaded yet");
  assert.equal(preview.safety.label, "Safety data not loaded yet");
  assert.equal(preview.safety.tone, "unknown");
});

test("safety label includes city comparison when available", () => {
  const preview = buildCommunityAreaPreview(baseInput, {
    crimeIncidentCount: 398,
    cityCrimeAverage: 210,
  });

  assert.match(preview.safety.label, /398 in Oct; above city avg 210/);
  assert.equal(preview.safety.tone, "caution");
});

test("preview ranking degrades gracefully with coordinate-only comparison", () => {
  const preview = buildCommunityAreaPreview(baseInput);

  assert.equal(preview.rank.overall.rank, null);
  assert.equal(preview.rank.overall.tone, "unknown");
  assert.ok(preview.rank.commute.rank);
  assert.match(preview.rank.commute.label, /of 77/);
});
