/**
 * Neighborhood matching ranks Chicago community areas against a user profile.
 *
 * Numeric fit scores are intentionally kept private to this module. Public
 * results expose only ranked order and descriptor labels.
 */

import { createSupabaseAdminClient, hasSupabaseCredentials } from "@/lib/supabase";
import type { UserProfile } from "@/lib/tools/types";

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
}

type ScoringContext = {
  profile: {
    budgetCeiling: number | null;
    commutePreference: CommutePreference;
    weights: Record<MatchDimension, number>;
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

interface StatsRow {
  neighborhood_id: number;
  affordable_housing_units: number;
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
  return {
    profile: {
      budgetCeiling: parseBudgetCeiling(profile),
      commutePreference,
      weights: normalizeWeights(profile),
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
    const commuteFit = 1 - normalize(minutes, context.ranges.commuteMinutes.min, context.ranges.commuteMinutes.max);
    return normalizedRaw * 0.7 + commuteFit * 0.3;
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
) {
  const weightedDimensions = DIMENSIONS
    .map((dimension) => ({
      dimension,
      value: componentScores[dimension] * context.profile.weights[dimension],
    }))
    .sort((a, b) => b.value - a.value);

  const labels: string[] = [];
  const rentFit = budgetFit(neighborhood, context.profile.budgetCeiling);

  if (rentFit !== null && rentFit >= 0.98) labels.push("Fits budget");

  for (const { dimension } of weightedDimensions) {
    if (dimension === "safety") labels.push(componentScores.safety > 0.72 ? "Quiet" : "Safety fit");
    if (dimension === "transit") labels.push(componentScores.transit > 0.72 ? "Transit-rich" : "Commute fit");
    if (dimension === "affordability") labels.push("Affordable");
    if (dimension === "cityServices") labels.push("Responsive city services");
    if (dimension === "entertainment") labels.push("Dining & nightlife");
  }

  return mergeDescriptors(labels, neighborhood.descriptors);
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
      };
    })
    .sort((a, b) => b.fitScore - a.fitScore || a.index - b.index)
    .slice(0, topN)
    .map(({ neighborhood, descriptors }) => ({
      communityAreaNumber: neighborhood.communityAreaNumber,
      name: neighborhood.name,
      slug: neighborhood.slug,
      descriptors,
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
  affordableUnitsByNumber: Map<number, number>,
): NeighborhoodData[] {
  const avgCrime = avg([...crimeByAreaId.values()].filter((value) => value > 0));
  const avgTransit = avg([...transitByAreaId.values()].filter((value) => value > 0));
  const avgResponse = avg([...responseDaysByAreaId.values()].filter((value) => value > 0));
  const avgEntertainment = avg([...entertainmentByAreaId.values()].filter((value) => value > 0));
  const avgAffordable = avg([...affordableUnitsByNumber.values()].filter((value) => value > 0));

  return areas.map((area) => {
    const areaId = areaIdByNumber.get(area.community_area_number);
    const crime = areaId ? crimeByAreaId.get(areaId) : undefined;
    const transit = areaId ? transitByAreaId.get(areaId) : undefined;
    const responseDays = areaId ? responseDaysByAreaId.get(areaId) : undefined;
    const entertainment = areaId ? entertainmentByAreaId.get(areaId) : undefined;
    // More affordable_housing_units = more affordable options in the area
    const affordableUnits = affordableUnitsByNumber.get(area.community_area_number) ?? avgAffordable;

    return {
      communityAreaNumber: area.community_area_number,
      name: area.name,
      slug: area.slug,
      descriptors: area.descriptors ?? [],
      scores: {
        crime: crime ?? avgCrime,
        transit: transit ?? avgTransit,
        affordability: affordableUnits,
        cityServices: responseDays === undefined ? -avgResponse : -responseDays,
        entertainment: entertainment ?? avgEntertainment,
      },
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

  const [crimeRes, transitRes, serviceRes, entRes, statsRes] = await Promise.all([
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
      .from("neighborhood_stats")
      .select("neighborhood_id, affordable_housing_units")
      .returns<StatsRow[]>(),
  ]);

  const crimeByAreaId = new Map((crimeRes.data ?? []).map((row) => [row.community_area_id, row.incident_count]));
  const transitByAreaId = new Map(
    (transitRes.data ?? []).map((row) => [row.community_area_id, row.bus_ridership + row.l_ridership]),
  );
  const responseDaysByAreaId = new Map((serviceRes.data ?? []).map((row) => [row.community_area_id, row.avg_response_days]));
  const entertainmentByAreaId = new Map(
    (entRes.data ?? []).map((row) => [row.community_area_id, row.restaurants + row.bars]),
  );
  // neighborhood_stats uses community_area_number as neighborhood_id
  const affordableUnitsByNumber = new Map(
    (statsRes.data ?? []).map((row) => [row.neighborhood_id, row.affordable_housing_units]),
  );

  return rankNeighborhoodMatches(
    profile,
    toNeighborhoodData(
      areas,
      areaIdByNumber,
      crimeByAreaId,
      transitByAreaId,
      responseDaysByAreaId,
      entertainmentByAreaId,
      affordableUnitsByNumber,
    ),
    topN,
  );
}
