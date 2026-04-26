# Project Proposal: CityLiving Sim

## One-Line Description
A city-portable neighborhood life simulator that lets users experience what living in any neighborhood would actually be like over 12 months — using real civic open data, a PyTorch crime prediction model, and AI-generated narratives. Launching with Chicago (20+ years of data, 77 community areas), architected to scale to any US city with a Socrata open data portal — and globally to any municipality publishing open civic data.

## The Problem
Every platform that helps you choose a neighborhood — Zillow, Niche, Trulia, NeighborhoodScout — gives you a snapshot: a score, a grade, a static number. But choosing where to live isn't about a number. It's about what your daily life will feel like: how crowded your train is at 8am, whether the city fixes the pothole on your street, whether crime on your block is getting better or worse as the months go by.

No tool simulates lived experience. You get a letter grade and figure it out yourself.

This problem is universal. Someone moving to Austin, NYC, or London faces the exact same information gap — and increasingly, the data to solve it is publicly available. Over 200 US cities publish civic data through Socrata portals, and open data initiatives are expanding globally.

I want to build the platform that lets you experience a year in a neighborhood before you sign a lease — starting with Chicago, designed to work anywhere.

## Target User
- **Primary:** Anyone considering a move — within a city, to a new city, or across borders. This includes renters whose lease is up, first-time homebuyers, job-switchers re-optimizing commute, and relocating professionals. In Chicago alone, ~100K households move annually.
- **Secondary:** First-generation renters and immigrants without local knowledge of any city's neighborhoods — a global audience as open data expands.
- **Tertiary:** Urban planners, city council staff, journalists, and researchers studying neighborhood equity and city service disparities. The same data pipeline that powers a personal simulation also powers civic analysis: "Which neighborhoods have the worst 311 response times?" is one query away.
- **Future:** As the platform expands to more cities, the total addressable audience scales with every city onboarded — there are 50M+ annual moves in the US alone.

Chicago is the launch city because I have 20+ years of rich civic data and a built-in test audience (UChicago). But the platform is city-agnostic by design.

## Core Features (v1 — Chicago Launch)

1. **User profile creation** — Set your budget, workplace location, commute preferences, and what matters most to you (safety, transit, affordability, city services). Saved via Clerk auth.
2. **12-month neighborhood simulation** — Pick a neighborhood and get a month-by-month simulation of your year: crime incidents near your address, transit commute patterns, 311 service response times, and seasonal trends. Each month is a data-grounded narrative, not a guess.
3. **AI-generated narratives + ASCII month cards** — An AI narrative agent transforms structured simulation data into readable month-by-month stories that cite specific numbers ("Month 4: A 311 pothole report on your street took 18 days to resolve. The city average is 5.2 days"). Each month also renders an auto-generated ASCII scene card driven by the same structured data — a visual companion to the text, not decoration.
4. **Simulation comparison** — Run simulations for 2-3 neighborhoods side by side. See which one fits your priorities across the full year, not just today's snapshot.
5. **Interactive map** — City map color-coded by personalized fit (based on your profile weights). Click any neighborhood to launch a simulation.

## Tech Stack
- **Frontend:** Next.js (App Router) — SSR for fast initial load, client-side interactivity for simulation timeline
- **Styling:** Tailwind CSS + shadcn/ui — clean, accessible components
- **Database:** Supabase (Postgres) — stores time-series civic data, user profiles, simulation results, model predictions. Multi-city schema: all tables are partitioned by `city_id`, so adding a new city means inserting rows, not changing the schema.
- **Auth:** Clerk — user accounts, saved simulations, comparison history
- **City Configuration Layer:** Each city is defined by a JSON config file that maps generic data categories (crime, transit, 311, housing, neighborhoods) to that city's specific Socrata API endpoints, column names, and geographic boundary files. Adding a new city = writing one config file + ingesting data. No code changes required.
- **APIs (Chicago launch):** Socrata Open Data API (free, all endpoints verified accessible):
  - Crimes: `https://data.cityofchicago.org/resource/ijzp-q8t2.json`
  - Affordable Housing: `https://data.cityofchicago.org/resource/s6ha-ppgi.json`
  - CTA Rail Ridership: `https://data.cityofchicago.org/resource/5neh-572f.json`
  - CTA Bus Ridership: `https://data.cityofchicago.org/resource/t2rn-p8d7.json`
  - 311 Service Requests: `https://data.cityofchicago.org/resource/v6vf-nfxy.json`
  - Community Boundaries: `https://data.cityofchicago.org/resource/igwz-8jzy.json`
