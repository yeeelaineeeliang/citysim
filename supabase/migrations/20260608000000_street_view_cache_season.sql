-- Add season column to street_view_cache and update unique constraint
-- to support one cached image per neighborhood per season (4 headings).

ALTER TABLE public.street_view_cache
  ADD COLUMN IF NOT EXISTS season TEXT
    CHECK (season IN ('spring', 'summer', 'autumn', 'winter'))
    NOT NULL DEFAULT 'spring';

-- Replace single unique index with season-aware one
DROP INDEX IF EXISTS public.street_view_cache_lookup_idx;
CREATE UNIQUE INDEX IF NOT EXISTS street_view_cache_season_idx
  ON public.street_view_cache (city_id, community_area_id, season);
