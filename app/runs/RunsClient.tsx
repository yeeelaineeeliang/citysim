"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SignInButton, useUser } from "@clerk/nextjs";
import { Archive, ArrowLeft, Play } from "lucide-react";
import type { DataSummary } from "@/lib/tools/types";
import type { SimAct } from "@/app/sim/types";
import type { VerdictSignal } from "@/lib/verdict";
import { AuthActions } from "@/components/AuthActions";
import { JourneyRail } from "@/components/JourneyRail";

interface RunSummary {
  id: string;
  neighborhood: string;
  year: number;
  createdAt: string;
  verdict: { version: number; signals: VerdictSignal[] };
}

interface RunDetail extends RunSummary {
  actSummaries: Partial<Record<SimAct, DataSummary>>;
}

const ACT_LABELS: Record<SimAct, string> = { 1: "Spring", 2: "Summer", 3: "Autumn", 4: "Winter" };

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function ActTable({ actSummaries }: { readonly actSummaries: Partial<Record<SimAct, DataSummary>> }) {
  return (
    <table className="mt-4 w-full text-left text-[11px] text-[color:var(--muted)]">
      <thead>
        <tr className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)]">
          <th className="pb-1 font-bold">Act</th>
          <th className="pb-1 font-bold">Rent</th>
          <th className="pb-1 font-bold">Commute</th>
          <th className="pb-1 font-bold">Crime</th>
          <th className="pb-1 font-bold">311</th>
        </tr>
      </thead>
      <tbody>
        {([1, 2, 3, 4] as SimAct[]).map((act) => {
          const s = actSummaries[act];
          return (
            <tr key={act} className="border-t border-[color:var(--panel-border)]">
              <td className="py-2 font-semibold text-[color:var(--foreground)]">{ACT_LABELS[act]}</td>
              <td className="py-1">{s?.avgRent != null ? `$${s.avgRent.toLocaleString()}` : "—"}</td>
              <td className="py-1">{s?.commuteMinutes != null ? `${s.commuteMinutes} min` : "—"}</td>
              <td className="py-1">{s?.crime ?? "—"}</td>
              <td className="py-1">{s?.requests311 ?? "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CompareColumn({ run }: { readonly run: RunDetail }) {
  return (
    <div className="min-w-0 flex-1 border border-[color:var(--panel-border)] bg-[color:var(--panel-solid)] p-5 text-[color:var(--foreground)] shadow-[var(--shadow)]">
      <p className="film-caption text-[color:var(--muted)]">Saved year</p>
      <h3 className="film-display mt-1 text-3xl">{run.neighborhood}</h3>
      <p className="mb-5 mt-1 text-[11px] font-semibold text-[color:var(--muted)]">Simulated {formatDate(run.createdAt)}</p>
      <div className="space-y-3">
        {run.verdict.signals.map((signal) => (
          <div key={signal.key} className="border-t border-[color:var(--panel-border)] pt-3 first:border-t-0 first:pt-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">{signal.label}</p>
            <p className="mt-0.5 text-sm font-extrabold">{signal.verdict}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[color:var(--muted)]">{signal.detail}</p>
            {signal.caveat && <p className="mt-1 text-[10px] italic text-[color:var(--muted)] opacity-70">{signal.caveat}</p>}
          </div>
        ))}
      </div>
      <ActTable actSummaries={run.actSummaries} />
    </div>
  );
}

export function RunsClient({ highlightId }: { readonly highlightId?: string }) {
  const { isLoaded, isSignedIn } = useUser();
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [compare, setCompare] = useState<RunDetail[] | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const highlightAppliedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetch("/api/runs")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((data: { runs?: RunSummary[] }) => {
        const loaded = data.runs ?? [];
        setRuns(loaded);
        // Arriving from a verdict's "Compare my seasons" — preselect that run.
        if (highlightId && !highlightAppliedRef.current && loaded.some((r) => r.id === highlightId)) {
          highlightAppliedRef.current = true;
          setSelected([highlightId]);
        }
      })
      .catch(() => setError("Couldn't load your saved seasons."));
  }, [isLoaded, isSignedIn, highlightId]);

  function toggleSelect(id: string) {
    setCompare(null);
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 2 ? [prev[1], id] : [...prev, id],
    );
  }

  async function runCompare() {
    if (selected.length !== 2) return;
    setLoadingCompare(true);
    setError(null);
    try {
      const details = await Promise.all(
        selected.map((id) =>
          fetch(`/api/runs/${id}`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
            .then((data: { run: RunDetail }) => data.run),
        ),
      );
      setCompare(details);
    } catch {
      setError("Couldn't load those runs for comparison.");
    } finally {
      setLoadingCompare(false);
    }
  }

  return (
    <main className="atlas-page-neighborhood min-h-screen px-4 py-4 text-[color:var(--foreground)] sm:px-7 sm:py-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="atlas-topbar">
          <Link className="atlas-brand" href="/">
            <span className="atlas-brand-mark" />
            LivingThere
          </Link>
          <AuthActions />
        </header>

        <section className="atlas-surface mt-4 px-4 py-3 sm:px-5">
          <JourneyRail current="decide" />
        </section>

        <section className="mt-4 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="h-fit bg-[color:var(--cinema-ink)] p-5 text-white shadow-[var(--shadow-lg)] lg:sticky lg:top-6">
            <Archive size={19} className="text-[color:var(--season-winter)]" aria-hidden="true" />
            <p className="film-caption mt-5 text-white/42">Chapter four · Your archive</p>
            <h1 className="film-display mt-2 text-5xl leading-[0.92]">The years you have lived.</h1>
            <p className="mt-4 text-sm font-medium leading-6 text-white/58">
              Revisit each verdict, put two neighborhoods side by side, and decide which tradeoffs still feel livable.
            </p>
            <div className="mt-6 grid gap-2">
              <Link
                href="/sim"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[color:var(--cinema-ivory)] px-3 text-xs font-extrabold text-[color:var(--cinema-ink)] transition hover:bg-white"
              >
                <Play size={14} fill="currentColor" /> Live another year
              </Link>
              <Link
                href="/sim"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-white/16 bg-white/8 px-3 text-xs font-bold text-white transition hover:bg-white/14"
              >
                <ArrowLeft size={14} /> Return to the simulator
              </Link>
            </div>
            <div className="season-strip mt-6" aria-hidden="true"><span /><span /><span /><span /></div>
          </aside>

          <div className="atlas-surface min-w-0 p-4 sm:p-6">
            <div className="mb-6">
              <p className="film-caption text-[color:var(--muted)]">Saved simulations</p>
              <h2 className="film-display mt-2 text-4xl">Compare the years that made your shortlist.</h2>
            </div>

        {!isLoaded ? (
          <div className="space-y-2" aria-live="polite">
            {[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-[var(--radius-md)] bg-black/6" />)}
          </div>
        ) : !isSignedIn ? (
          <div className="rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-white/60 p-7 text-center">
            <p className="mb-3 text-sm text-[color:var(--muted)]">Sign in to open your archive of simulated years.</p>
            <SignInButton mode="modal">
              <button type="button" className="atlas-button-primary">
                Sign in
              </button>
            </SignInButton>
          </div>
        ) : (
          <>
            {error && <p className="mb-4 rounded-[var(--radius-md)] border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

            {runs === null ? (
              <p className="text-sm text-[color:var(--muted)]">Opening your year archive…</p>
            ) : runs.length === 0 ? (
              <div className="rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-white/60 p-7 text-center text-sm text-[color:var(--muted)]">
                Your archive is empty. Finish a simulated year and its verdict will appear here.
              </div>
            ) : (
              <>
                <div className="mb-4 space-y-2">
                  {runs.map((run) => (
                    <label
                      key={run.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                        selected.includes(run.id)
                          ? "border-[color:var(--cinema-ink)] bg-[color:var(--cinema-ink)] text-white"
                          : "border-[color:var(--panel-border)] bg-white/68 hover:border-[color:var(--season-winter)]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(run.id)}
                        onChange={() => toggleSelect(run.id)}
                        className="h-4 w-4 accent-white"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold">{run.neighborhood}</p>
                        <p className={`text-[11px] ${selected.includes(run.id) ? "text-white/52" : "text-[color:var(--muted)]"}`}>{formatDate(run.createdAt)} · {run.year}</p>
                      </div>
                      <div className="hidden flex-wrap justify-end gap-1 sm:flex">
                        {run.verdict?.signals?.map((s) => (
                          <span key={s.key} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${selected.includes(run.id) ? "bg-white/10 text-white/75" : "bg-black/6 text-[color:var(--muted)]"}`}>
                            {s.verdict}
                          </span>
                        ))}
                      </div>
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={selected.length !== 2 || loadingCompare}
                  onClick={runCompare}
                  className="mb-6 rounded-[var(--radius-md)] bg-[color:var(--cinema-ink)] px-4 py-2.5 text-sm font-bold text-white transition enabled:hover:bg-[color:var(--cinema-graphite)] disabled:opacity-35"
                >
                  {loadingCompare ? "Opening both years…" : `Compare years${selected.length === 2 ? "" : " · choose two"}`}
                </button>

                {compare && (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {compare.map((run) => (
                      <CompareColumn key={run.id} run={run} />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
          </div>
        </section>
      </div>
    </main>
  );
}
