"use client";

import { useState } from "react";

type RouteSummary = {
  route: string;
  totalRides: number;
  averageDailyRides: number;
  peakDate: string;
  peakRides: number;
};

type StructuredSimulationData = {
  neighborhood: string;
  communityArea: number;
  persona: string;
  month: string;
  source: string;
  totalRidesAcrossRoutes: number;
  routeTotals: RouteSummary[];
  highlightedRoute: RouteSummary;
  peakRidershipDay: {
    date: string;
    totalRides: number;
  };
  weekOverWeekDelta: {
    currentWindow: string;
    previousWindow: string;
    currentTotalRides: number;
    previousTotalRides: number;
    absoluteChange: number;
    percentChange: number;
    trend: "up" | "down" | "flat";
  };
};

type SimulationResult = {
  structuredData: StructuredSimulationData;
  narrative: string;
  asciiCard: string;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export default function HomePage() {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function runSimulation() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Simulation failed.");
      }

      setResult(body);
    } catch (caughtError) {
      setResult(null);
      setError(caughtError instanceof Error ? caughtError.message : "Simulation failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-8 sm:px-8 lg:px-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-6 py-7 shadow-[var(--shadow)] backdrop-blur sm:px-8 sm:py-9">
        <div className="absolute inset-x-0 top-0 h-2 bg-[linear-gradient(90deg,var(--accent),var(--rail),var(--accent))]" />
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--muted)]">
              CityLiving Sim v1
            </p>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-[color:var(--foreground)] sm:text-5xl">
                One month of Hyde Park bus life, grounded in CTA ridership data.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[color:var(--muted)] sm:text-lg">
                This v1 slice is hardcoded to Hyde Park, October 2024, and a UChicago student commuter.
                One button pulls the same structured data through three outputs: the ridership block, the
                grounded narrative, and the ASCII scene card. The narrative is deterministic in v1 so the
                slice stays testable without model credentials.
              </p>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[color:var(--panel-border)] bg-white/55 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
            <div className="space-y-2 text-sm text-[color:var(--muted)]">
              <p>Neighborhood: Hyde Park</p>
              <p>Community Area: #41</p>
              <p>Data source: CTA Bus Ridership only</p>
              <p>Time window: October 2024</p>
              <p>Persona: UChicago student commuter</p>
            </div>
            <button
              type="button"
              onClick={runSimulation}
              disabled={isLoading}
              className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-wait disabled:opacity-75"
            >
              {isLoading ? "Running simulation..." : "Run my October in Hyde Park"}
            </button>
            {error ? <p className="mt-4 text-sm text-[color:var(--accent-strong)]">{error}</p> : null}
          </div>
        </div>
      </section>

      {result ? (
        <section className="mt-8 rounded-[2rem] border border-[color:var(--panel-border)] bg-[rgba(250,247,241,0.88)] p-6 shadow-[var(--shadow)] backdrop-blur sm:p-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[color:var(--panel-border)] pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">
                Month Card
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">October 2024 in Hyde Park</h2>
            </div>
            <div className="rounded-full border border-[color:var(--panel-border)] bg-white/70 px-4 py-2 text-sm text-[color:var(--muted)]">
              Peak day: {formatDate(result.structuredData.peakRidershipDay.date)}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <article className="rounded-[1.5rem] border border-[color:var(--panel-border)] bg-white/75 p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">
                Structured Data
              </p>
              <pre className="overflow-x-auto rounded-2xl bg-[#18242c] p-4 text-xs leading-6 text-[#f8efe1]">
                {JSON.stringify(result.structuredData, null, 2)}
              </pre>
            </article>

            <article className="rounded-[1.5rem] border border-[color:var(--panel-border)] bg-white/75 p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">
                Narrative
              </p>
              <p className="text-base leading-8 text-[color:var(--foreground)]">{result.narrative}</p>
            </article>

            <article className="rounded-[1.5rem] border border-[color:var(--panel-border)] bg-white/75 p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">
                ASCII Scene
              </p>
              <pre className="overflow-x-auto rounded-2xl bg-[#f6ead3] p-4 text-sm leading-6 text-[#1a252d]">
                {result.asciiCard}
              </pre>
            </article>
          </div>
        </section>
      ) : null}
    </main>
  );
}
