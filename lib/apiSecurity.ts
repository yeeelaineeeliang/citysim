import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { ChatMessage, UserProfile } from "@/lib/tools/types";

const MAX_BODY_BYTES = 32_768;
const MAX_MESSAGE_CHARS = 1_000;
const MAX_HISTORY_TURNS = 12;
const MAX_HISTORY_CHARS = 1_200;
const MAX_NEIGHBORHOOD_CHARS = 80;
const MAX_PROFILE_NOTES_CHARS = 1_000;
const MAX_WORKPLACE_CHARS = 200;
const MAX_LIFESTYLE_TAGS = 20;
const MIN_YEAR = 2001;
const MAX_YEAR = 2026;

type Validation<T> = { ok: true; value: T } | { ok: false; error: string };
type AuthValidation = { ok: true; userId: string } | { ok: false; response: NextResponse };

type StoredRateLimit = {
  count: number;
  resetAt: number;
};

export type RateLimitPolicy = {
  name: string;
  max: number;
  windowMs: number;
};

export const RATE_LIMITS = {
  ai: { name: "ai", max: 12, windowMs: 60_000 },
  standard: { name: "standard", max: 40, windowMs: 60_000 },
  lookup: { name: "lookup", max: 80, windowMs: 60_000 },
} satisfies Record<string, RateLimitPolicy>;

const rateLimitStore = new Map<string, StoredRateLimit>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, label: string, maxLength: number): Validation<string> {
  if (typeof value !== "string") return { ok: false, error: `${label} must be a string` };
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, error: `${label} is required` };
  if (trimmed.length > maxLength) {
    return { ok: false, error: `${label} must be ${maxLength} characters or fewer` };
  }
  return { ok: true, value: trimmed };
}

function optionalBoundedString(value: unknown, label: string, maxLength: number): Validation<string> {
  if (value === undefined || value === null) return { ok: true, value: "" };
  if (typeof value !== "string") return { ok: false, error: `${label} must be a string` };
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    return { ok: false, error: `${label} must be ${maxLength} characters or fewer` };
  }
  return { ok: true, value: trimmed };
}

function integerInRange(value: unknown, label: string, min: number, max: number): Validation<number> {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    return { ok: false, error: `${label} must be an integer between ${min} and ${max}` };
  }
  return { ok: true, value };
}

function optionalYear(value: unknown): Validation<number> {
  if (value === undefined || value === null) return { ok: true, value: 2024 };
  return integerInRange(value, "year", MIN_YEAR, MAX_YEAR);
}

function validatePriorities(value: unknown): Validation<UserProfile["priorities"]> {
  if (!isRecord(value)) return { ok: false, error: "profile.priorities is required" };

  const keys = ["safety", "transit", "affordability", "cityServices", "entertainment"] as const;
  const priorities = {} as UserProfile["priorities"];

  for (const key of keys) {
    const raw = value[key];
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0 || raw > 10) {
      return { ok: false, error: `profile.priorities.${key} must be a number between 0 and 10` };
    }
    priorities[key] = raw;
  }

  return { ok: true, value: priorities };
}

export function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

// Auth is optional — signed-in users get session persistence and per-user
// rate limits; unauthenticated users fall back to IP-based rate limiting.
export async function requireApiUser(): Promise<AuthValidation> {
  try {
    const { userId } = await auth();
    return { ok: true, userId: userId ?? 'anon' };
  } catch {
    return { ok: true, userId: 'anon' };
  }
}

export function apiAuthResult(userId: string | null | undefined): AuthValidation {
  return { ok: true, userId: userId ?? 'anon' };
}

export function rejectOversizedRequest(request: Request, maxBytes = MAX_BODY_BYTES): NextResponse | null {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) return null;

  const bytes = Number(contentLength);
  if (Number.isFinite(bytes) && bytes > maxBytes) {
    return jsonError(`Request body must be ${maxBytes} bytes or smaller`, 413);
  }

  return null;
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export function checkRateLimit(
  key: string,
  policy: RateLimitPolicy,
  now = Date.now(),
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const stored = rateLimitStore.get(key);

  if (!stored || stored.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + policy.windowMs });
    return { allowed: true };
  }

  if (stored.count >= policy.max) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((stored.resetAt - now) / 1000)),
    };
  }

  stored.count += 1;
  return { allowed: true };
}

