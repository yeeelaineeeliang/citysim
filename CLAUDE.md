# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository, which builds **LivingThere** (formerly "CityLiving Sim" / "citySim") — the repo directory and `package.json`'s prior `cityliving-sim` name are the only leftover traces of the old name; the deployed Vercel URL (`citysim-gamma.vercel.app`) is unchanged since renaming it is a platform action, not a code edit.

**Last session (2026-07-22):** rewrote this file to match current state — the working tree on `feat/v4-full-implementation` has grown a run-history/archive feature, auth-gating (`AuthGateCard`), Supabase-backed rate limiting, an extracted `lib/verdict.ts`, and a real TypeScript civic-data ingestion pipeline, none of which were reflected here. Everything touched is still uncommitted (`git ls-files` shows zero history for these paths, including this file). Ran `npm run verify:civic` — civic tables are populated (924 rows each for the three monthly tables, 77 for the two yearly ones); see Known gaps. Renamed the product to LivingThere across `package.json`, README, page titles/metadata, in-app brand text, system prompts, and localStorage keys (`livingthere:user_profile`, `livingthere:profile_form` — old browser-saved profiles under the `citysim:` keys are now orphaned, harmless but won't be picked up).

## Commands

```bash
npm run dev          # start dev server with Turbopack (http://localhost:3000/sim)
npm run build        # production build
npm run typecheck    # TypeScript check (run before committing)
npm test             # Node test runner — runs lib/**/*.test.ts
npm run test:e2e     # Playwright end-to-end tests
```

Data ingestion scripts (require env vars and Supabase access):

```bash
npm run cache:street-view   # cache Google Street View URLs for all neighborhoods
npm run ingest:places       # ingest entertainment places
npm run ingest:cta-gtfs     # ingest CTA GTFS transit data
npm run preprocess          # preprocess local civic CSV data (PySpark)

# Civic data pipeline (scripts/ingest/, Socrata Chicago Data Portal, 2024 data)
npm run ingest:crime         # crime_monthly
npm run ingest:311           # service_requests_311_monthly
npm run ingest:transit       # transit_monthly
npm run ingest:housing       # housing_metrics
npm run ingest:entertainment # entertainment_metrics / entertainment_places
npm run ingest:civic         # umbrella: runs all five above, sequential, idempotent upserts
npm run verify:civic         # row-count sanity check per table (community_areas × 12 months) + Hyde Park spot-check
```

`scripts/ingest/shared.ts` holds the common Socrata fetch/retry/paging helpers; needs `SUPABASE_SERVICE_ROLE_KEY` and optionally `SOCRATA_APP_TOKEN`. This is a separate pipeline from the existing `npm run preprocess` PySpark flow — both write to the same civic tables.

---

## Fix priority order

1. Commit the working tree — everything below is currently uncommitted on `feat/v4-full-implementation`.
2. Decide whether `components/CityViewScene.tsx` / `lib/sunPosition.ts` (the 3D scene toggle) gets wired up or removed — it's been "kept in the repo" unwired for multiple sessions now.
3. Re-check demo copy (`DEMO_ACTS`/`DEMO_QA` in `lib/demoData.ts`) against the now-verified live civic numbers — it was last hand-seeded 2026-07-18 and should track real table values, not just be internally consistent.
4. Optional cleanup for the LivingThere rename: the local repo folder is still named `citySim` and the Vercel project/domain is still `citysim-gamma.vercel.app` — rename both (or a custom domain) if a consistent public name matters, since neither is a code change Claude Code can make.

---

## What is complete — do not touch

- **components/SimVerdict.tsx** — verdict screen with 3 signals (Budget Fit, Commute Reality, Lifestyle Match). Scoring now lives in `lib/verdict.ts`; the component just renders it. Links to `/runs?highlight={savedRunId}` when a run was saved. Do not modify.
- **lib/verdict.ts** — `computeVerdict()`, the 3-signal (budget/commute/lifestyle) heuristic, versioned via `VERDICT_VERSION`. Shared by `SimVerdict.tsx` (live) and `lib/simRuns.ts` (frozen snapshot at save time, so history reflects what the user actually saw even if the heuristic changes later). Complete.
- **lib/simRuns.ts + app/api/runs/ + app/runs/** — "My year archive" feature. `saveSimRun` / `listSimRuns` / `getSimRun` persist completed cinematic runs to the `sim_runs` table, scoped to `clerk_user_id`. `app/runs/RunsClient.tsx` lists saved runs and supports picking two to compare side-by-side (rent/commute/crime/311 + verdict signals). Gated by `hasSupabaseCredentials()`, fails soft. Complete.
- **app/sim/AuthGateCard.tsx** — inline Clerk sign-in/sign-up prompt with a "keep previewing" dismiss. Shown when a signed-out user tries to start a run (`SeasonTicket`) or chat (debrief panel in `SimClient`). Complete.
- **app/sim/hooks/usePrefersReducedMotion.ts** — a11y hook wrapping `matchMedia("(prefers-reduced-motion: reduce)")`; used by `SeasonalAtmosphere` to keep the tint layer but skip particle motion. Complete.
- **lib/matchRankColors.ts** — color/opacity/stroke-weight lookup by neighborhood match rank (1st green, 2nd gold, 3rd silver, 4th+ charcoal, tapering opacity). Used by `ProfileOnboardingPreviewMap`, `SimClient`, `CommunityAreaBlockMap`. Complete.
- **app/sim/types.ts** — all type definitions (SimAct, ActSeason, ACT_SEASON, ACT_MONTH, RunState). Complete.
- **lib/tools/types.ts** — all tool result types. Complete.
- **lib/apiSecurity.ts** — Clerk auth, rate limiting (now Supabase-backed, see Auth section below), request validation including `validateSimRunBody` for `/api/runs`. Complete.
- **app/api/sim-month/route.ts** — SSE streaming endpoint. Complete.
- **lib/chat.ts → runMonthFullStream + buildSimNarrationPrompt** — 7 tools in parallel, Groq streaming, seasonal Chicago context injected per act, deterministic fallback, Sam persona banned-phrase rule. Complete.
- **lib/tools/query_311.ts** — Hyde Park stubs → Chicago default → NO_DATA fallback. Complete.
- **components/CartoonAvatar.tsx** — SVG avatar, 4 seasonal variants, 4 body states, expressive face. Complete.

---

## Known gaps

- **Civic data is populated** (verified 2026-07-22 via `npm run verify:civic`): `crime_monthly`, `transit_monthly`, `service_requests_311_monthly` each have 924 rows (77 community areas × 12 months); `housing_metrics` and `entertainment_metrics` each have 77 rows (yearly). Hyde Park spot-check passed (crime, 311, transit, housing, entertainment all returned real 2024 values) — tools should now be hitting live data for these five, not stub fallbacks. `entertainment_places` (POI-level, separate from `entertainment_metrics`) and `cta_bus_ridership_v1` weren't covered by this check — re-run `verify:civic` after any re-ingestion.
- **street_view_cache warms lazily** per request (needs `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` at runtime) or via `npm run cache:street-view`.
- **Demo cinematic mode** runs on canned data (`DEMO_ACTS` in `lib/demoData.ts`) because all API routes are auth-gated and 401 for signed-out demo users. DEMO_ACTS and DEMO_QA numbers are seeded from the real 2024 civic tables (re-seeded 2026-07-18) — if the data is re-ingested, re-check the demo copy against Hyde Park's rows. Hyde Park has no in-boundary L station; rail references are Metra Electric, never "Red Line at 55th". This is independent of the ingestion-pipeline work above — demo mode intentionally never calls live tools.
- **Sam persona rule** (`lib/chat.ts`): responses must never contain data-report phrases ("coarse estimate", "not a CTA itinerary", "does not return", …). Tests in `lib/chat.agent-quality.test.ts` enforce this via regex — update tests and prompt together.
- **CityViewScene / lib/sunPosition.ts** — the 3D scene toggle remains unwired (see Fix priority order above). `lib/sunPosition.ts` wraps `suncalc` for sun azimuth/altitude → Mapbox light position; only consumed by `CityViewScene.tsx` and `MapillaryStreetView.tsx`.

**components/SimPlayerMap.tsx**
- Avatar animation loop (6.5s home→work→evening→home), camera, POI dots look correct
- Depends on /api/community-areas and /api/places — both exist; if either fails, boundary and POI layers silently fail (avatar still animates)

### Cinematic background layers

The 4-act hero layer stacks, bottom to top: seasonal gradient (always) → `CinematicStreetPano` (live drifting Mapillary pano, non-interactive, mounted once per run) → cached Google seasonal Street View img (priority when available) → `ACT_TINT` (season + time-of-day, 2s crossfade) → `SeasonalAtmosphere` (CSS particles: petals/sun haze/leaves/snow, skipped under reduced-motion; keyframes `sim-fall`/`sim-glow`/`sim-act-fade` in globals.css). `CinematicStreetPano` is also reused as the `SeasonTicket` interstitial backdrop, not just an in-run layer. `/api/mapillary-image` is deliberately not auth-gated so demo mode gets real imagery.

---

## Dead code — do not revive

- **app/sim/hooks/useSimRun.ts** — old 12-month runner, not imported anywhere. Leave it.
- **components/SeasonTransitionCard.tsx** — not mounted in cinematic mode. Leave it.

---

## Locked product decisions — never change these without explicit instruction

- **4 acts only** (Spring / Summer / Autumn / Winter) — no 12-month click-through
- **Street View is full-bleed background** — the hero layer, not a thumbnail
- **CartoonAvatar on Leaflet minimap** — 200×200px overlay, bottom-right corner
- **Acts advance on data signal thresholds** — not a timer
- **Whole simulation runs 1-2 minutes** without user interaction after pressing play
- **Ends with SimVerdict** — 3 personalized signals, no overall score
- **Every narrative sentence grounded in real tool data** — no civic claim without a tool result
- **Avatar uses Option B style** — warm, expressive, friendly illustrated character with seasonal outfit swaps

## Act structure

| Act | Season | Time of day | Data trigger |
|-----|--------|-------------|--------------|
| 1 | Spring | Morning | Baseline — simulation opens here |
| 2 | Summer | Midday | Entertainment activity peaks |
| 3 | Autumn | Late afternoon | 311 requests climb |
| 4 | Winter | Night | Heating complaints + transit delays spike |
| Final | — | — | SimVerdict: 3 personalized signals |

## Avatar seasonal outfits — CartoonAvatar.tsx
| Season | Outfit | Face |
|--------|--------|------|
| Spring | Light jacket, bag | Neutral, hopeful |
| Summer | T-shirt, sunglasses | Slight smile |
| Autumn | Hoodie, scarf | Slightly tired |
| Winter | Heavy coat, hat | Worried, cold |

---

## Architecture

### Product flow

Profile onboarding → neighborhood matching → simulation step. A `JourneyRail` 4-stage progress nav (Shape your life → Choose a place → Live the year → Make the call) is mounted across onboarding, the season-ticket interstitial, `SimVerdict`, and `RunsClient` so the user always knows where they are.

The simulation step has two modes:
The journey is simulate-first: match map ("Live a year in {n} →") → **season-ticket interstitial** (`app/sim/SeasonTicket.tsx`, `idleView: "interstitial"`, `CinematicStreetPano` backdrop) with "▶ Begin your year" primary and "Skip — just ask questions" opt-out → cinematic run → verdict with three next steps (Ask Sam / Try another neighborhood / Compare my seasons) → **debrief**.

Starting a run or opening chat while signed out shows `AuthGateCard` instead (Clerk sign-in/sign-up + "keep previewing" dismiss) — `useSimAct.startAutoRun()` sets `authPrompt: "year"` and skips the run rather than calling an API route that will 401.

- **Cinematic 4-act mode**: `useSimAct` streams one act per season (Spring April / Summer July / Autumn October / Winter January). Each act fetches a Street View background image, streams narrative from `/api/sim-month`, and feeds `actDataSummaries` to `SimVerdict` at the end. On completion of a real (non-demo) run, `useSimAct` fires `POST /api/runs` to persist it and exposes the resulting `savedRunId`, which `SimVerdict` uses to link to `/runs?highlight={savedRunId}` ("Compare saved years"). `/sim?demo=1&autorun=1` (the landing demo CTA) starts the run with no interaction and never persists (demo runs skip the auth gate and the save call).
- **Debrief mode** (`idleView: "debrief"`): the two-panel screen, post-run. Chat context is set by **4 season chips** (via `changeMonth(ACT_MONTH[act])` — the Jan–Dec month strip is gone); header shows "Debrief with Sam" after a completed run, "Ask Sam about {n}" for skippers. "Run the year again" lives in the header. `useSimAct` distinguishes `exitToDebrief()` (preserves run history/`savedRunId`, used after a completed run) from `stopAutoRun()` (full reset, used when bailing mid-run). Scene toggle is Street/Map only (CityViewScene is unwired but kept in the repo). Chat is powered by the two-stage `lib/chat.ts` agent: a routing prompt selects tools, then a narration prompt turns results into second-person prose.
- **Run archive mode** (`app/runs/`): standalone page, not part of the `useSimAct` state machine. Lists a signed-in user's saved runs (`GET /api/runs`) and lets them select two to compare (rent/commute/crime/311 + verdict signals per neighborhood), reached via `SimVerdict`'s "Compare saved years" link or direct navigation.

### Request flow for AI responses

All AI routes are Clerk-authenticated. The pattern is identical across routes:

```
API route (app/api/*)
  → requireApiUser() + rateLimitRequest()        (lib/apiSecurity.ts)
  → validateBriefBody() / validateChatBody()      (lib/apiSecurity.ts)
  → executeToolCall() × N in parallel             (lib/tools/executor.ts)
  → buildMapActions()                             (lib/mapActions.ts)
  → Groq streaming / runMonthFullStream()         (lib/chat.ts)
  → SSE chunks back to client
```

The client drains SSE events in `useSimAct.ts`: a `tools` event arrives first (with map actions and data summary), then `chunk` events accumulate narrative text, then `done`.

`app/api/runs/route.ts` (POST save / GET list) and `app/api/runs/[id]/route.ts` (GET one, UUID-validated) follow the same auth+rate-limit+validate pattern but call `lib/simRuns.ts` instead of the tool/chat pipeline — no LLM involved.

### Tool architecture

Seven tools live in `lib/tools/`:

| Tool | File | Fallback when DB absent |
|---|---|---|
| `query_crime` | `query_crime.ts` | hardcoded monthly stubs |
| `query_transit` | `query_transit.ts` | hardcoded stubs |
| `query_311` | `query_311.ts` | Hyde Park 2024 stubs → Chicago default |
| `query_commute` | `query_commute.ts` | OSRM or estimate |
| `query_housing` | `query_housing.ts` | estimates |
| `query_entertainment` | `query_entertainment.ts` | local JSON / OSM |
| `get_neighborhood_profile` | `get_neighborhood_profile.ts` | static descriptions |

All tools degrade gracefully — they never throw to the caller. `executor.ts` routes the LLM's tool-call names to the correct function.

### Key files

| File | Responsibility |
|---|---|
| `app/sim/SimClient.tsx` | Top-level sim page: orchestrates all 3 steps, renders cinematic 4-act UI |
| `app/sim/hooks/useSimAct.ts` | 4-act simulation runner: SSE drain, prefetch next act, street view URL fetch, auth-gating, run persistence, `exitToDebrief()`/`stopAutoRun()` |
| `app/sim/hooks/useSimChat.ts` | Sam Q&A (idle mode): sends messages, streams responses |
| `app/sim/hooks/useSimProfile.ts` | Profile onboarding and neighborhood matching |
| `app/sim/hooks/usePrefersReducedMotion.ts` | a11y: reduced-motion detection, gates `SeasonalAtmosphere` |
| `app/sim/hooks/useSimRun.ts` | **Dead code** — old 12-month runner, not wired up |
| `app/sim/AuthGateCard.tsx` | Sign-in/sign-up prompt shown when a signed-out user tries to start a run or chat |
| `app/sim/SeasonTicket.tsx` | Season-ticket interstitial before a run starts (`CinematicStreetPano` backdrop, profile chips, season preview) |
| `app/sim/types.ts` | `SimAct`, `ActSeason`, `ACT_SEASON`, `ACT_MONTH`, `RunState` |
| `app/sim/helpers.ts` | `SIM_YEAR`, `ALL_NEIGHBORHOODS`, `createSimMessage`, `bearingTo` |
| `app/api/runs/route.ts`, `app/api/runs/[id]/route.ts` | Save/list/get persisted runs — `lib/simRuns.ts`, no LLM |
| `app/runs/page.tsx`, `app/runs/RunsClient.tsx` | Run archive page: list + two-run comparison |
| `lib/chat.ts` | `runMonthFullStream` + `buildSimNarrationPrompt` + chat agent |
| `lib/verdict.ts` | `computeVerdict()` — 3-signal scoring, versioned via `VERDICT_VERSION` |
| `lib/simRuns.ts` | `saveSimRun` / `listSimRuns` / `getSimRun` — `sim_runs` table CRUD |
| `lib/matchRankColors.ts` | Map color/opacity/stroke by neighborhood match rank |
| `lib/sunPosition.ts` | `suncalc` wrapper → Mapbox light position; feeds the unwired `CityViewScene` |
| `lib/mapActions.ts` | Builds `MapAction` objects from tool results |
| `lib/streetView.ts` | `getStreetViewImageForSeason` — DB cache + Google Street View URL construction |
| `lib/apiSecurity.ts` | Clerk auth, per-user/IP rate limiting (Supabase-backed with in-memory fallback), all request body validators including `validateSimRunBody` |
| `lib/tools/types.ts` | All shared interfaces: `UserProfile`, `DataSummary`, `MapAction`, tool result types |
| `lib/tools/executor.ts` | Routes LLM tool-call names to the correct query function |
| `components/SimVerdict.tsx` | Verdict screen — COMPLETE, do not touch |
| `components/SimPlayerMap.tsx` | Animated Leaflet minimap with CartoonAvatar daily journey (6.5s loop) |
| `components/CartoonAvatar.tsx` | SVG avatar: 4 seasonal variants × 4 body states |
| `components/JourneyRail.tsx` | 4-stage progress nav, mounted across onboarding/SeasonTicket/SimVerdict/RunsClient |
| `components/CinematicStreetPano.tsx` | Live drifting Mapillary pano — in-run background layer and SeasonTicket backdrop |
| `components/SeasonalAtmosphere.tsx` | CSS particle weather layer (petals/haze/leaves/snow), reduced-motion aware |

### Prompt structure

`lib/chat.ts` has two distinct prompt builders:

- `buildNarrationPrompt` — idle chat agent. Sam speaks as a long-time resident; numbers translated into experience, never led with.
- `buildSimNarrationPrompt` — 4-act simulation. Second person, present tense, 3 paragraphs (morning/commute, safety/street feel, evening/weekend). Seasonal Chicago context injected via `SEASONAL_CONTEXT` map keyed by `actContext`.

LLM: Groq `llama-3.3-70b-versatile`, temperature 0.35, max_tokens 700. Falls back to `deterministicResponse` if `GROQ_API_KEY` is absent.

### Street View

`lib/streetView.ts` constructs Google Street View Static API URLs. Seasonal variants use different headings (spring=0°, summer=90°, autumn=180°, winter=270°). Results are cached in Supabase `street_view_cache`. The season column and unique index are added by migration `supabase/migrations/20260608000000_street_view_cache_season.sql`.

### Database

Supabase Postgres. Schema is in `supabase/schema.sql`; unapplied migrations live in `supabase/migrations/`. `lib/supabase.ts` exports `hasSupabaseCredentials()` — every DB-touching function gates on this and falls through to stub data when credentials are absent.

Tables in `supabase/schema.sql` (17), grouped:

| Group | Tables |
|---|---|
| Core | `cities`, `community_areas` |
| User / session | `user_profiles`, `simulation_sessions`, `conversation_messages`, `sim_runs` |
| Civic data | `crime_monthly`, `transit_monthly`, `service_requests_311_monthly`, `housing_metrics`, `entertainment_metrics`, `entertainment_places`, `cta_bus_ridership_v1` |
| Geo | `wards`, `community_area_ward_overlap` |
| Infra | `street_view_cache`, `model_predictions`, `demo_qa_cache`, `rate_limits` |

Migrations, chronological:

| Migration | Purpose |
|---|---|
| `20260511000000_create_simulation_sessions.sql` | `simulation_sessions` — Clerk-user session/conversation storage |
| `20260512000000_harden_session_lookup.sql` | Index on `simulation_sessions` for clerk_user/area/year lookup |
| `20260522000000_create_entertainment_places.sql` | `entertainment_places` — food/bar/park/civic/entertainment POIs |
| `20260524000000_create_ward_tables.sql` | `wards` (Chicago's 50 wards) + `community_area_ward_overlap` (GIS M:N) |
| `20260608000000_street_view_cache_season.sql` | Adds `season` column + unique index to `street_view_cache` |
| `20260717000000_rate_limits.sql` | `rate_limits` table + `rate_limit_hit()` RPC — atomic upsert-based limiter with opportunistic GC |
| `20260718000000_create_sim_runs.sql` | `sim_runs` — persisted run history (RLS enabled, service-role only) |

### Auth

All `/api/*` routes call `requireApiUser()` from `lib/apiSecurity.ts`. Rate limiting is Supabase-backed first — `checkRateLimitSupabase()` calls the `rate_limit_hit()` RPC against the `rate_limits` table with an 800ms timeout — falling back to the original in-memory per-process `Map` only when Supabase credentials are absent or the RPC is slow/erroring. The `/sim/demo` route bypasses auth in the client hooks via `isDemoMode`.

---

## Agent safety rules

Do not read, print, edit, or commit `.env` files, secret files, or credential exports. Do not run Supabase migrations, SQL writes, or destructive git commands without explicit approval. See `AGENTS.md` for the full list.
