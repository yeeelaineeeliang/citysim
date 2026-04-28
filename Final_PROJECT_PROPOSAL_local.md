# Project Proposal: CityLiving Sim

## One-Line Description
A neighborhood life simulator that puts you *inside* a year of living somewhere — using real civic open data, a grounded conversational agent, and a spatially-present UI — so you can ask "what is my commute actually like?" and get an answer drawn from 20 years of real data, not a score. Launching with Chicago (77 community areas), architected to scale to any city with open civic data.

## The Problem
Every platform that helps you choose a neighborhood — Zillow, Niche, Trulia, NeighborhoodScout — gives you a snapshot: a score, a grade, a static number. But choosing where to live isn't about a number. It's about what your daily life will feel like: how crowded your train is at 8am, whether the city fixes the pothole on your street, whether crime on your block is getting better or worse as the months go by.

No tool simulates lived experience. You get a letter grade and figure it out yourself.

The gap isn't data — Chicago alone has 20+ years of crime records, transit ridership, 311 service requests, and housing data, all publicly available. The gap is that no product translates that data into the felt texture of a year in a neighborhood. That's what this builds.

## The Vision: Simulation, Not Scoring

The product is best understood by contrast with what it is not.

**What existing tools do:** Score a neighborhood against your profile. Hyde Park gets a B+ for transit, a C for safety. You see a number and figure out what it means.

**What CityLiving Sim does:** Place you inside a neighborhood, in a specific month, and let you ask questions from that position. "What is my morning commute like?" returns a grounded, first-person answer drawn from actual CTA ridership data for that route in that month — not a transit score. "What happens if I need to report something broken on my block?" returns the actual 311 response time distribution for that neighborhood in that season. "Is November safe here?" returns the crime pattern for that specific area and time, narrated in plain language.

The mental model is closer to Google Street View than to Zillow: you are spatially located inside the neighborhood, not evaluating it from outside. The difference in feel is the entire product.

## Target User
- **Primary:** Anyone considering a move — within a city, to a new city, or across borders. This includes renters whose lease is up, first-time homebuyers, job-switchers re-optimizing commute, and relocating professionals. In Chicago alone, ~100K households move annually.
- **Secondary:** First-generation renters and immigrants without local knowledge of any city's neighborhoods — a global audience as open data expands.
- **Tertiary:** Urban planners, city council staff, journalists, and researchers studying neighborhood equity and city service disparities. The same data pipeline that powers a personal simulation also powers civic analysis: "Which neighborhoods have the worst 311 response times?" is one query away.
- **Future:** As the platform expands to more cities, the total addressable audience scales with every city onboarded — there are 50M+ annual moves in the US alone.

Chicago is the launch city because it has 20+ years of rich civic data and a built-in test audience (UChicago). But the platform is city-agnostic by design.

## Core Features

1. **Conversational simulation engine** — The primary product surface. After selecting a neighborhood and setting a persona (budget, workplace, commute priority), the user enters a conversational interface grounded in real civic data. They can ask anything about living there: commute patterns, seasonal crime trends, how fast the city responds to service requests, what a typical Tuesday feels like. Every answer is assembled from real queried data, not generated from model weights. The agent narrates the data — it does not invent it.

2. **Spatially-present UI** — The simulation environment communicates location, season, and time of day through a stylized illustrated street scene (CSS/SVG) that changes as the user moves through months. The user is not looking at a dashboard about Hyde Park — they are standing in Hyde Park in October. The scene changes with the month: winter empties the streets, summer fills them, midterms week crowds the bus stop. This spatial grounding is what makes the conversational layer feel like simulation rather than search.

3. **Month-by-month temporal progression** — The user moves through a year one month at a time, with the conversational context accumulating. Questions asked in October carry forward — if the user asked about crime in October, the November response can reference how it changed. By December the conversation reads like a journal of a year, not a Q&A session.

4. **User persona** — Budget, workplace location, commute preference, and priority weights (safety, transit, affordability, city services) are set at onboarding and carried through every response. The agent answers questions from the perspective of that specific person — "your commute," "your block," "your budget" — not generically.

5. **Neighborhood comparison** — Run the same conversational simulation for two neighborhoods. The comparison is not a side-by-side score table — it is the lived difference: "In Hyde Park, you asked about crime in November and learned X. In Logan Square, the same month looks like Y."

6. **Year summary** — After completing a simulation, a retrospective written in past tense: what worked, what was mixed, one thing to know. No overall score. Specific numbers from the actual simulation, not aggregated ratings.

7. **Interactive neighborhood map** — Entry point for exploration. Chicago's 77 community areas, with contextual descriptors. Click a neighborhood to enter its simulation. No fit scores on the map — descriptors only ("Campus · Quiet · Lakefront").

