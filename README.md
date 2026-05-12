# CityLiving Sim

Vercel: https://citysim-gamma.vercel.app/

**Feel a neighborhood before you sign a lease.**

CityLiving Sim helps people choose where to live in Chicago by turning civic data into a practical, personal preview of daily life. Instead of scanning static scores or generic neighborhood blurbs, users enter their budget, workplace, commute preference, and lifestyle priorities, then explore how a neighborhood would actually work for them.

The product combines maps, Street View imagery, neighborhood matching, and a grounded AI advisor. It can answer questions like:

- Can I afford to live here?
- What would my commute to UChicago feel like?
- Is this neighborhood safe at night?
- How responsive is the city when things break?
- What would a normal month here look like?

Every civic answer is backed by tool-returned data. If the data is sparse, the app says so instead of filling the gap with confident fiction.

## Why It Is Useful

Choosing a neighborhood is not just a rent calculation. It is commute friction, street safety, city services, transit reliability, local amenities, and the feel of ordinary routines.

CityLiving Sim brings those pieces together in one place:

- **Personal fit:** budget, workplace, commute mode, and priorities shape the recommendation.
- **Grounded answers:** the chat agent must query structured tools before narrating.
- **Lived-experience output:** numbers are translated into practical signals, not dumped as raw stats.
- **Spatial context:** neighborhood maps and Street View help users inspect where they might live.
- **Chicago-wide coverage:** all 77 community areas are represented.

## Product Flow

1. Create a profile with budget, workplace, commute preference, and lifestyle priorities.
2. Get matched with neighborhoods or choose one manually.
3. Explore the neighborhood on a map with workplace context.
4. Move through a month-by-month simulation.
5. Ask grounded follow-up questions about safety, affordability, commute, housing, 311, and amenities.

## How It Works

CityLiving Sim uses a tool-first agent architecture:

```text
User profile + selected neighborhood
        |
        v
Question router
        |
        v
Structured tools
  - crime
  - housing
  - transit
  - commute
  - 311 services
  - entertainment
  - neighborhood profile
        |
        v
Grounded narrative response
```

The agent is designed to be direct and useful. For example, affordability answers compare the user budget to loaded rent estimates and clarify that subsidized-housing counts are database stock, not current vacancies. Commute answers separate neighborhood transit access from exact door-to-door route planning.

## Tech Stack

| Layer | Technology |
|---|---|
| App framework | Next.js App Router |
| Language | TypeScript |
| UI | React, Tailwind CSS |
| Auth | Clerk |
| Database | Supabase Postgres |
| Maps | React Leaflet, OpenStreetMap |
| Street imagery | Google Maps Street View Static API |
| Geocoding | Photon / OpenStreetMap |
| LLM | Groq primary, optional Anthropic fallback, deterministic fallback |
| Data pipeline | PySpark and Chicago civic datasets |

## Data Sources

The app uses Chicago civic data, including:

- Crimes
- 311 service requests
- Affordable rental housing developments
- CTA rail and bus ridership
- CTA stops and route data
- Community area boundaries
- Business licenses, parks, libraries, and amenity data

The product is built for decision support, not legal, financial, or real estate advice. Live rental availability, lease terms, exact CTA routing, and current safety conditions should still be checked before making a housing decision.

## Run Locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000/sim](http://localhost:3000/sim).

## Environment Variables

```bash
# LLM
GROQ_API_KEY=
ANTHROPIC_API_KEY=

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Street View
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=

# Optional civic API rate-limit helper
SOCRATA_APP_TOKEN=
```

The app can still return deterministic fallback responses when LLM keys are missing, but the full AI advisor experience requires `GROQ_API_KEY`.

## Scripts

```bash
npm run dev              # start local development server
npm run build            # production build
npm run start            # run production server
npm run typecheck        # TypeScript check
npm test                 # Node test runner
npm run ingest:v1        # ingest CTA proof dataset
npm run preprocess       # preprocess local civic data
npm run cache:street-view # cache Street View imagery
```

## Status

CityLiving Sim currently supports the core simulation loop: profile onboarding, workplace geocoding, neighborhood matching, interactive maps, month-based exploration, Street View context, and grounded chat. The next product step is a polished demo mode with pre-validated neighborhood Q&A for fast review and presentation.
