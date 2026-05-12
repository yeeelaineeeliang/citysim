/**
 * Neighborhood matching ranks Chicago community areas against a user profile.
 *
 * Numeric fit scores are intentionally kept private to this module. Public
 * results expose only ranked order and descriptor labels.
 */

import { createSupabaseAdminClient, hasSupabaseCredentials } from "@/lib/supabase";
import { getAllCoordinates } from "@/lib/neighborhoodCoordinates";
import type { UserProfile } from "@/lib/tools/types";

// ─── Workplace proximity ──────────────────────────────────────────────────────

const KNOWN_WORKPLACES: Record<string, { lat: number; lng: number }> = {
  "uchicago":                    { lat: 41.7886, lng: -87.5987 },
  "university of chicago":       { lat: 41.7886, lng: -87.5987 },
  "downtown":                    { lat: 41.8781, lng: -87.6298 },
  "loop":                        { lat: 41.8781, lng: -87.6298 },
  "the loop":                    { lat: 41.8781, lng: -87.6298 },
  "chicago loop":                { lat: 41.8781, lng: -87.6298 },
  "magnificent mile":            { lat: 41.8919, lng: -87.6246 },
  "mag mile":                    { lat: 41.8919, lng: -87.6246 },
  "river north":                 { lat: 41.8936, lng: -87.6338 },
  "wrigleyville":                { lat: 41.9484, lng: -87.6553 },
  "wrigley field":               { lat: 41.9484, lng: -87.6553 },
  "ohare":                       { lat: 41.9742, lng: -87.9073 },
  "o'hare":                      { lat: 41.9742, lng: -87.9073 },
  "midway":                      { lat: 41.7868, lng: -87.7522 },
  "illinois medical district":   { lat: 41.8735, lng: -87.6746 },
  "medical district":            { lat: 41.8735, lng: -87.6746 },
  "northwestern":                { lat: 41.8923, lng: -87.6098 },
  "northwestern university":     { lat: 41.8923, lng: -87.6098 },
  "uic":                         { lat: 41.8716, lng: -87.6491 },
  "loyola":                      { lat: 42.0006, lng: -87.6615 },
  "illinois tech":               { lat: 41.8348, lng: -87.6274 },
  "iit":                         { lat: 41.8348, lng: -87.6274 },
  "depaul":                      { lat: 41.9247, lng: -87.6559 },
};

function resolveWorkplaceCoords(profile: MatchUserProfile): { lat: number; lng: number } | null {
  // Prefer geocoded coordinates stored directly on the profile (set by the form combobox)
  const p = profile as UserProfile;
  if (typeof p.workplaceLat === "number" && typeof p.workplaceLng === "number" &&
      Number.isFinite(p.workplaceLat) && Number.isFinite(p.workplaceLng)) {
    return { lat: p.workplaceLat, lng: p.workplaceLng };
  }
  // Fall back to the lookup table for profiles without geocoded coordinates
  const workplace = ("workplace" in profile ? p.workplace : "") ?? "";
  if (!workplace.trim()) return null;
  const key = workplace.toLowerCase().trim().replace(/[.,]/g, "").replace(/\s+/g, " ");
  if (KNOWN_WORKPLACES[key]) return KNOWN_WORKPLACES[key];
  for (const [k, coords] of Object.entries(KNOWN_WORKPLACES)) {
    if (key.includes(k) || k.includes(key)) return coords;
  }
  return null;
}

function distanceMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  return R * 2 * Math.asin(Math.sqrt(h));
}

type CommutePreference = UserProfile["commutePref"];
type MatchDimension = "safety" | "transit" | "affordability" | "cityServices" | "entertainment";

type SnakePriorityWeights = {
  safety?: number;
  transit?: number;
  affordability?: number;
  city_services?: number;
  entertainment?: number;
};

export type MatchUserProfile =
  | UserProfile
  | {
      budget?: number | string;
      budgetRange?: string;
      commute_preference?: CommutePreference;
      commutePref?: CommutePreference;
      priority_weights?: SnakePriorityWeights;
      priorities?: Partial<UserProfile["priorities"]>;
    };

