import { getFallbackCommunityAreas } from "@/lib/communityAreaMap";
import { getAllCoordinates, getCoordinateByName } from "@/lib/neighborhoodCoordinates";
import { fallbackNeighborhoodMatches, matchNeighborhoods } from "@/lib/neighborhoodMatch";
import { createSupabaseAdminClient, hasSupabaseCredentials } from "@/lib/supabase";
import type { UserProfile } from "@/lib/tools/types";

export type CommunityAreaPreviewConfidence = "medium" | "low" | "unavailable";
export type CommunityAreaPreviewTone = "good" | "neutral" | "caution" | "unknown";
export type CommunityAreaPreviewCommuteTone = Exclude<CommunityAreaPreviewTone, "unknown"> | "unavailable";

export interface CommunityAreaPreviewRankItem {
  rank: number | null;
  total: number;
  label: string;
  tone: CommunityAreaPreviewTone;
}

export interface CommunityAreaPreviewRank {
  overall: CommunityAreaPreviewRankItem;
  commute: CommunityAreaPreviewRankItem;
}

export interface CommunityAreaPreview {
  neighborhood: string;
  fitLine: string;
  verdict: { label: string; tone: CommunityAreaPreviewTone };
  rank: CommunityAreaPreviewRank;
  commute: {
    label: string;
    confidence: CommunityAreaPreviewConfidence;
    tone: CommunityAreaPreviewCommuteTone;
    minutes: number | null;
  };
  budget: { label: string; tone: Exclude<CommunityAreaPreviewTone, "caution"> };
  safety: { label: string; tone: CommunityAreaPreviewTone };
  activity: { label: string; tone: Exclude<CommunityAreaPreviewTone, "caution"> };
}

export interface CommunityAreaPreviewInput {
  neighborhood: string;
  workplace: string;
  workplaceLat?: number;
  workplaceLng?: number;
  commutePref: UserProfile["commutePref"];
  budgetRange: string;
  monthlyBudget?: number;
  month: number;
  year: number;
  priorities?: Partial<UserProfile["priorities"]>;
}

export interface CommunityAreaPreviewMetrics {
  descriptors?: string[];
  rentEstimate?: number | null;
  crimeIncidentCount?: number | null;
  cityCrimeAverage?: number | null;
  restaurants?: number | null;
  bars?: number | null;
}

interface CommunityAreaRow {
  id: string;
  city_id: string;
  descriptors: string[] | null;
}

interface HousingPreviewRow {
  avg_rent_estimate: number | null;
  median_rent_estimate: number | null;
}

interface CrimePreviewRow {
  incident_count: number;
}

interface EntertainmentPreviewRow {
  restaurants: number | null;
  bars: number | null;
}

const KNOWN_WORKPLACES: Record<string, { lat: number; lng: number; label: string }> = {
  uchicago: { lat: 41.7886, lng: -87.5987, label: "UChicago" },
  "university of chicago": { lat: 41.7886, lng: -87.5987, label: "UChicago" },
  "the university of chicago": { lat: 41.7886, lng: -87.5987, label: "UChicago" },
  "uchicago campus": { lat: 41.7886, lng: -87.5987, label: "UChicago" },
  loop: { lat: 41.8781, lng: -87.6298, label: "the Loop" },
  "the loop": { lat: 41.8781, lng: -87.6298, label: "the Loop" },
  downtown: { lat: 41.8781, lng: -87.6298, label: "downtown" },
  uic: { lat: 41.8716, lng: -87.6491, label: "UIC" },
  "medical district": { lat: 41.8735, lng: -87.6746, label: "the Medical District" },
  "illinois medical district": { lat: 41.8735, lng: -87.6746, label: "the Medical District" },
};

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const RANK_TIMEOUT_MS = 1800;
const DEFAULT_PRIORITIES: UserProfile["priorities"] = {
  safety: 0.2,
  transit: 0.2,
  affordability: 0.2,
  cityServices: 0.2,
  entertainment: 0.2,
};
const PRIORITY_KEYS = ["safety", "transit", "affordability", "cityServices", "entertainment"] as const;

function normalizePlace(value: string): string {
  return value.toLowerCase().trim().replace(/[.,]/g, "").replace(/\s+/g, " ");
}