## Tech Stack
- **Frontend:** Next.js (App Router) — SSR for fast initial load, client-side interactivity for simulation environment
- **Styling:** Tailwind CSS + shadcn/ui — clean, accessible components
- **Simulation UI:** CSS/SVG illustrated street scenes, season- and time-aware, rendered deterministically from structured data. No image API dependency for the core visual layer — scenes are programmatic, not generated.
- **Database:** Supabase (Postgres) — stores time-series civic data, user profiles, simulation sessions, conversation history, model predictions. Multi-city schema: all tables partitioned by `city_id`.
- **Auth:** Clerk — user accounts, saved simulations, conversation history
- **City Configuration Layer:** Each city defined by a JSON config mapping generic data categories (crime, transit, 311, housing, neighborhoods) to that city's specific Socrata API endpoints, column names, and geographic boundary files. Adding a new city = writing one config file + ingesting data. No code changes required.
- **APIs (Chicago launch):** Socrata Open Data API (free, all endpoints verified accessible):
  - Crimes: `https://data.cityofchicago.org/resource/ijzp-q8t2.json`
  - Affordable Housing: `https://data.cityofchicago.org/resource/s6ha-ppgi.json`
  - CTA Rail Ridership: `https://data.cityofchicago.org/resource/5neh-572f.json`
  - CTA Bus Ridership: `https://data.cityofchicago.org/resource/t2rn-p8d7.json`
  - 311 Service Requests: `https://data.cityofchicago.org/resource/v6vf-nfxy.json`
  - Community Boundaries: `https://data.cityofchicago.org/resource/igwz-8jzy.json`
- **Conversational Agent:** LLM with structured tool use — the agent receives a question, routes it to the appropriate Supabase query (crime, transit, 311, or housing), receives structured results, and narrates them in first-person present tense. The agent cannot answer a civic question without first querying real data. This is the core hallucination guardrail.
- **ML Inference (stretch):** FastAPI on Render — serves a PyTorch crime trend model (temporal convolutional network trained on 7M+ Chicago crime records) for forward-looking months. City-agnostic architecture.
- **Deployment:** Vercel (frontend) + Render (ML endpoint)
- **MCP Servers:** Supabase MCP for database management during development

## How the Simulation Engine Works

The simulation is a grounded conversational agent, not a pre-rendered narrative pipeline.

```
User Persona (budget, workplace, priorities)
        +
Selected Neighborhood + Month
        │
        ▼
┌──────────────────────────────────────────┐
│  Conversational Agent (server)           │
│                                          │
│  User asks: "What is my commute like?"  │
│                                          │
│  Agent:                                  │
│  1. Identifies question category         │
│     → transit                            │
│  2. Queries transit_metrics table        │
│     → ridership, frequency, peak times   │
│     for this neighborhood × this month   │
│  3. Applies persona context              │
│     → workplace location, budget,        │
│        commute priority weight           │
│  4. Assembles structured data context    │
│  5. Narrates in first-person present     │
│     tense, citing specific numbers       │
│     ("You wait 6–8 minutes at peak...")  │
│  6. Stores Q&A in session history        │
│     → future answers can reference       │
│        what was asked before             │
└──────────────────────────────────────────┘
        │
        ▼
Conversational simulation with:
  - Every answer grounded in queried data
  - Persona-aware narration throughout
  - Session memory across months
  - Scene environment updating with month
  - Year summary generated from session
```

**Key design decisions:**

- **The agent queries before it answers** — no civic question is answered from model weights alone. The query result is assembled into the prompt context before narration begins. This is non-negotiable: it is what separates this from a chatbot that happens to talk about neighborhoods.
- **Tool use is the grounding mechanism** — the agent has discrete tools (query_crime, query_transit, query_311, query_housing) that must be called and return results before a response is generated. Failed or empty queries surface explicitly ("I don't have 311 data for this neighborhood in this month") rather than silently hallucinating.
- **Session history accumulates** — the conversation isn't stateless. October's Q&A is available context in November. This is what makes it feel like a year rather than a series of disconnected lookups.
- **Simulations are reproducible** — the same persona + neighborhood + month + question produces the same underlying data, even if the narration varies slightly.

## The UI Experience

The simulation environment has three layers working simultaneously:

**Layer 1 — Spatial scene (background):** A stylized illustrated street in Hyde Park. Time of day and season are visible. In October it's a warm morning, bus stop visible, moderate foot traffic. In December it's quieter, colder light. The scene is not photorealistic — it is evocative enough to communicate "I am somewhere" rather than "I am looking at a dashboard."

**Layer 2 — Conversational interface (foreground):** A chat-style input at the bottom of the scene. Suggested questions are surfaced based on the current month and persona ("What is my commute like this month?" / "Did anything happen on my block?" / "How is the city responding to requests here?"). The user can also ask anything freeform. Responses appear in the scene's context — not in a separate panel, but as part of the environment.

**Layer 3 — Month timeline (navigation):** A minimal month strip at the top. The user advances months deliberately — each month is a distinct "chapter" of the year. Advancing to a new month updates the scene and resets suggested questions, but preserves conversation history.

