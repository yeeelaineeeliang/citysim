# CityLiving Sim

> Experience a neighborhood before you sign a lease.

CityLiving Sim is a neighborhood life simulator for people deciding where to live in Chicago. Instead of static scores (Zillow, Niche, Trulia), it places the user *inside* a neighborhood and runs a year-long simulation of what daily life there actually feels like — grounded in real civic data, never invented.

The user sets a personal profile (budget, workplace, commute preference, lifestyle priorities), selects a neighborhood, and gets a month-by-month simulated year rendered as a second-person narrative. Every answer the conversational agent gives is assembled from real queried data. The agent narrates data — it does not hallucinate it.

**Mental model:** closer to Google Street View than to Zillow. You are spatially located inside the neighborhood, not evaluating it from outside.

---

## Architecture

```
User Profile (budget · workplace · commute · priorities · lifestyle)
        +
Selected Neighborhood (community area)
        │
        ▼
┌──────────────────────────────────────────────┐
│              Simulation Engine               │
│                                              │
│  1. Route question to tool(s)                │
│     - query_crime(neighborhood, month)       │
│     - query_transit(neighborhood, month)     │
│     - query_311(neighborhood, month)         │
│     - query_housing(neighborhood)            │
│     - query_entertainment(neighborhood)      │
│     - get_neighborhood_profile(neighborhood) │
│  2. Query Supabase with structured params    │
│  3. Receive real data results                │
│  4. Assemble context for LLM                 │
│  5. LLM narrates in second-person present    │
│  6. Return grounded narrative response       │
└──────────────────────────────────────────────┘
        │
        ▼
Month-by-month simulation output:
  · Second-person narrative ("your commute," "your block")
  · No raw numbers as headlines — experience language only
  · Session history accumulates across months
  · Year summary at month 12
```

**Hallucination guardrail:** The agent cannot answer a civic question without first calling a tool and receiving real data. Empty results surface explicitly ("311 data for this neighborhood in this month is sparse") rather than silently filling in.

**Data sources:**

*Local CSVs — already downloaded, $0, processed via PySpark:*
- Crimes — 2001 to Present
- 311 Service Requests
- Affordable Rental Housing Developments
- Boundaries — Community Areas
- CCA 2025
- CTA L Station Entries — Daily Totals
- CTA L Station Entries — Monthly Day-Type Averages & Totals
- CTA Bus Routes — Daily Totals by Route
- CTA L Stops

*Chicago Data Portal — API or direct download, $0:*

- Business Licenses (Active) — `uupf-x98q` — restaurants & bars by neighborhood
- Chicago Parks (CPD) — `ejsh-fztr` — park amenities
- Library Locations & Hours — `x8fc-8rcq` — civic amenity proximity
- Farmers Markets — `atzs-u7pv` — lifestyle signal (deferred)

*External APIs:*

- Ticketmaster Discovery API — local events (deferred, free tier)
- Google Maps Street View Static API — neighborhood visual layer (pay-as-you-go, ~$0 with free trial credit)

**Narrative generation** (three-tier cascade):
1. Groq — `llama-3.3-70b-versatile` (primary, free tier)
2. Anthropic — `claude-haiku-4-5-20251001` (secondary)
3. Deterministic fallback — no API key required

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase (Postgres) |
| Auth | Clerk |
| LLM (primary) | Groq — `llama-3.3-70b-versatile` |
| LLM (fallback) | Anthropic — `claude-haiku-4-5-20251001` |
| Visual layer | Google Maps Street View Static API (cached in Supabase) |
| Data pipeline | PySpark (local processing of raw CSVs) |
| Deployment | Vercel |

---

## Getting Started

```bash
npm install
cp .env.example .env.local   # fill in required keys (see below)
npm run dev
```

Open `localhost:3000/sim` → set your profile → pick a neighborhood → start simulating.

---

## Environment Variables

```
# LLM
GROQ_API_KEY=                        # primary (free at console.groq.com)
ANTHROPIC_API_KEY=                   # fallback

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=     # Street View Static API only — restrict to Websites

# Optional
SOCRATA_APP_TOKEN=                   # increases Socrata rate limits
```

---

## Current State (Week 2 of 4)

**Exists (v1 pipeline proof):**
- Hyde Park · full year 2024 · 3 data sources (crime, 311, CTA transit)
- LLM narrative with three-tier fallback + grounding/citation validation
- Two UIs: `/v2` (static 12-month card view) and `/prototype` (conversational flow, Hyde Park only)

**Being built now (Week 2):**
- Full Supabase schema (12+ tables for all data categories)
- LLM tool-use agent (6 named tools, strict tool-call requirement before any civic response)
- User profile onboarding (budget, workplace, commute preference, lifestyle checkboxes, free-text notes)
- Neighborhood selector (all 77 Chicago community areas)
- Street View Static API integration with Supabase cache; Skybox gradient as fallback
- New `/sim` route: profile → pick/match neighborhood → month timeline → grounded chat

**Week 2 end goal:** Hyde Park works end-to-end. Profile → pick neighborhood → ask a question → get a real grounded answer with Street View image.