function resolveWorkplace(input: CommunityAreaPreviewInput): { lat: number; lng: number; label: string } | null {
  if (
    typeof input.workplaceLat === "number" &&
    typeof input.workplaceLng === "number" &&
    Number.isFinite(input.workplaceLat) &&
    Number.isFinite(input.workplaceLng)
  ) {
    return {
      lat: input.workplaceLat,
      lng: input.workplaceLng,
      label: displayWorkplace(input.workplace),
    };
  }

  const key = normalizePlace(input.workplace);
  if (!key) return null;
  if (KNOWN_WORKPLACES[key]) return KNOWN_WORKPLACES[key];

  for (const [known, workplace] of Object.entries(KNOWN_WORKPLACES)) {
    if (key.includes(known) || known.includes(key)) return workplace;
  }

  return null;
}

function displayWorkplace(value: string): string {
  const normalized = normalizePlace(value);
  if (/uchicago|university of chicago/.test(normalized)) return "UChicago";
  if (/uic/.test(normalized)) return "UIC";
  const beforeComma = value.split(",")[0]?.trim() || value.trim();
  return beforeComma.length > 34 ? `${beforeComma.slice(0, 31)}...` : beforeComma || "your anchor";
}

function distanceMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const radiusMiles = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng *
      sinLng;
  return radiusMiles * 2 * Math.asin(Math.sqrt(h));
}

function estimateMinutes(distance: number, mode: UserProfile["commutePref"]) {
  if (mode === "driving") return Math.max(5, Math.round(distance * 4));
  if (mode === "walking") return Math.max(5, Math.round(distance * 20));
  if (mode === "biking") return Math.max(4, Math.round(distance * 6));
  return Math.max(8, Math.round(distance * 8));
}

function normalizedPriorities(input?: Partial<UserProfile["priorities"]>): UserProfile["priorities"] {
  const raw = PRIORITY_KEYS.reduce(
    (priorities, key) => ({
      ...priorities,
      [key]: Number.isFinite(input?.[key]) ? Math.max(0, Number(input?.[key])) : DEFAULT_PRIORITIES[key],
    }),
    {} as UserProfile["priorities"],
  );
  const total = PRIORITY_KEYS.reduce((sum, key) => sum + raw[key], 0);
  if (total <= 0) return DEFAULT_PRIORITIES;
  return PRIORITY_KEYS.reduce(
    (priorities, key) => ({ ...priorities, [key]: raw[key] / total }),
    {} as UserProfile["priorities"],
  );
}

function commuteTone(
  minutes: number,
  mode: UserProfile["commutePref"],
  priorities?: Partial<UserProfile["priorities"]>,
): Exclude<CommunityAreaPreviewCommuteTone, "unavailable"> {
  const thresholds: Record<UserProfile["commutePref"], { good: number; caution: number }> = {
    transit: { good: 35, caution: 55 },
    driving: { good: 25, caution: 45 },
    walking: { good: 20, caution: 35 },
    biking: { good: 18, caution: 32 },
  };
  const transitPriority = normalizedPriorities(priorities).transit;
  const priorityAdjustment = transitPriority >= 0.34 ? 8 : transitPriority >= 0.26 ? 5 : 0;
  const threshold = thresholds[mode];
  if (minutes <= Math.max(8, threshold.good - Math.round(priorityAdjustment / 2))) return "good";
  if (minutes >= Math.max(threshold.good + 8, threshold.caution - priorityAdjustment)) return "caution";
  return "neutral";
}

function commuteToneLabel(tone: Exclude<CommunityAreaPreviewCommuteTone, "unavailable">): string {
  if (tone === "good") return "short commute";
  if (tone === "caution") return "long commute";
  return "workable commute";
}

function commuteLabel(input: CommunityAreaPreviewInput): CommunityAreaPreview["commute"] {
  const origin = getCoordinateByName(input.neighborhood);
  const destination = resolveWorkplace(input);
  if (!origin || !destination) {
    return {
      label: "Commute estimate unavailable",
      confidence: "unavailable",
      tone: "unavailable",
      minutes: null,
    };
  }

  const miles = distanceMiles(origin, destination);
  const minutes = estimateMinutes(miles, input.commutePref);
  const tone = commuteTone(minutes, input.commutePref, input.priorities);
  return {
    label: `~${minutes} min by ${input.commutePref} to ${destination.label} · ${commuteToneLabel(tone)}`,
    confidence: "low",
    tone,
    minutes,
  };
}

function parseBudgetRange(value: string): { label: string; ceiling: number | null; floor: number | null; openEnded: boolean } {
  const trimmed = value.trim();
  const amounts = trimmed.match(/\d[\d,]*/g)?.map((amount) => Number(amount.replace(/,/g, ""))) ?? [];
  const openEnded = /\+/.test(trimmed);
  return {
    label: trimmed || "your budget",
    ceiling: openEnded || amounts.length === 0 ? null : Math.max(...amounts),
    floor: amounts.length > 0 ? Math.min(...amounts) : null,
    openEnded,
  };
}

