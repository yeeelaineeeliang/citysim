import assert from "node:assert/strict";
import test from "node:test";

import {
  apiAuthResult,
  checkRateLimit,
  rateLimitRequest,
  resetRateLimitsForTests,
  validateChatBody,
  validateMatchBody,
} from "./apiSecurity";
import type { UserProfile } from "./tools/types";

const profile: UserProfile = {
  budgetRange: "$1,000-$1,500",
  workplace: "The University of Chicago",
  workplaceLat: 41.7886,
  workplaceLng: -87.5987,
  commutePref: "transit",
  priorities: {
    safety: 0.25,
    transit: 0.35,
    affordability: 0.25,
    cityServices: 0.05,
    entertainment: 0.1,
  },
  lifestyle: ["Short commute"],
  notes: "Near the Red Line",
};

test("API auth helper rejects missing users", () => {
  const result = apiAuthResult(null);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.response.status, 401);
});

test("API auth helper accepts authenticated users", () => {
  const result = apiAuthResult("user_123");

  assert.deepEqual(result, { ok: true, userId: "user_123" });
});

test("chat validation rejects oversized user messages before LLM calls", () => {
  const result = validateChatBody({
    message: "x".repeat(1001),
    neighborhood: "Hyde Park",
    month: 10,
    year: 2024,
    profile,
    history: [],
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /message must be 1000 characters or fewer/i);
});

test("chat validation accepts bounded authenticated payload shape", () => {
  const result = validateChatBody({
    message: "What is crime like here?",
    neighborhood: "Hyde Park",
    month: 10,
    year: 2024,
    profile,
    history: [{ role: "assistant", content: "Earlier context" }],
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.message, "What is crime like here?");
    assert.equal(result.value.history.length, 1);
    assert.equal(result.value.profile.workplaceLat, 41.7886);
  }
});

test("match validation caps topN to the public top five workflow", () => {
  const result = validateMatchBody({ profile, topN: 99 });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /topN must be an integer between 1 and 5/i);
});

test("rate limiter blocks requests over the policy threshold", () => {
  resetRateLimitsForTests();
  const policy = { name: "test", max: 2, windowMs: 60_000 };

  assert.deepEqual(checkRateLimit("user:test", policy, 1000), { allowed: true });
  assert.deepEqual(checkRateLimit("user:test", policy, 1001), { allowed: true });

  const blocked = checkRateLimit("user:test", policy, 1002);
  assert.equal(blocked.allowed, false);
  if (!blocked.allowed) assert.equal(blocked.retryAfterSeconds, 60);
});

test("request rate limiter enforces both user and IP buckets", () => {
  resetRateLimitsForTests();
  const policy = { name: "route-test", max: 2, windowMs: 60_000 };
  const req = (ip: string) => new Request("http://localhost/api/chat", { headers: { "x-forwarded-for": ip } });

  assert.equal(rateLimitRequest(req("203.0.113.10"), "user_a", policy), null);
  assert.equal(rateLimitRequest(req("203.0.113.11"), "user_a", policy), null);
  assert.equal(rateLimitRequest(req("203.0.113.12"), "user_a", policy)?.status, 429);

  resetRateLimitsForTests();

  assert.equal(rateLimitRequest(req("203.0.113.20"), "user_a", policy), null);
  assert.equal(rateLimitRequest(req("203.0.113.20"), "user_b", policy), null);
  assert.equal(rateLimitRequest(req("203.0.113.20"), "user_c", policy)?.status, 429);
});
