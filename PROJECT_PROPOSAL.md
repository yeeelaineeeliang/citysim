# Project Proposal: Chicago Living Sim

## One-Line Description
A neighborhood life simulator that lets users experience what living in any Chicago neighborhood would actually be like over 12 months — using 20+ years of real civic data, a PyTorch crime prediction model, and AI-generated narratives — deployed as a live web app anyone can use.

## The Problem
Every platform that helps you choose a neighborhood — Zillow, Niche, Trulia, NeighborhoodScout — gives you a snapshot: a score, a grade, a static number. But choosing where to live isn't about a number. It's about what your daily life will feel like: how crowded your train is at 8am, whether the city fixes the pothole on your street, whether crime on your block is getting better or worse as the months go by.

No tool simulates lived experience. You get a letter grade and figure it out yourself.

I want to build the tool that lets you experience a year in a neighborhood before you sign a lease.

## Target User
- **Primary:** Graduate students and young professionals relocating to Chicago (every incoming UChicago cohort is hundreds of people)
- **Secondary:** First-generation renters without family knowledge of Chicago neighborhoods
- **Tertiary:** Journalists and researchers studying neighborhood equity and city service disparities

These are real people I can reach. I can walk into any UChicago orientation event and hand them a URL.

## Core Features (v1)

1. **User profile creation** — Set your budget, workplace location, commute preferences, and what matters most to you (safety, transit, affordability, city services). Saved via Clerk auth.
2. **12-month neighborhood simulation** — Pick a neighborhood and get a month-by-month simulation of your year: crime incidents near your address, CTA commute patterns, 311 service response times, and seasonal trends. Each month is a data-grounded narrative, not a guess.
3. **AI-generated narratives** — An AI narrative agent transforms structured simulation data into readable month-by-month stories that cite specific numbers. "Month 4: A 311 pothole report on your street took 18 days to resolve. The city average is 5.2 days — your area has slow infrastructure response."
4. **Simulation comparison** — Run simulations for 2-3 neighborhoods side by side. See which one fits your priorities across the full year, not just today's snapshot.
5. **Interactive map** — Chicago map color-coded by personalized fit (based on your profile weights). Click any neighborhood to launch a simulation.

## Tech Stack
- **Frontend:** Next.js (App Router) — SSR for fast initial load, client-side interactivity for simulation timeline
- **Styling:** Tailwind CSS + shadcn/ui — clean, accessible components
- **Database:** Supabase (Postgres) — stores time-series civic data, user profiles, simulation results, model predictions. 11 tables with foreign key relationships.
- **Auth:** Clerk — user accounts, saved simulations, comparison history
- **APIs:** Chicago Socrata API (free, all endpoints verified accessible):
  - Crimes: `https://data.cityofchicago.org/resource/ijzp-q8t2.json`
  - Affordable Housing: `https://data.cityofchicago.org/resource/s6ha-ppgi.json`
  - CTA Rail Ridership: `https://data.cityofchicago.org/resource/5neh-572f.json`
  - CTA Bus Ridership: `https://data.cityofchicago.org/resource/t2rn-p8d7.json`
  - 311 Service Requests: `https://data.cityofchicago.org/resource/v6vf-nfxy.json`
  - Community Boundaries: `https://data.cityofchicago.org/resource/igwz-8jzy.json`
- **AI/Narrative:** LLM-powered narrative agent that converts structured simulation data into readable monthly stories. Grounded in retrieved data — the agent explains numbers, it doesn't invent them.
- **ML Inference:** FastAPI on Render (free tier) — serves a PyTorch crime trend model (temporal convolutional network trained on 7M+ crime records). Feeds predicted crime trends into forward-looking simulation months.
- **Deployment:** Vercel (frontend) + Render (ML endpoint)
- **MCP Servers:** Supabase MCP for database management during development

## Stretch Goals
- **Forward-looking predictions:** The final months of each simulation use a PyTorch temporal model trained on 20+ years of crime data to predict where the neighborhood is heading, not just where it's been. Predictions include confidence scores and which crime types are driving the trend.
- **Recommendation agent:** AI agent that takes your profile and suggests which neighborhoods to simulate first, with reasoning
- **Seasonal deep dive:** Click any month to see detailed breakdown (crime by type, transit by hour, 311 by category)
- **Historical playback:** "What would living here have been like in 2015?" — run the simulation on historical data
- **Shareable simulations:** Generate a link to share your simulation results with friends
- **Regime change alerts:** Email notification when a saved neighborhood's trajectory changes significantly

## Biggest Risk
**Narrative quality.** The AI-generated monthly narratives could feel robotic or repetitive across 12 months x 77 neighborhoods. Mitigation: use structured templates with intentional variation, inject specific data points into every sentence, and supplement with LLM for natural phrasing. I will prototype one full 12-month narrative by hand before building the engine — if the manual version isn't compelling, adjust the concept before investing in infrastructure.

**Secondary risk:** PyTorch model accuracy. If the crime prediction model doesn't beat a naive baseline (last year's trend continues), the forward-looking months lose credibility. Mitigation: benchmark against the baseline early (Week 6). If the model underperforms, fall back to statistical trend extrapolation — the simulation still works, just without the ML narrative.

## Week 5 Goal
Working Next.js app deployed on Vercel with:
1. Supabase connected with pre-loaded time-series data (crime monthly, transit metrics, 311 response times per community area)
2. User profile creation via Clerk (budget, workplace, priorities)
3. Neighborhood browser — search/filter neighborhoods by key metrics
4. Neighborhood detail page with historical charts (crime trend, 311 response times, transit ridership over time)
5. Basic Chicago map with community area boundaries

No simulation engine yet in Week 5. Data layer and user profile come first. Simulation builds on top starting Week 6.
