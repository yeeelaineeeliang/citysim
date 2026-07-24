"use client";

import { Play } from "lucide-react";
import type { DataSummary } from "@/lib/tools/types";
import { AnimatedCounter } from "./AnimatedCounter";

interface SeasonLedgerProps {
  /** Civic numbers for the selected season; null when no run data exists yet. */
  summary: DataSummary | null;
  /** Previous season's numbers — counters animate from these and deltas compare against them. */
  prevSummary: DataSummary | null;
  monthName: string;
  /** Act accent color (CSS value) for the active season. */
  accent: string;
  /** Citywide monthly crime average when a staged crime signal supplies it. */
  crimeCityAverage?: number | null;
  /** Sends the tile's investigation question into the Sam chat. */
  onAsk: (question: string) => void;
  /** CTA when there is no data yet. */
  onLiveYear: () => void;
}

/** Wording chosen to hit the demo-QA keyword lists so demo mode always answers. */
const TILE_QUESTIONS = {
  rent: "Can I afford to live here?",
  crime: "Is it safe here this season?",
  requests311: "How responsive are city services here?",
  commute: "What is my morning commute like?",
} as const;

function Delta({ current, prev, invert = false }: { current: number; prev: number | null | undefined; invert?: boolean }) {
  if (prev == null || prev === current) return null;
  const delta = current - prev;
  const pct = Math.round((delta / Math.max(prev, 1)) * 100);
  if (Math.abs(pct) < 5 && Math.abs(delta) < 2) return null;
  const worse = invert ? delta < 0 : delta > 0;
  return (
    <span className={`ml-1.5 text-[10px] font-bold ${worse ? "text-red-400" : "text-green-400"}`}>
      {delta > 0 ? "+" : ""}
      {Math.abs(delta) >= 10 ? delta : `${pct}%`}
    </span>
  );
}

function Tile({
  label,
  question,
  onAsk,
  children,
  context,
}: {
  label: string;
  question: string;
  onAsk: (question: string) => void;
  children: React.ReactNode;
  context?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onAsk(question)}
      className="group flex min-w-[132px] flex-col items-start gap-0.5 rounded-[var(--radius-md)] border border-white/10 bg-white/[0.04] px-3.5 py-2 text-left transition-colors hover:border-white/30 hover:bg-white/10"
    >
      <span className="text-[10px] font-bold uppercase tracking-widest text-white/45">{label}</span>
      <span className="text-sm font-semibold text-white">{children}</span>
      <span className="text-[10px] font-semibold text-white/40 group-hover:hidden">{context ?? " "}</span>
      <span className="hidden text-[10px] font-bold text-white/75 group-hover:block">Ask Sam →</span>
    </button>
  );
}

/**
 * The debrief's "vital signs" band: the four civic numbers Sam's answers cite,
 * pinned above the evidence stage so they never live only inside prose.
 * Counters animate season-over-season when the user switches chips.
 */
export function SeasonLedger({
  summary,
  prevSummary,
  monthName,
  accent,
  crimeCityAverage,
  onAsk,
  onLiveYear,
}: SeasonLedgerProps) {
  return (
    <div
      className="flex items-center gap-3 overflow-x-auto border-b-2 bg-black/45 px-4 py-2.5 backdrop-blur-md sm:px-6"
      style={{ borderBottomColor: accent }}
    >
      <div className="hidden shrink-0 flex-col sm:flex">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/45">Season ledger</span>
        <span className="text-sm font-bold text-white">{monthName}</span>
      </div>

      {summary ? (
        <div className="flex items-stretch gap-2">
          {summary.avgRent != null && (
            <Tile label="Rent" question={TILE_QUESTIONS.rent} onAsk={onAsk} context="est. monthly">
              ${summary.avgRent.toLocaleString()}/mo
            </Tile>
          )}
          {summary.crime != null && (
            <Tile
              label="Crime"
              question={TILE_QUESTIONS.crime}
              onAsk={onAsk}
              context={
                crimeCityAverage
                  ? `${summary.crime <= crimeCityAverage ? "↓ below" : "↑ above"} city avg ${Math.round(crimeCityAverage)}`
                  : "incidents this month"
              }
            >
              <AnimatedCounter to={summary.crime} from={prevSummary?.crime ?? summary.crime} />
              <Delta current={summary.crime} prev={prevSummary?.crime} />
            </Tile>
          )}
          {summary.requests311 != null && (
            <Tile label="311 requests" question={TILE_QUESTIONS.requests311} onAsk={onAsk} context="service requests">
              <AnimatedCounter to={summary.requests311} from={prevSummary?.requests311 ?? summary.requests311} />
              <Delta current={summary.requests311} prev={prevSummary?.requests311} />
            </Tile>
          )}
          {summary.commuteMinutes != null && (
            <Tile label="Commute" question={TILE_QUESTIONS.commute} onAsk={onAsk} context="door to door">
              ~<AnimatedCounter to={summary.commuteMinutes} from={prevSummary?.commuteMinutes ?? summary.commuteMinutes} /> min
              <Delta current={summary.commuteMinutes} prev={prevSummary?.commuteMinutes} />
            </Tile>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={onLiveYear}
          className="flex items-center gap-2 rounded-[var(--radius-md)] border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-bold text-white/80 transition-colors hover:border-white/35 hover:bg-white/12 hover:text-white"
        >
          <Play size={13} />
          Live the year to fill in {monthName}&apos;s rent, crime, 311, and commute numbers
        </button>
      )}
    </div>
  );
}
