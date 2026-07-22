// Podium system — distinct hue per rank; opacity and weight taper off below rank 3.
const RANK_GREEN    = "#476f63";
const RANK_GOLD     = "#a77e2e";
const RANK_SILVER   = "#7d8383";
const RANK_CHARCOAL = "#3b4143";
const WARM_WHITE    = "#fbf8f2";

// Badge pill constants kept sage so existing rank-badge icons are visually unchanged.
const BADGE_SAGE_STRONG = "#38564e";
const BADGE_SAGE        = "#6f9b8b";

const MATCH_RANK_COLORS         = [RANK_GREEN, RANK_GOLD, RANK_SILVER, RANK_CHARCOAL, RANK_CHARCOAL] as const;
const MATCH_RANK_FILL_OPACITIES = [0.92, 0.88, 0.75, 0.28, 0.18] as const;
const MATCH_RANK_STROKE_COLORS  = [RANK_GREEN, RANK_GOLD, RANK_SILVER, RANK_CHARCOAL, RANK_CHARCOAL] as const;
const MATCH_RANK_WEIGHTS        = [5, 3.5, 2.5, 1.5, 1] as const;

export const MATCH_RANK_SELECTED_SURFACE = BADGE_SAGE_STRONG;
export const MATCH_RANK_SELECTED_STROKE  = BADGE_SAGE_STRONG;
export const MATCH_RANK_BADGE_SURFACE    = WARM_WHITE;
export const MATCH_RANK_BADGE_TEXT       = BADGE_SAGE_STRONG;
export const MATCH_RANK_BADGE_STROKE     = BADGE_SAGE;

function rankIndex(rank: number) {
  if (!Number.isFinite(rank) || rank < 1) return MATCH_RANK_COLORS.length - 1;
  return Math.min(Math.floor(rank) - 1, MATCH_RANK_COLORS.length - 1);
}

export function matchRankColor(rank: number)       { return MATCH_RANK_COLORS[rankIndex(rank)]; }
export function matchRankFillOpacity(rank: number) { return MATCH_RANK_FILL_OPACITIES[rankIndex(rank)]; }
export function matchRankStrokeColor(rank: number) { return MATCH_RANK_STROKE_COLORS[rankIndex(rank)]; }
export function matchRankWeight(rank: number)      { return MATCH_RANK_WEIGHTS[rankIndex(rank)]; }