function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function budgetLabel(input: CommunityAreaPreviewInput, rentEstimate: number | null | undefined): CommunityAreaPreview["budget"] {
  if (!rentEstimate || rentEstimate <= 0) {
    return { label: "Rent data not loaded yet", tone: "unknown" };
  }

  if (typeof input.monthlyBudget === "number" && Number.isFinite(input.monthlyBudget)) {
    const rentLabel = `Est. ${formatCurrency(rentEstimate)}/mo`;
    const budgetLabel = formatCurrency(input.monthlyBudget);
    return rentEstimate <= input.monthlyBudget
      ? { label: `${rentLabel} - fits ${budgetLabel} budget`, tone: "good" }
      : { label: `${rentLabel} - above ${budgetLabel} budget`, tone: "neutral" };
  }

  const budget = parseBudgetRange(input.budgetRange);
  const rentLabel = `Est. ${formatCurrency(rentEstimate)}/mo`;

  if (budget.ceiling !== null) {
    return rentEstimate <= budget.ceiling
      ? { label: `${rentLabel} - fits ${budget.label}`, tone: "good" }
      : { label: `${rentLabel} - above ${budget.label}`, tone: "neutral" };
  }

  if (budget.openEnded && budget.floor !== null && rentEstimate <= budget.floor) {
    return { label: `${rentLabel} - under ${budget.label}`, tone: "good" };
  }

  return { label: `${rentLabel} rent signal`, tone: "neutral" };
}

function safetyLabel(
  input: CommunityAreaPreviewInput,
  incidentCount: number | null | undefined,
  cityAverage: number | null | undefined,
): CommunityAreaPreview["safety"] {
  if (incidentCount === null || incidentCount === undefined || incidentCount <= 0) {
    return { label: "Safety data not loaded yet", tone: "unknown" };
  }

  const month = MONTH_SHORT[input.month - 1] ?? "This month";
  const countLabel = `${incidentCount.toLocaleString()} in ${month}`;

  if (!cityAverage || cityAverage <= 0) {
    return { label: `${countLabel} reported incidents`, tone: "neutral" };
  }

  const ratio = incidentCount / cityAverage;
  const averageLabel = Math.round(cityAverage).toLocaleString();
  if (ratio <= 0.85) return { label: `${countLabel}; below city avg ${averageLabel}`, tone: "good" };
  if (ratio >= 1.15) return { label: `${countLabel}; above city avg ${averageLabel}`, tone: "caution" };
  return { label: `${countLabel}; near city avg ${averageLabel}`, tone: "neutral" };
}

function activityLabel(metrics: CommunityAreaPreviewMetrics): CommunityAreaPreview["activity"] {
  const restaurants = metrics.restaurants ?? 0;
  const bars = metrics.bars ?? 0;
  const activityCount = restaurants + bars;

  if (activityCount > 0) {
    if (activityCount >= 240) return { label: "Dense restaurants and nightlife", tone: "good" };
    if (activityCount >= 120) return { label: "Strong dining access", tone: "good" };
    return { label: "Local dining and errands nearby", tone: "neutral" };
  }

  const descriptors = metrics.descriptors?.slice(0, 2).filter(Boolean) ?? [];
  if (descriptors.length > 0) {
    return { label: descriptors.join(" and "), tone: "neutral" };
  }

  return { label: "Neighborhood character data limited", tone: "unknown" };
}

function fitLine(preview: Pick<CommunityAreaPreview, "commute" | "budget" | "activity">): string {
  const parts = [
    preview.commute.confidence !== "unavailable" ? preview.commute.label : null,
    preview.budget.label,
    preview.activity.tone !== "unknown" ? preview.activity.label : null,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" · ") : "Review the available signals before simulating.";
}

function unavailableRank(label: string): CommunityAreaPreviewRankItem {
  return {
    rank: null,
    total: getAllCoordinates().length,
    label,
    tone: "unknown",
  };
}

function rankTone(rank: number | null, total: number): CommunityAreaPreviewTone {
  if (!rank || total <= 0) return "unknown";
  const percentile = rank / total;
  if (percentile <= 0.25) return "good";
  if (percentile <= 0.62) return "neutral";
  return "caution";
}

