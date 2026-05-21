"use client";

import type { DayEvent } from "@/lib/dailySchedule";

interface DailyLifePanelProps {
  monthName: string;
  neighborhood: string;
  narrative: string;
  isPaused: boolean;
  onPauseToggle: () => void;
  timeProgress?: number;
  currentEvent?: DayEvent;
}

function sceneContext(p: number): string {
  if (p <= 0.15) return "Morning  ·  Home block";
  if (p <= 0.45) return "Midday  ·  Neighborhood";
  if (p <= 0.72) return "Evening  ·  Your block";
  return "Night  ·  Lights off";
}

export function DailyLifePanel({
  monthName,
  neighborhood,
  narrative,
  isPaused,
  onPauseToggle,
  timeProgress = 0,
  currentEvent,
}: DailyLifePanelProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1100] flex items-end justify-center p-4">
      <div className="pointer-events-auto w-full max-w-2xl rounded-[var(--radius-lg)] border border-white/20 bg-[rgba(19,33,43,0.9)] px-6 py-4 shadow-2xl backdrop-blur-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-3">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--amber)]">
                {monthName} · {neighborhood}
              </p>
              {currentEvent ? (
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/65 transition-all duration-300">
                  {currentEvent.timeLabel} · {currentEvent.activityLabel}
                </p>
              ) : (
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45 transition-[opacity] duration-500">
                  {sceneContext(timeProgress)}
                </p>
              )}
            </div>
            {currentEvent && (
              <p className="mt-0.5 text-[9px] font-medium uppercase tracking-widest text-white/35">
                {currentEvent.contextLabel}
              </p>
            )}
            <p className="mt-1.5 text-sm leading-relaxed text-white/90">{narrative}</p>
          </div>
          <button
            onClick={onPauseToggle}
            className="shrink-0 rounded-[var(--radius-sm)] border border-white/20 bg-white/10 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-white/20"
          >
            {isPaused ? "Resume" : "Pause"}
          </button>
        </div>
      </div>
    </div>
  );
}