export function rateLimitRequest(
  request: Request,
  userId: string,
  policy: RateLimitPolicy,
): NextResponse | null {
  const userResult = checkRateLimit(`${policy.name}:user:${userId}`, policy);
  if (!userResult.allowed) return rateLimitError(userResult.retryAfterSeconds);

  const ipResult = checkRateLimit(`${policy.name}:ip:${getClientIp(request)}`, policy);
  if (!ipResult.allowed) return rateLimitError(ipResult.retryAfterSeconds);

  return null;
}

function rateLimitError(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many requests. Please wait a moment and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

export function resetRateLimitsForTests() {
  rateLimitStore.clear();
}

export function validateProfile(value: unknown): Validation<UserProfile> {
  if (!isRecord(value)) return { ok: false, error: "profile is required" };

  const budgetRange = boundedString(value.budgetRange, "profile.budgetRange", 40);
  if (!budgetRange.ok) return budgetRange;

  const workplace = boundedString(value.workplace, "profile.workplace", MAX_WORKPLACE_CHARS);
  if (!workplace.ok) return workplace;

  const commutePref = value.commutePref;
  if (!["transit", "driving", "walking", "biking"].includes(String(commutePref))) {
    return { ok: false, error: "profile.commutePref is invalid" };
  }

  const priorities = validatePriorities(value.priorities);
  if (!priorities.ok) return priorities;

  if (!Array.isArray(value.lifestyle) || value.lifestyle.length > MAX_LIFESTYLE_TAGS) {
    return { ok: false, error: `profile.lifestyle must include ${MAX_LIFESTYLE_TAGS} tags or fewer` };
  }

  const lifestyle: string[] = [];
  for (const tag of value.lifestyle) {
    const parsed = boundedString(tag, "profile.lifestyle tag", 80);
    if (!parsed.ok) return parsed;
    lifestyle.push(parsed.value);
  }

  const notes = optionalBoundedString(value.notes, "profile.notes", MAX_PROFILE_NOTES_CHARS);
  if (!notes.ok) return notes;

  const profile: UserProfile = {
    budgetRange: budgetRange.value,
    workplace: workplace.value,
    commutePref: commutePref as UserProfile["commutePref"],
    priorities: priorities.value,
    lifestyle,
    notes: notes.value,
  };

  if (value.workplaceLat !== undefined || value.workplaceLng !== undefined) {
    if (
      typeof value.workplaceLat !== "number" ||
      typeof value.workplaceLng !== "number" ||
      !Number.isFinite(value.workplaceLat) ||
      !Number.isFinite(value.workplaceLng) ||
      value.workplaceLat < -90 ||
      value.workplaceLat > 90 ||
      value.workplaceLng < -180 ||
      value.workplaceLng > 180
    ) {
      return { ok: false, error: "profile workplace coordinates are invalid" };
    }
    profile.workplaceLat = value.workplaceLat;
    profile.workplaceLng = value.workplaceLng;
  }

  return { ok: true, value: profile };
}

function validateHistory(value: unknown): Validation<ChatMessage[]> {
  if (value === undefined || value === null) return { ok: true, value: [] };
  if (!Array.isArray(value) || value.length > MAX_HISTORY_TURNS) {
    return { ok: false, error: `history must include ${MAX_HISTORY_TURNS} messages or fewer` };
  }

  const history: ChatMessage[] = [];
  for (const message of value) {
    if (!isRecord(message)) return { ok: false, error: "history messages must be objects" };
    if (message.role !== "user" && message.role !== "assistant") {
      return { ok: false, error: "history message role is invalid" };
    }
    const content = boundedString(message.content, "history message content", MAX_HISTORY_CHARS);
    if (!content.ok) return content;
    history.push({ role: message.role, content: content.value });
  }

  return { ok: true, value: history };
}

export function validateChatBody(value: unknown): Validation<{
  message: string;
  neighborhood: string;
  month: number;
  year: number;
  profile: UserProfile;
  history: ChatMessage[];
}> {
  if (!isRecord(value)) return { ok: false, error: "request body must be an object" };

  const message = boundedString(value.message, "message", MAX_MESSAGE_CHARS);
  if (!message.ok) return message;
  const neighborhood = boundedString(value.neighborhood, "neighborhood", MAX_NEIGHBORHOOD_CHARS);
  if (!neighborhood.ok) return neighborhood;
  const month = integerInRange(value.month, "month", 1, 12);
  if (!month.ok) return month;
  const year = optionalYear(value.year);
  if (!year.ok) return year;
  const profile = validateProfile(value.profile);
  if (!profile.ok) return profile;
  const history = validateHistory(value.history);
  if (!history.ok) return history;

  return {
    ok: true,
    value: {
      message: message.value,
      neighborhood: neighborhood.value,
      month: month.value,
      year: year.value,
      profile: profile.value,
      history: history.value,
    },
  };
}

export function validateBriefBody(value: unknown): Validation<{
  neighborhood: string;
  month: number;
  year: number;
  profile: UserProfile;
}> {
  if (!isRecord(value)) return { ok: false, error: "request body must be an object" };

  const neighborhood = boundedString(value.neighborhood, "neighborhood", MAX_NEIGHBORHOOD_CHARS);
  if (!neighborhood.ok) return neighborhood;
  const month = integerInRange(value.month, "month", 1, 12);
  if (!month.ok) return month;
  const year = optionalYear(value.year);
  if (!year.ok) return year;
  const profile = validateProfile(value.profile);
  if (!profile.ok) return profile;

  return { ok: true, value: { neighborhood: neighborhood.value, month: month.value, year: year.value, profile: profile.value } };
}

export function validateMatchBody(value: unknown): Validation<{ profile: UserProfile; topN: number }> {
  if (!isRecord(value)) return { ok: false, error: "request body must be an object" };

  const profile = validateProfile(value.profile);
  if (!profile.ok) return profile;

  const topNValue = value.topN ?? 5;
  const topN = integerInRange(topNValue, "topN", 1, 5);
  if (!topN.ok) return topN;

  return { ok: true, value: { profile: profile.value, topN: topN.value } };
}

export function validateGeocodeQuery(q: string | null): Validation<string | null> {
  const query = q?.trim() ?? "";
  if (query.length === 0 || query.length < 2) return { ok: true, value: null };
  if (query.length > 120) return { ok: false, error: "q must be 120 characters or fewer" };
  return { ok: true, value: query };
}

export function validateNeighborhoodQuery(value: string | null): Validation<string> {
  return boundedString(value ?? "", "neighborhood", MAX_NEIGHBORHOOD_CHARS);
}

export function validateLegacySimulateBody(value: unknown): Validation<{
  question: string;
  month: string;
  neighborhood: string;
  workplace: string;
  monthlyBudget: number;
  priority: string;
}> {
  if (!isRecord(value)) return { ok: false, error: "request body must be an object" };

  const question = boundedString(value.question, "question", MAX_MESSAGE_CHARS);
  if (!question.ok) return question;
  const month = optionalBoundedString(value.month, "month", 40);
  if (!month.ok) return month;
  const neighborhood = optionalBoundedString(value.neighborhood, "neighborhood", MAX_NEIGHBORHOOD_CHARS);
  if (!neighborhood.ok) return neighborhood;

  const persona = isRecord(value.persona) ? value.persona : {};
  const workplace = optionalBoundedString(persona.workplace, "persona.workplace", MAX_WORKPLACE_CHARS);
  if (!workplace.ok) return workplace;
  const priority = optionalBoundedString(persona.priority, "persona.priority", 80);
  if (!priority.ok) return priority;

  const budget = persona.monthlyBudget;
  if (budget !== undefined && (typeof budget !== "number" || !Number.isFinite(budget) || budget < 0 || budget > 20_000)) {
    return { ok: false, error: "persona.monthlyBudget is invalid" };
  }

  return {
    ok: true,
    value: {
      question: question.value,
      month: month.value || "October 2024",
      neighborhood: neighborhood.value || "Hyde Park",
      workplace: workplace.value || "UChicago - 5600 S University Ave",
      monthlyBudget: typeof budget === "number" ? budget : 1400,
      priority: priority.value || "transit reliability",
    },
  };
}