function commuteRank(input: CommunityAreaPreviewInput): CommunityAreaPreviewRankItem {
  const destination = resolveWorkplace(input);
  if (!destination) return unavailableRank("Commute rank unavailable");

  const ranked = getAllCoordinates()
    .map((area, index) => ({
      area,
      index,
      minutes: estimateMinutes(distanceMiles(area, destination), input.commutePref),
    }))
    .sort((a, b) => a.minutes - b.minutes || a.index - b.index);

  const selectedIndex = ranked.findIndex((item) => item.area.name.toLowerCase() === input.neighborhood.toLowerCase());
  if (selectedIndex < 0) return unavailableRank("Commute rank unavailable");

  const rank = selectedIndex + 1;
  const total = ranked.length;
  return {
    rank,
    total,
    label: `#${rank} of ${total} for ${input.commutePref} commute`,
    tone: rankTone(rank, total),
  };
}

function previewProfile(input: CommunityAreaPreviewInput): UserProfile {
  return {
    budgetRange: input.budgetRange,
    ...(typeof input.monthlyBudget === "number" ? { monthlyBudget: input.monthlyBudget } : {}),
    workplace: input.workplace,
    workplaceLat: input.workplaceLat,
    workplaceLng: input.workplaceLng,
    commutePref: input.commutePref,
    priorities: normalizedPriorities(input.priorities),
    lifestyle: [],
    notes: "",
  };
}

function overallRankFromMatches(
  input: CommunityAreaPreviewInput,
  matches: Array<{ name: string }>,
): CommunityAreaPreviewRankItem {
  const total = Math.max(matches.length, getAllCoordinates().length);
  const index = matches.findIndex((match) => match.name.toLowerCase() === input.neighborhood.toLowerCase());
  if (index < 0) return unavailableRank("Profile rank unavailable");

  const rank = index + 1;
  return {
    rank,
    total,
    label: `Ranked #${rank} of ${total} for your profile`,
    tone: rankTone(rank, total),
  };
}