- **Socrata Portability:** 200+ US cities use Socrata (NYC, LA, SF, Seattle, Austin, etc.). The platform's data ingestion pipeline speaks SoQL (Socrata Query Language) natively — onboarding a new Socrata city is a config change, not a code change. For non-Socrata cities (international), a pluggable adapter interface allows custom data connectors.
- **AI/Narrative:** LLM-powered narrative agent that converts structured simulation data into readable monthly stories. Grounded in retrieved data — the agent explains numbers, it doesn't invent them. City-aware prompt templates adapt tone and context per locale.
- **Visual layer (v1: ASCII scene cards):** Each month card renders an auto-generated ASCII scene alongside the narrative — small fixed-template scenes (bus stop, train platform, snowy street) with data-driven badges (crowding meter, crime count glyph, 311 backlog bar). Deterministic, no API cost, renders in any browser. Uses the same structured data the narrative cites, so visuals stay in sync with the story. Programmatic SVG and AI-generated per-month images are stretch, not v1.
- **ML Inference:** FastAPI on Render (free tier) — serves a PyTorch crime trend model (temporal convolutional network trained on 7M+ crime records for Chicago). Model architecture is city-agnostic — retrain on any city's historical crime data to produce city-specific predictions.
- **Deployment:** Vercel (frontend) + Render (ML endpoint)
- **MCP Servers:** Supabase MCP for database management during development

## How the Simulation Engine Works

The simulation is not an LLM generating fiction. It is a structured data pipeline:

```
User Profile (budget, workplace, priorities)
        +
Selected Neighborhood
        │
        ▼
┌─────────────────────────────────┐
│  Simulation Engine (server)     │
│                                 │
│  For each of 12 months:        │
│  1. Query crime_monthly table   │
│     → actual crime counts by    │
│       type for that area/month  │
│  2. Query transit_metrics       │
│     → ridership, peak crowding  │
│  3. Query service_requests      │
│     → 311 response times,       │
│       complaint types           │
│  4. Query housing_units         │
│     → affordable inventory      │
│  5. (Stretch) For forward       │
│     months: call PyTorch        │
│     endpoint → predicted trend  │
│  6. Apply user's priority       │
│     weights to compute          │
│     monthly experience score    │
│  7. Send structured data to     │
│     narrative agent → readable  │
│     monthly story               │
└─────────────────────────────────┘
        │
        ▼
12-month simulation with:
  - Monthly narrative (AI-generated from real data)
  - Monthly ASCII scene card (data-bound visual)
  - Monthly experience scores
  - Year-end summary + recommendation
  - Comparison-ready structured output
```

Key design decisions:
- **Agents don't generate facts** — they receive structured data (numbers, rankings) and produce natural-language explanations citing those numbers. This minimizes hallucination.
- **Historical months use actual data** — no modeling needed for months that already happened.
- **Forward-looking months are stretch (Week 7-8)** — when shipped, they use PyTorch predictions clearly labeled with confidence intervals. v1-v2 cover historical months only.
- **Simulations are deterministic for the same inputs** — reproducible, auditable.

## Stretch Goals
- **Forward-looking predictions (Week 7-8):** The final months of each simulation use a PyTorch temporal model trained on historical crime data to predict where the neighborhood is heading. Predictions include confidence scores and which crime types are driving the trend. Moved out of v1 to keep the Week 5-6 critical path narrow; the model architecture and training data are still part of the project plan.
- **Neighborhood health dashboard:** For existing residents, track your current neighborhood's trajectory over time. Get notified when trends shift significantly (crime spike, transit service change, 311 response degradation). Separate product surface from the simulation; not needed to demo the core idea.
- **Programmatic SVG visuals:** Sparklines and icon rows sized by ridership, layered on top of the v1 ASCII cards.
- **AI-generated per-month images:** One small image per month via image API. Highest visual impact but adds cost, latency, and a new failure mode.
- **Recommendation agent:** AI agent that takes your profile and suggests which neighborhoods to simulate first, with reasoning
- **Seasonal deep dive:** Click any month to see detailed breakdown (crime by type, transit by hour, 311 by category)
- **Historical playback:** "What would living here have been like in 2015?" — run the simulation on historical data
- **Shareable simulations:** Generate a link to share your simulation results with friends
- **Regime change alerts:** Email notification when a saved neighborhood's trajectory changes significantly
- **Cross-city comparison:** "Compare Lincoln Park (Chicago) vs. Williamsburg (NYC)" — same simulation framework, different data sources
- **Civic equity dashboard:** Aggregate view for journalists/planners — surface systemic disparities (e.g., "South Side 311 response times are 3.2x slower than North Side") across any onboarded city

## Scaling Roadmap

### Phase 1: Chicago (Final Project — Now)
Full platform with 20+ years of data across 77 community areas. Prove the simulation concept, ML pipeline, and narrative engine work end-to-end.