export type NeighborhoodScores = {
  /** Higher crime is worse. If `safety` is present, it takes precedence. */
  crime?: number;
  /** Higher safety is better. */
  safety?: number;
  /** Higher transit score is better. */
  transit?: number;
  /** Higher housing/affordability score is better. */
  housing?: number;
  affordability?: number;
  /** Higher service score is better. For response-time data, pass the negative response time. */
  service311?: number;
  cityServices?: number;
  city_services?: number;
  /** Higher entertainment score is better. */
  entertainment?: number;
};

export type NeighborhoodCommuteData = {
  transitMinutes?: number | null;
  drivingMinutes?: number | null;
  walkingMinutes?: number | null;
  bikingMinutes?: number | null;
};

export type NeighborhoodHousingData = {
  medianRent?: number | null;
  averageRent?: number | null;
  avgRent?: number | null;
};

export type NeighborhoodData = {
  communityAreaNumber: number;
  name: string;
  slug?: string;
  descriptors?: readonly string[];
  scores: NeighborhoodScores;
  commute?: NeighborhoodCommuteData;
  housing?: NeighborhoodHousingData;
};

export interface NeighborhoodMatch {
  communityAreaNumber: number;
  name: string;
  slug?: string;
  descriptors: string[];
  matchReason: string;
}

type ScoringContext = {
  profile: {
    budgetCeiling: number | null;
    commutePreference: CommutePreference;
    weights: Record<MatchDimension, number>;
    workplaceName: string | null;
    shortCommuteMode: boolean;
  };
  ranges: Record<MatchDimension | "commuteMinutes", { min: number; max: number }>;
};

interface AreaRow {
  community_area_number: number;
  name: string;
  slug: string;
  population: number | null;
  descriptors: string[] | null;
}

interface HousingRow {
  community_area_id: string;
  affordable_units: number;
  avg_rent_estimate: number | null;
}

interface CrimeRow {
  community_area_id: string;
  incident_count: number;
}

interface TransitRow {
  community_area_id: string;
  bus_ridership: number;
  l_ridership: number;
}

interface ServiceRow {
  community_area_id: string;
  avg_response_days: number;
}

interface EntRow {
  community_area_id: string;
  restaurants: number;
  bars: number;
}

const DIMENSIONS: MatchDimension[] = [
  "safety",
  "transit",
  "affordability",
  "cityServices",
  "entertainment",
];

