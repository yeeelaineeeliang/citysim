import type { UserProfile } from "@/lib/tools/types";

const PROFILE_STORAGE_KEY = "livingthere:user_profile";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isUserProfile(value: unknown): value is UserProfile {
  if (!isRecord(value)) return false;
  if (typeof value.budgetRange !== "string") return false;
  if ("monthlyBudget" in value && value.monthlyBudget !== undefined && !isFiniteNumber(value.monthlyBudget)) return false;
  if (typeof value.workplace !== "string") return false;
  if (!["transit", "driving", "walking", "biking"].includes(String(value.commutePref))) return false;
  if (!Array.isArray(value.lifestyle) || !value.lifestyle.every((item) => typeof item === "string")) return false;
  if (typeof value.notes !== "string") return false;
  if (!isRecord(value.priorities)) return false;
  const priorities = value.priorities;

  const priorityKeys = ["safety", "transit", "affordability", "cityServices", "entertainment"];
  if (!priorityKeys.every((key) => isFiniteNumber(priorities[key]))) return false;

  if ("workplaceLat" in value && value.workplaceLat !== undefined && !isFiniteNumber(value.workplaceLat)) return false;
  if ("workplaceLng" in value && value.workplaceLng !== undefined && !isFiniteNumber(value.workplaceLng)) return false;

  return true;
}

export function loadStoredProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isUserProfile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveStoredProfile(profile: UserProfile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore private browsing/storage quota failures; the in-memory flow still works.
  }
}