### Phase 2: US Expansion (Post-Launch)
Onboard 5-10 major US Socrata cities (NYC, LA, SF, Seattle, Austin). Each city requires:
- One city config JSON (API endpoints, column mappings, geographic boundaries)
- Data ingestion run (automated pipeline pulls historical data into Supabase)
- ML model retraining on that city's crime data (same architecture, new weights)
- No frontend or simulation engine changes

**Why this is feasible:** All target cities already publish crime, 311, transit, and housing data through Socrata with similar schemas. The heavy engineering is done once in Phase 1.

### Phase 3: Global Expansion (Future)
International cities with open data portals (London, Toronto, Sydney, Berlin) publish similar civic datasets through non-Socrata platforms. The pluggable adapter interface built in Phase 2 handles this — each new data platform gets one adapter, then any city on that platform can be onboarded via config.

**Scale potential:** 200+ US cities on Socrata alone. The Open Data Index tracks 2,600+ government open data portals worldwide. Every portal that publishes crime, transit, and service request data is a potential city on the platform.

## Biggest Risk
**Narrative quality.** The AI-generated monthly narratives could feel robotic or repetitive across 12 months x 77 neighborhoods. Mitigation: use structured templates with intentional variation, inject specific data points into every sentence, and supplement with LLM for natural phrasing. I will prototype one full 12-month narrative by hand before building the engine — if the manual version isn't compelling, adjust the concept before investing in infrastructure.

**Secondary risk:** PyTorch model accuracy. If the crime prediction model doesn't beat a naive baseline (last year's trend continues), the forward-looking months lose credibility. Mitigation: benchmark against the baseline early (Week 6). If the model underperforms, fall back to statistical trend extrapolation — the simulation still works, just without the ML narrative.

**Scaling risk:** Data heterogeneity across cities. Not every city publishes the same data categories, and column names/formats vary. Mitigation: the city config layer defines which data categories are available per city — simulations gracefully degrade (e.g., a city without transit data skips transit narratives instead of failing). The core simulation works with any subset of the four data categories (crime, transit, 311, housing).

**Simulation integration risk.** The full data → query → narrative agent → ASCII card → render pipeline has not been built end-to-end yet. Most blockers in this kind of project show up at the integration seams, not inside any single component. Mitigation: ship the Vertical Slice MVP (below) before broad data ingestion begins. Per TA feedback, approach from both sides — engine and data layer — concurrently, so blockers surface in Week 4-5 rather than Week 7.

## v1 Goal (Week 6)

Per the class rubric ("start small with an end-to-end v1 and continue layering features each week") and per TA feedback ("lightweight, well-defined, narrow-scoped — maybe just riding the bus in Hyde Park"), v1 ships the **thinnest possible end-to-end thread** through the entire pipeline.

- **Scope:** Hyde Park × CTA bus ridership only × October 2024 × one persona (UChicago student commuter). One neighborhood, one dataset, one month.
- **End-to-end deliverable:** A single web page that, on button click, renders one **month card** containing:
  1. A structured data block (October 2024 ridership for Hyde Park bus routes, peak crowding hour, week-over-week delta)
  2. An AI-generated narrative paragraph that cites those numbers
  3. An ASCII scene card (stylized bus stop + crowding meter glyph) driven by the same structured data
- **Required infrastructure (only what v1 needs):** Next.js app + Supabase (one ingested table for Oct 2024 CTA bus + Hyde Park route filter) + LLM API call for narrative + ASCII card generator + Vercel deploy.
- **Explicitly NOT in v1:** Clerk auth, user profiles, neighborhood browser, interactive map, historical charts, comparison view, multiple months, multiple neighborhoods, multiple data categories, PyTorch model. All of these layer on in v2-v4.
- **Why this slice:** Bus ridership is the simplest dataset (no geocoding), Hyde Park is the launch neighborhood (data sanity-check is trivial), one month sidesteps time-series complexity. If any of the four pipeline hand-offs (data → query → narrative agent → ASCII render) breaks at narrow scope, it would have broken at full scope too — better to find out in Week 6 than Week 9.

## Version Arc (v1 → v4)

The class arc runs v1 (Week 6) → v4 (Week 9 project fair). Each version layers features onto the v1 thread without rewriting it.

- **v1 (Week 6) — End-to-end thread.** Hyde Park × CTA bus × October 2024. One rendered month card. Pipeline proven.
- **v2 (Week 7) — Temporal expansion.** Same neighborhood, full 12 months. Add 311 service requests and crime as additional data categories. Three month cards stitched into a year view.
- **v3 (Week 8) — Spatial expansion + users.** Expand to ~5 neighborhoods. Add Clerk auth, user profile (budget/workplace/priorities), and side-by-side comparison of two neighborhoods. Interactive map for navigation.
- **v4 (Week 9 — project fair) — Full Chicago + polish.** All 77 community areas. Polished demo flow. Stretch: PyTorch forward-looking predictions for the final months of each simulation if the model beats the naive baseline.