The overall feel: you are standing in a neighborhood, asking questions about your life there, and the answers are drawn from what actually happened.

## Biggest Risks

**1. Grounded conversational Q&A (primary risk — new)**
The hardest engineering problem in this project is not narrative quality — it is query routing and hallucination prevention in the conversational agent. The agent must correctly identify what kind of question is being asked, call the right tool, handle empty or sparse data gracefully, and never narrate facts it did not retrieve. This is where the vision lives or dies. Mitigation: implement tool-use with strict schema validation; empty query results surface as explicit uncertainty ("311 data for this block in this month is sparse — here's what the neighborhood average looks like"); build a test suite of question types with expected query patterns before building the UI on top.

**2. Demo failure modes (new)**
A live conversational agent querying real data can fail in a demo in ways a static UI never can: latency spikes, unexpected empty results, the agent going off-script. Mitigation: maintain a curated "demo mode" — a fixed set of 8-10 questions with pre-validated, pre-cached answers for Hyde Park × October–December, guaranteed to work end-to-end. The demo runs on this path. The live query path is exercised in development but the demo does not depend on it.

**3. Scene visual quality**
The illustrated street scene needs to communicate spatial presence without requiring an image generation API or significant design resources. If the scene feels like a placeholder, the whole "you are standing there" framing collapses. Mitigation: commit early to the CSS/SVG programmatic approach and prototype the scene before building the conversational layer on top of it. If the scene doesn't work at week 5, adjust the framing — but don't leave this as the last thing built.

**4. PyTorch model accuracy (stretch)**
If the crime prediction model doesn't beat a naive baseline, forward-looking months lose credibility. Mitigation: benchmark against baseline early. If the model underperforms, fall back to statistical trend extrapolation — the simulation still works for historical months.

**5. Data heterogeneity across cities (scaling)**
Not every city publishes the same data categories. Mitigation: the city config layer defines which tools are available per city — simulations gracefully degrade (a city without transit data skips transit questions instead of failing).

## Stretch Goals
- **Forward-looking months:** PyTorch temporal model predicts crime trend for months beyond available data. Predictions labeled with confidence intervals and surfaced in the conversational context ("Based on the past 3 years, November tends to see a 15% uptick in property crime in this area").
- **AI-generated scene images:** Replace CSS/SVG scenes with AI-generated per-month images. Higher visual impact, adds cost and latency.
- **Shareable simulations:** Generate a link to share your simulation session with someone else.
- **Historical playback:** "What would living here have been like in 2015?" — run the simulation on a different historical window.
- **Regime change alerts:** Notification when a saved neighborhood's data trajectory changes significantly.
- **Cross-city comparison:** Same simulation framework, different data sources — "Compare Lincoln Park (Chicago) vs. Williamsburg (NYC)."
- **Civic equity dashboard:** Aggregate view for journalists/planners — surface systemic disparities across any onboarded city.
- **Recommendation agent:** Takes your profile and suggests which neighborhoods to simulate first, with reasoning.

## Scaling Roadmap

### Phase 1: Chicago (Final Project — Now)
Full platform with 20+ years of data across 77 community areas. Prove the conversational simulation, grounded tool-use pipeline, and spatial UI work end-to-end.

### Phase 2: US Expansion (Post-Launch)
Onboard 5-10 major US Socrata cities (NYC, LA, SF, Seattle, Austin). Each city requires:
- One city config JSON (API endpoints, column mappings, geographic boundaries)
- Data ingestion run (automated pipeline pulls historical data into Supabase)
- ML model retraining on that city's crime data (same architecture, new weights)
- No frontend, agent, or simulation engine changes

### Phase 3: Global Expansion (Future)
International cities through non-Socrata platforms. The pluggable adapter interface handles this — one adapter per data platform, then any city on that platform is a config change.

## Version Arc

The build sequence is disciplined: the data pipeline and grounding infrastructure must exist before the conversational layer is built on top of it. The spatial UI can be prototyped in parallel but should not be mistaken for the product — the product is the grounded agent.

- **v1 — Pipeline proof:** Hyde Park × CTA bus × one month. One grounded Q&A exchange: user asks "what is my commute like?", agent queries real data, returns narrated answer. The scene is minimal (even a placeholder). The goal is proving the query → context assembly → narration chain works end-to-end with real data.
- **v2 — Temporal depth:** Full 12 months, all four data categories (crime, transit, 311, housing). Multiple question types working. Session history accumulating across months. Scene updating by season.
- **v3 — Spatial + multi-neighborhood:** Illustrated scene at full fidelity. 5 neighborhoods. Neighborhood comparison. Clerk auth, saved sessions.
- **v4 (project fair) — Full Chicago + polish:** All 77 community areas. Polished demo flow with curated demo mode. Stretch: PyTorch forward-looking months if model beats baseline.