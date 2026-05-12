import assert from "node:assert/strict";
import test from "node:test";

import { validateOpeningBody } from "./apiSecurity";
import { deterministicOpeningMessage } from "./openingMessage";
import type { UserProfile } from "./tools/types";

const profile: UserProfile = {
  budgetRange: "$1,000-$1,500",
  workplace: "The University of Chicago",
  commutePref: "transit",
  priorities: {
    safety: 5,
    transit: 4,
    affordability: 3,
    cityServices: 2,
    entertainment: 4,
  },
  lifestyle: ["parks"],
  notes: "",
};

function sentenceCount(text: string) {
  return text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.length ?? 0;
}

test("opening fallback is short and avoids statistical language", () => {
  const response = deterministicOpeningMessage({
    neighborhood: "Hyde Park",
    month: 10,
    year: 2024,
    profile,
  });

  assert.ok(sentenceCount(response) <= 2);
  assert.doesNotMatch(response, /\d|crime|rate|transit|rent|estimate|incident|statistic|reported|ridership/i);
});

test("opening validation rejects invalid months", () => {
  const result = validateOpeningBody({
    neighborhood: "Hyde Park",
    month: 13,
    year: 2024,
    profile,
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /month must be an integer between 1 and 12/i);
});