async function overallRank(input: CommunityAreaPreviewInput): Promise<CommunityAreaPreviewRankItem> {
  const profile = previewProfile(input);
  const fallback = () => overallRankFromMatches(input, fallbackNeighborhoodMatches(profile, getAllCoordinates().length));

  try {
    return await Promise.race([
      matchNeighborhoods(profile, getAllCoordinates().length).then((matches) =>
        matches.length ? overallRankFromMatches(input, matches) : fallback(),
      ),
      new Promise<CommunityAreaPreviewRankItem>((resolve) => {
        setTimeout(() => resolve(fallback()), RANK_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return fallback();
  }
}

export async function loadCommunityAreaPreviewRank(input: CommunityAreaPreviewInput): Promise<CommunityAreaPreviewRank> {
  const commute = commuteRank(input);
  const overall = await overallRank(input);
  return { overall, commute };
}

function defaultCommunityAreaPreviewRank(input: CommunityAreaPreviewInput): CommunityAreaPreviewRank {
  return {
    overall: unavailableRank("Profile rank needs comparison data"),
    commute: commuteRank(input),
  };
}

function joinedSentence(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function capitalizeSentence(value: string): string {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

function verdictLine(
  input: CommunityAreaPreviewInput,
  preview: Pick<CommunityAreaPreview, "commute" | "budget" | "safety" | "activity" | "rank">,
): CommunityAreaPreview["verdict"] {
  const priorities = normalizedPriorities(input.priorities);
  const strengths: string[] = [];
  const concerns: string[] = [];

  if (preview.commute.tone === "good") strengths.push("anchor commute looks strong");
  if (preview.budget.tone === "good") strengths.push("budget fit looks strong");
  if (preview.activity.tone === "good") strengths.push("daily-life access looks strong");

  if (preview.commute.tone === "caution") {
    concerns.push(
      priorities.transit >= 0.26
        ? "the anchor commute conflicts with your commute priority"
        : "the anchor commute is long",
    );
  }
  if (preview.safety.tone === "caution") {
    concerns.push(
      priorities.safety >= 0.26
        ? "the reported-crime signal deserves a closer look"
        : "reported incidents are above the city average",
    );
  }

  const rankLead = preview.rank.overall.rank
    ? `${preview.rank.overall.label}.`
    : preview.rank.commute.rank
      ? `${preview.rank.commute.label}.`
      : "";

  let judgment = "Review the detailed signals before choosing.";
  if (strengths.length > 0 && concerns.length > 0) {
    judgment = `${capitalizeSentence(joinedSentence(strengths.slice(0, 2)))}, but ${concerns[0]}.`;
  } else if (concerns.length > 0) {
    judgment = `Watch: ${joinedSentence(concerns.slice(0, 2))}.`;
  } else if (strengths.length > 0) {
    judgment = `${capitalizeSentence(joinedSentence(strengths.slice(0, 2)))}.`;
  }

  return {
    label: [rankLead, judgment].filter(Boolean).join(" "),
    tone: concerns.length > 0 ? "caution" : strengths.length > 0 ? "good" : "neutral",
  };
}

function fallbackDescriptors(neighborhood: string): string[] {
  return getFallbackCommunityAreas().find((area) => area.name.toLowerCase() === neighborhood.toLowerCase())?.descriptors ?? [];
}

export function buildCommunityAreaPreview(
  input: CommunityAreaPreviewInput,
  metrics: CommunityAreaPreviewMetrics = {},
  rank: CommunityAreaPreviewRank = defaultCommunityAreaPreviewRank(input),
): CommunityAreaPreview {
  const mergedMetrics = {
    ...metrics,
    descriptors: metrics.descriptors?.length ? metrics.descriptors : fallbackDescriptors(input.neighborhood),
  };

  const preview = {
    commute: commuteLabel(input),
    budget: budgetLabel(input, mergedMetrics.rentEstimate),
    safety: safetyLabel(input, mergedMetrics.crimeIncidentCount, mergedMetrics.cityCrimeAverage),
    activity: activityLabel(mergedMetrics),
    rank,
  };

  return {
    neighborhood: input.neighborhood,
    fitLine: fitLine(preview),
    verdict: verdictLine(input, preview),
    ...preview,
  };
}

export async function loadCommunityAreaPreviewMetrics(
  input: Pick<CommunityAreaPreviewInput, "neighborhood" | "month" | "year">,
): Promise<CommunityAreaPreviewMetrics> {
  const fallback = fallbackDescriptors(input.neighborhood);
  if (!hasSupabaseCredentials()) return { descriptors: fallback };

  try {
    const supabase = createSupabaseAdminClient();
    const { data: area } = await supabase
      .from("community_areas")
      .select("id, city_id, descriptors")
      .ilike("name", input.neighborhood)
      .limit(1)
      .single<CommunityAreaRow>();

    if (!area) return { descriptors: fallback };

    const [housing, crime, cityCrime, entertainment] = await Promise.all([
      supabase
        .from("housing_metrics")
        .select("avg_rent_estimate, median_rent_estimate")
        .eq("community_area_id", area.id)
        .eq("year", input.year)
        .maybeSingle<HousingPreviewRow>(),
      supabase
        .from("crime_monthly")
        .select("incident_count")
        .eq("community_area_id", area.id)
        .eq("year", input.year)
        .eq("month", input.month)
        .maybeSingle<CrimePreviewRow>(),
      supabase
        .from("crime_monthly")
        .select("incident_count")
        .eq("city_id", area.city_id)
        .eq("year", input.year)
        .eq("month", input.month)
        .returns<CrimePreviewRow[]>(),
      supabase
        .from("entertainment_metrics")
        .select("restaurants, bars")
        .eq("community_area_id", area.id)
        .eq("year", input.year)
        .maybeSingle<EntertainmentPreviewRow>(),
    ]);

    const crimeCounts = (cityCrime.data ?? [])
      .map((row: CrimePreviewRow) => Number(row.incident_count))
      .filter((value: number) => Number.isFinite(value) && value > 0);
    const cityCrimeAverage =
      crimeCounts.length > 0
        ? crimeCounts.reduce((sum: number, value: number) => sum + value, 0) / crimeCounts.length
        : null;

    return {
      descriptors: area.descriptors?.length ? area.descriptors : fallback,
      rentEstimate: housing.data?.avg_rent_estimate ?? housing.data?.median_rent_estimate ?? null,
      crimeIncidentCount: crime.data?.incident_count ?? null,
      cityCrimeAverage,
      restaurants: entertainment.data?.restaurants ?? null,
      bars: entertainment.data?.bars ?? null,
    };
  } catch {
    return { descriptors: fallback };
  }
}

export async function getCommunityAreaPreview(input: CommunityAreaPreviewInput): Promise<CommunityAreaPreview> {
  const [metrics, rank] = await Promise.all([
    Promise.race([
      loadCommunityAreaPreviewMetrics(input),
      new Promise<CommunityAreaPreviewMetrics>((resolve) => {
        setTimeout(() => resolve({ descriptors: fallbackDescriptors(input.neighborhood) }), 1800);
      }),
    ]),
    loadCommunityAreaPreviewRank(input),
  ]);
  return buildCommunityAreaPreview(input, metrics, rank);
}