const DEFAULT_WEIGHTS: Record<MatchDimension, number> = {
  safety: 0.2,
  transit: 0.2,
  affordability: 0.2,
  cityServices: 0.2,
  entertainment: 0.2,
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function normalize(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return 0.5;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return 0.5;
  return clamp01((value - min) / (max - min));
}

function parseBudgetCeiling(profile: MatchUserProfile): number | null {
  const rawBudget = "budget" in profile ? profile.budget : undefined;
  if (isFiniteNumber(rawBudget)) return rawBudget;

  if (typeof rawBudget === "string") {
    const parsed = Number(rawBudget.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  const budgetRange = "budgetRange" in profile ? profile.budgetRange : undefined;
  if (!budgetRange) return null;
  if (/\+$/.test(budgetRange.trim())) return null;

  const amounts = budgetRange.match(/\d[\d,]*/g)?.map((n) => Number(n.replace(/,/g, ""))) ?? [];
  if (amounts.length === 0) return null;
  return Math.max(...amounts);
}

function normalizeWeights(profile: MatchUserProfile): Record<MatchDimension, number> {
  const snake = "priority_weights" in profile ? profile.priority_weights : undefined;
  const camel = "priorities" in profile ? profile.priorities : undefined;
  const raw = {
    safety: camel?.safety ?? snake?.safety ?? DEFAULT_WEIGHTS.safety,
    transit: camel?.transit ?? snake?.transit ?? DEFAULT_WEIGHTS.transit,
    affordability: camel?.affordability ?? snake?.affordability ?? DEFAULT_WEIGHTS.affordability,
    cityServices: camel?.cityServices ?? snake?.city_services ?? DEFAULT_WEIGHTS.cityServices,
    entertainment: camel?.entertainment ?? snake?.entertainment ?? DEFAULT_WEIGHTS.entertainment,
  };

  const positiveTotal = DIMENSIONS.reduce((sum, key) => sum + Math.max(0, raw[key]), 0);
  if (positiveTotal <= 0) return DEFAULT_WEIGHTS;

  return DIMENSIONS.reduce(
    (weights, key) => ({ ...weights, [key]: Math.max(0, raw[key]) / positiveTotal }),
    {} as Record<MatchDimension, number>,
  );
}

function getCommutePreference(profile: MatchUserProfile): CommutePreference {
  const preference =
    ("commute_preference" in profile ? profile.commute_preference : undefined) ??
    ("commutePref" in profile ? profile.commutePref : undefined);
  return preference ?? "transit";
}

function getRent(neighborhood: NeighborhoodData): number | null {
  const rent =
    neighborhood.housing?.medianRent ??
    neighborhood.housing?.averageRent ??
    neighborhood.housing?.avgRent;
  return isFiniteNumber(rent) ? rent : null;
}

function getCommuteMinutes(neighborhood: NeighborhoodData, preference: CommutePreference): number | null {
  const commute = neighborhood.commute;
  if (!commute) return null;

  const value =
    preference === "transit" ? commute.transitMinutes :
    preference === "driving" ? commute.drivingMinutes :
    preference === "walking" ? commute.walkingMinutes :
    commute.bikingMinutes;

  return isFiniteNumber(value) ? value : null;
}

function rawDimensionValue(neighborhood: NeighborhoodData, dimension: MatchDimension): number | null {
  const scores = neighborhood.scores;

  if (dimension === "safety") {
    if (isFiniteNumber(scores.safety)) return scores.safety;
    if (isFiniteNumber(scores.crime)) return -scores.crime;
    return null;
  }

  if (dimension === "affordability") {
    if (isFiniteNumber(scores.affordability)) return scores.affordability;
    if (isFiniteNumber(scores.housing)) return scores.housing;
    const rent = getRent(neighborhood);
    return rent === null ? null : -rent;
  }

  if (dimension === "cityServices") {
    if (isFiniteNumber(scores.cityServices)) return scores.cityServices;
    if (isFiniteNumber(scores.city_services)) return scores.city_services;
    if (isFiniteNumber(scores.service311)) return scores.service311;
    return null;
  }

  const value = scores[dimension];
  return isFiniteNumber(value) ? value : null;
}

function rangeFor(values: Array<number | null>) {
  const finite = values.filter(isFiniteNumber);
  if (finite.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...finite), max: Math.max(...finite) };
}

function buildScoringContext(profile: MatchUserProfile, neighborhoods: NeighborhoodData[]): ScoringContext {
  const commutePreference = getCommutePreference(profile);
  const workplaceName =
    "workplace" in profile && typeof (profile as UserProfile).workplace === "string"
      ? ((profile as UserProfile).workplace.trim() || null)
      : null;
  const lifestyle =
    "lifestyle" in profile && Array.isArray((profile as UserProfile).lifestyle)
      ? (profile as UserProfile).lifestyle
      : [];
  return {
    profile: {
      budgetCeiling: parseBudgetCeiling(profile),
      commutePreference,
      weights: normalizeWeights(profile),
      workplaceName,
      shortCommuteMode: lifestyle.includes("Short commute"),
    },
    ranges: {
      safety: rangeFor(neighborhoods.map((n) => rawDimensionValue(n, "safety"))),
      transit: rangeFor(neighborhoods.map((n) => rawDimensionValue(n, "transit"))),
      affordability: rangeFor(neighborhoods.map((n) => rawDimensionValue(n, "affordability"))),
      cityServices: rangeFor(neighborhoods.map((n) => rawDimensionValue(n, "cityServices"))),
      entertainment: rangeFor(neighborhoods.map((n) => rawDimensionValue(n, "entertainment"))),
      commuteMinutes: rangeFor(neighborhoods.map((n) => getCommuteMinutes(n, commutePreference))),
    },
  };
}

function budgetFit(neighborhood: NeighborhoodData, budgetCeiling: number | null) {
  const rent = getRent(neighborhood);
  if (rent === null || budgetCeiling === null || budgetCeiling <= 0) return null;
  if (rent <= budgetCeiling) return 1;
  return clamp01(1 - (rent - budgetCeiling) / budgetCeiling);
}

function dimensionScore(
  neighborhood: NeighborhoodData,
  dimension: MatchDimension,
  context: ScoringContext,
) {
  const raw = rawDimensionValue(neighborhood, dimension);
  const normalizedRaw = raw === null ? 0.5 : normalize(raw, context.ranges[dimension].min, context.ranges[dimension].max);

  if (dimension === "affordability") {
    const fit = budgetFit(neighborhood, context.profile.budgetCeiling);
    return fit === null ? normalizedRaw : normalizedRaw * 0.55 + fit * 0.45;
  }

  if (dimension === "transit") {
    const minutes = getCommuteMinutes(neighborhood, context.profile.commutePreference);
    if (minutes === null) return normalizedRaw;
    const shortCommute = context.profile.shortCommuteMode;
    // "Short commute" lifestyle tag: steeper exponential decay + commute dominates transit infrastructure
    const decayConstant = shortCommute ? 15 : 30;
    const commuteFitWeight = shortCommute ? 0.85 : 0.65;
    const relativeCommuteFit = 1 - normalize(minutes, context.ranges.commuteMinutes.min, context.ranges.commuteMinutes.max);
    const absolutePenalty = Math.exp(-minutes / decayConstant);
    const commuteFit = relativeCommuteFit * 0.6 + absolutePenalty * 0.4;
    return normalizedRaw * (1 - commuteFitWeight) + commuteFit * commuteFitWeight;
  }

  return normalizedRaw;
}

function mergeDescriptors(labels: string[], existing: readonly string[] | undefined) {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const label of [...labels, ...(existing ?? [])]) {
    const normalized = label.trim();
    if (!normalized || seen.has(normalized.toLowerCase())) continue;
    seen.add(normalized.toLowerCase());
    merged.push(normalized);
    if (merged.length === 3) break;
  }

  return merged;
}

function buildMatchDescriptors(
  neighborhood: NeighborhoodData,
  componentScores: Record<MatchDimension, number>,
  context: ScoringContext,
): string[] {
  const labels: string[] = [];
  const commuteMin = getCommuteMinutes(neighborhood, context.profile.commutePreference);
  const rent = getRent(neighborhood);
  const budget = context.profile.budgetCeiling;

  if (commuteMin !== null) {
    const name = context.profile.workplaceName;
    labels.push(name ? `~${commuteMin} min from ${name}` : `~${commuteMin} min commute`);
  }

  if (rent !== null && rent > 0) {
    if (budget !== null && rent <= budget) {
      labels.push(`Est. $${rent.toLocaleString()}/mo — fits your budget`);
    } else if (budget !== null && rent > budget) {
      labels.push(`Est. $${rent.toLocaleString()}/mo — over budget`);
    }
  } else if (budgetFit(neighborhood, budget) !== null) {
    labels.push("Fits budget");
  }

  if (componentScores.safety > 0.68) labels.push("Low crime rate");
  else if (componentScores.safety < 0.35) labels.push("Higher crime area");

  if (commuteMin === null && componentScores.transit > 0.7) labels.push("Strong transit access");
  if (componentScores.entertainment > 0.75) labels.push("Active dining scene");
  if (componentScores.cityServices > 0.75) labels.push("Fast city services");

  return labels.slice(0, 3);
}

function buildMatchReason(
  neighborhood: NeighborhoodData,
  componentScores: Record<MatchDimension, number>,
  context: ScoringContext,
): string {
  const parts: string[] = [];
  const commuteMin = getCommuteMinutes(neighborhood, context.profile.commutePreference);
  const rent = getRent(neighborhood);
  const budget = context.profile.budgetCeiling;

  if (commuteMin !== null) {
    const name = context.profile.workplaceName;
    parts.push(name ? `~${commuteMin} min from ${name}` : `~${commuteMin} min commute`);
  }

  if (rent !== null && rent > 0 && budget !== null && rent <= budget) {
    parts.push(`est. $${rent.toLocaleString()}/mo`);
  }

  if (componentScores.safety > 0.68) parts.push("low crime");
  else if (componentScores.safety < 0.35) parts.push("higher crime — check the data");

  if (commuteMin === null && componentScores.transit > 0.65) parts.push("strong transit access");
  if (componentScores.entertainment > 0.75) parts.push("active dining & nightlife");
  if (componentScores.cityServices > 0.75) parts.push("fast city services");

  if (parts.length === 0) return "Matches your priority settings";

  const sentence = parts.join(" · ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/**
 * Rank neighborhoods by weighted fit. The internal score is used only for
 * sorting and is deliberately not returned.
 */
export function rankNeighborhoodMatches(
  profile: MatchUserProfile,
  neighborhoods: NeighborhoodData[],
  topN = 5,
): NeighborhoodMatch[] {
  if (topN <= 0 || neighborhoods.length === 0) return [];

  const context = buildScoringContext(profile, neighborhoods);

  return neighborhoods
    .map((neighborhood, index) => {
      const componentScores = DIMENSIONS.reduce(
        (scores, dimension) => ({
          ...scores,
          [dimension]: dimensionScore(neighborhood, dimension, context),
        }),
        {} as Record<MatchDimension, number>,
      );

      const fitScore = DIMENSIONS.reduce(
        (sum, dimension) => sum + context.profile.weights[dimension] * componentScores[dimension],
        0,
      );

      return {
        neighborhood,
        index,
        fitScore,
        descriptors: buildMatchDescriptors(neighborhood, componentScores, context),
        matchReason: buildMatchReason(neighborhood, componentScores, context),
      };
    })
    .sort((a, b) => b.fitScore - a.fitScore || a.index - b.index)
    .slice(0, topN)
    .map(({ neighborhood, descriptors, matchReason }) => ({
      communityAreaNumber: neighborhood.communityAreaNumber,
      name: neighborhood.name,
      slug: neighborhood.slug,
      descriptors,
      matchReason,
    }));
}

function avg(values: number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function toNeighborhoodData(
  areas: AreaRow[],
  areaIdByNumber: Map<number, string>,
  crimeByAreaId: Map<string, number>,
  transitByAreaId: Map<string, number>,
  responseDaysByAreaId: Map<string, number>,
  entertainmentByAreaId: Map<string, number>,
  rentByAreaId: Map<string, number | null>,
): NeighborhoodData[] {
  const avgCrime = avg([...crimeByAreaId.values()].filter((value) => value > 0));
  const avgTransit = avg([...transitByAreaId.values()].filter((value) => value > 0));
  const avgResponse = avg([...responseDaysByAreaId.values()].filter((value) => value > 0));
  const avgEntertainment = avg([...entertainmentByAreaId.values()].filter((value) => value > 0));
  const avgRent = avg([...rentByAreaId.values()].filter((v): v is number => v !== null && v > 0));

  return areas.map((area) => {
    const areaId = areaIdByNumber.get(area.community_area_number);
    const crime = areaId ? crimeByAreaId.get(areaId) : undefined;
    const transit = areaId ? transitByAreaId.get(areaId) : undefined;
    const responseDays = areaId ? responseDaysByAreaId.get(areaId) : undefined;
    const entertainment = areaId ? entertainmentByAreaId.get(areaId) : undefined;
    const rent = areaId ? (rentByAreaId.get(areaId) ?? null) : null;

    return {
      communityAreaNumber: area.community_area_number,
      name: area.name,
      slug: area.slug,
      descriptors: area.descriptors ?? [],
      scores: {
        crime: crime ?? avgCrime,
        transit: transit ?? avgTransit,
        // affordability omitted — rawDimensionValue falls through to -rent from housing
        cityServices: responseDays === undefined ? -avgResponse : -responseDays,
        entertainment: entertainment ?? avgEntertainment,
      },
      housing: { averageRent: rent ?? avgRent },
    };
  });
}

export async function matchNeighborhoods(
  profile: MatchUserProfile,
  topN = 5,
): Promise<NeighborhoodMatch[]> {
  if (!hasSupabaseCredentials()) return [];

  const supabase = createSupabaseAdminClient();

  const { data: city } = await supabase.from("cities").select("id").eq("slug", "chicago").single();
  if (!city) return [];
  const cityId = (city as { id: string }).id;

  // Single query: areas + their IDs together
  const { data: areas } = await supabase
    .from("community_areas")
    .select("id, community_area_number, name, slug, population, descriptors")
    .eq("city_id", cityId)
    .returns<(AreaRow & { id: string })[]>();

  if (!areas?.length) return [];

  const areaIdByNumber = new Map(areas.map((a) => [a.community_area_number, a.id]));
  const allIds = areas.map((a) => a.id);
  const year = 2024;
  const month = 10;

  const [crimeRes, transitRes, serviceRes, entRes, housingRes] = await Promise.all([
    supabase
      .from("crime_monthly")
      .select("community_area_id, incident_count")
      .eq("city_id", cityId)
      .eq("year", year)
      .eq("month", month)
      .in("community_area_id", allIds)
      .returns<CrimeRow[]>(),
    supabase
      .from("transit_monthly")
      .select("community_area_id, bus_ridership, l_ridership")
      .eq("city_id", cityId)
      .eq("year", year)
      .eq("month", month)
      .in("community_area_id", allIds)
      .returns<TransitRow[]>(),
    supabase
      .from("service_requests_311_monthly")
      .select("community_area_id, avg_response_days")
      .eq("city_id", cityId)
      .eq("year", year)
      .eq("month", month)
      .in("community_area_id", allIds)
      .returns<ServiceRow[]>(),
    supabase
      .from("entertainment_metrics")
      .select("community_area_id, restaurants, bars")
      .eq("city_id", cityId)
      .eq("year", year)
      .in("community_area_id", allIds)
      .returns<EntRow[]>(),
    supabase
      .from("housing_metrics")
      .select("community_area_id, affordable_units, avg_rent_estimate")
      .eq("city_id", cityId)
      .eq("year", year)
      .in("community_area_id", allIds)
      .returns<HousingRow[]>(),
  ]);

  const populationById = new Map(areas.map((a) => [a.id, a.population]));
  const crimeByAreaId = new Map(
    (crimeRes.data ?? []).map((row) => {
      const pop = populationById.get(row.community_area_id);
      const rate = pop && pop > 0 ? (row.incident_count / pop) * 10_000 : row.incident_count;
      return [row.community_area_id, rate];
    }),
  );
  const transitByAreaId = new Map(
    (transitRes.data ?? []).map((row) => [row.community_area_id, row.bus_ridership + row.l_ridership]),
  );
  const responseDaysByAreaId = new Map((serviceRes.data ?? []).map((row) => [row.community_area_id, row.avg_response_days]));
  const entertainmentByAreaId = new Map(
    (entRes.data ?? []).map((row) => [row.community_area_id, row.restaurants + row.bars]),
  );
  const rentByAreaId = new Map(
    (housingRes.data ?? []).map((row) => [row.community_area_id, row.avg_rent_estimate]),
  );

  let neighborhoods = toNeighborhoodData(
    areas,
    areaIdByNumber,
    crimeByAreaId,
    transitByAreaId,
    responseDaysByAreaId,
    entertainmentByAreaId,
    rentByAreaId,
  );

  // Blend workplace proximity into commute dimension when workplace is recognized.
  // Uses straight-line distance with Chicago-typical speed proxies:
  //   transit  ≈ 8 min/mile  (accounts for waiting, transfers, indirect routing)
  //   driving  ≈ 4 min/mile  (Chicago average ~15 mph in traffic)
  const workplaceCoords = resolveWorkplaceCoords(profile);
  if (workplaceCoords) {
    const coordByNumber = new Map(getAllCoordinates().map((c) => [c.communityAreaNumber, c]));
    neighborhoods = neighborhoods.map((n) => {
      const coord = coordByNumber.get(n.communityAreaNumber);
      if (!coord) return n;
      const miles = distanceMiles(workplaceCoords, { lat: coord.lat, lng: coord.lng });
      return {
        ...n,
        commute: {
          transitMinutes: Math.round(miles * 8),
          drivingMinutes: Math.round(miles * 4),
        },
      };
    });
  }

  return rankNeighborhoodMatches(profile, neighborhoods, topN);
}
