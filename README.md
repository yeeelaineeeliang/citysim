# CityLiving Sim

> Experience a neighborhood before you sign a lease.

CityLiving Sim is a neighborhood life simulator that turns real civic open data into a grounded, first-person account of what living somewhere actually feels like. Instead of letter grades and static scores, you get a month-by-month simulation of your commute, your block's service requests, and the safety pattern near your address — all rendered as a second-person narrative grounded in the numbers, never just reporting them.

Launching with Chicago (20+ years of data across 77 community areas), architected to port to any city that publishes data through a Socrata open data portal.

---

## Vision

Every tool that helps you choose a neighborhood — Zillow, Niche, Trulia — gives you a snapshot: a score, a grade, a static number. But choosing where to live is about what your daily life will *feel* like: how crowded your bus is at 8am, whether the city fixes the pothole on your street, whether crime on your block is trending up or down.

CityLiving Sim simulates that experience. You pick a neighborhood, set your priorities, and get a year of civic life rendered as narrative — not a dashboard.

---

## Architecture

```
User profile (workplace · budget · priorities)
        +
Selected neighborhood
        │
        ▼
┌─────────────────────────────────┐
│       Simulation Engine         │
│                                 │
│  1. Query CTA transit data      │
│  2. Query 311 service requests  │
│  3. Query crime records         │
│  4. Build week-by-week summary  │
│  5. Apply profile weights       │
│  6. Generate LLM narrative      │
└─────────────────────────────────┘
        │
        ▼
Month-by-month simulation:
  · Second-person narrative (no raw numbers as headlines)
  · Experiential callouts (frequency, crowding, neighborhood texture)
  · Week-by-week rhythm (crowding levels, not ride counts)
  · Experience score
```

**Data sources** (Chicago Socrata open data API):
- CTA Bus Ridership — `data.cityofchicago.org/resource/jyb9-n7fm.json`
- 311 Service Requests — `data.cityofchicago.org/resource/v6vf-nfxy.json`
- Crime Records — `data.cityofchicago.org/resource/ijzp-q8t2.json`

**Narrative generation** (three-tier cascade):
1. Groq — `llama-3.3-70b-versatile` (primary, free tier)
2. Anthropic — `claude-haiku-4-5-20251001` (secondary)
3. Deterministic fallback — no API key required

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Database | Supabase (Postgres) — caches Socrata data |
| LLM | Groq / Anthropic (cascading fallback) |
| Data | Chicago Socrata Open Data API |
| Deployment | Vercel |

---

## Getting Started

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Groq keys
npm run dev
```

Open `localhost:3000` → enter the prototype.

**Optional: pre-populate Supabase with CTA data**
```bash
npm run ingest:v1    # pulls Oct 2024 Hyde Park ridership
npm run verify:v1    # sanity check
```

---

## Environment Variables

```
GROQ_API_KEY=           # primary LLM (free tier at console.groq.com)
ANTHROPIC_API_KEY=      # secondary LLM (optional)
SUPABASE_URL=           # optional — falls back to live Socrata API
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SOCRATA_APP_TOKEN=      # optional — increases Socrata rate limits
```

---

## Current State (v2)

- Hyde Park · October 2024 · UChicago student commuter
- CTA bus ridership data, week-by-week breakdown
- LLM narrative that translates ridership into commute experience
- Interactive conversational prototype at `/prototype`

**v3 next:** 311 service request data · 5 neighborhoods · user profile
