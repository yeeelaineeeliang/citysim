import { NEIGHBORHOOD_COORDINATES } from "@/lib/neighborhoodCoordinates";
import type { SimMessage, SimMessageKind } from "@/lib/simMessages";
import type { UserProfile } from "@/lib/tools/types";

export const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
export const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const SIM_YEAR = 2024;

// Worded to read naturally both before a run and in the post-run debrief.
// Keep the demo-QA keywords intact (crime / commute / service / weekends /
// afford) — lib/demoData.ts matchDemoQA and the e2e spec key off them.
export const SUGGESTED_QUESTIONS = [
  "What is crime like here this season?",
  "What is my morning commute like?",
  "How responsive is the city to service issues?",
  "What can I do on weekends here?",
  "Can I afford to live here?",
];

export function commuteModePhrase(mode?: UserProfile["commutePref"]) {
  if (mode === "driving") return "drive";
  if (mode === "walking") return "walk";
  if (mode === "biking") return "bike";
  return "by bus/transit";
}

export function displayWorkplaceContext(workplace?: string) {
  const trimmed = workplace?.trim();
  if (!trimmed || trimmed.toLowerCase() === "not specified") return null;
  const withoutChicago = trimmed.replace(/,\s*Chicago(?:,\s*(?:IL|Illinois))?$/i, "");
  return withoutChicago.replace(/^The University of Chicago$/i, "University of Chicago");
}

export const ALL_NEIGHBORHOODS = NEIGHBORHOOD_COORDINATES.map((c) => c.name).sort();

export function createSimMessage(
  role: SimMessage["role"],
  content: string,
  month: number,
  kind: SimMessageKind,
): SimMessage {
  return { role, content, month, year: SIM_YEAR, kind };
}

export function timeProgressToHeading(p: number): number {
  if (p <= 0.10) return 45;
  if (p <= 0.40) return 110;
  if (p <= 0.60) return 220;
  if (p <= 0.78) return 290;
  return 170;
}

export function bearingTo(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function parseHour(timeLabel: string | undefined): number {
  if (!timeLabel) return 12;
  const m = timeLabel.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return 12;
  let h = parseInt(m[1]);
  if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
  if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
  return h;
}

export function getProfileWorkplaceCoords(profile: UserProfile | null) {
  if (!profile) return null;

  const { workplaceLat, workplaceLng } = profile;
  if (
    typeof workplaceLat === "number" &&
    typeof workplaceLng === "number" &&
    Number.isFinite(workplaceLat) &&
    Number.isFinite(workplaceLng)
  ) {
    return { lat: workplaceLat, lng: workplaceLng };
  }

  const legacyProfile = profile as UserProfile & { lat?: unknown; lng?: unknown };
  if (
    typeof legacyProfile.lat === "number" &&
    typeof legacyProfile.lng === "number" &&
    Number.isFinite(legacyProfile.lat) &&
    Number.isFinite(legacyProfile.lng)
  ) {
    return { lat: legacyProfile.lat, lng: legacyProfile.lng };
  }

  return null;
}
