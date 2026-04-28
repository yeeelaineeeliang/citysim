# CityLiving Sim — Version Plan

## The Root Problem (Diagnosis)

v1 answers: *"What happened to Hyde Park buses in October 2024?"*
The goal requires answering: *"What was my October in Hyde Park like?"*

Those are fundamentally different questions. The first is aggregate, third-person, statistical.
The second is specific, first-person, experiential. Every version in this arc closes that gap.

---

## Version Arc

### v1 (Week 1) — End-to-end pipeline
**Thesis:** Prove the pipeline works.

Scope: Hyde Park × CTA bus × October 2024 × one hardcoded persona.
Deliverable: One page, one button, three output columns (structured data, narrative, ASCII card).
Known gaps (intentional): persona is cosmetic, time is a monthly aggregate, output reads as a data report.

---

### v2 (Week 2) — First-person + temporal resolution
**Thesis:** The simulation starts to feel like *your* October, not a data report about Hyde Park.

Key changes:
1. **LLM narrative** — Replace deterministic templates with an actual LLM call (Anthropic/OpenAI).
   The agent receives structured data and writes first-person: *"You boarded the Route 6 bus 23 times this month..."*
   See PARKING_LOT.md for implementation options.
2. **Week-by-week breakdown** — Break the monthly aggregate into 4–5 weekly entries, each with its own narrative beat.
   The student persona now has meaning: week 3 is midterms, which affects commute patterns.
3. **Persona shapes data** — Filter to weekday AM rides; Route 6 (campus route) is the featured route.
4. **Kill raw JSON column** — Replace with a clean structured "month stats" panel. The user is experiencing a month, not debugging an API.

Still: Hyde Park only, CTA only.

---

### v3 (Week 3) — Multi-dimensional neighborhood + user identity
**Thesis:** The simulation starts to feel like a *neighborhood*, not just a commute.

Key changes:
1. **Add 311 and crime data** — Socrata endpoints already in project proposal. Daily entries now read:
   *"Your commute was crowded Tuesday; a pothole on 55th Street has been open 12 days."*
2. **Clerk auth + user profile** — Budget, workplace, priorities (safety / transit / services).
   Persona becomes structural: the simulation filters and weights data based on *your* inputs.
3. **~5 neighborhoods** — Hyde Park, Wicker Park, Logan Square, South Shore, Lincoln Park.
4. **Side-by-side comparison** — Run two simulations in parallel columns. Core product value.

---

### v4 (Week 4 — project fair) — Full Chicago + polish
**Thesis:** This is a real product, not a demo.

Key changes:
1. **All 77 community areas** — Architecture already supports it (community_area column, parameterized queries).
2. **Interactive map** — City map color-coded by profile fit. Click neighborhood → launch simulation.
3. **Full 12-month simulation** — Not just October 2024. The year view makes the pitch tangible.
4. **UI polish** — Remove developer artifacts, tighten visual language, make month cards feel product-quality.
5. **Stretch: PyTorch forward-looking months** — Only if model beats naive baseline. Don't block v4 on this.

---

## Critical Path Per Version

| Version | Core bet | Biggest risk |
|---|---|---|
| v2 | LLM narrative makes output feel first-person | Prompt quality — robotic/repetitive output still feels like a report |
| v3 | 311 + crime + user profile together create neighborhood texture | Data schema mismatch across Socrata endpoints |
| v4 | Map + comparison makes value prop immediately obvious | Ingesting 77 neighborhoods within one week |

**Prototype before building:** Write the ideal v2 narrative for one week by hand before engineering the LLM pipeline.
If the manual version isn't compelling, fix the concept first.
