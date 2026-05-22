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
    <div className="pointer-events-none absolute inset-0 z-[1100]">
      {/* Top-left: game clock */}
      <div className="absolute left-5 top-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/50 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
          {monthName} · {neighborhood}
        </p>
      </div>

      {/* Bottom-center: event label + narrative */}
      <div className="absolute bottom-8 left-1/2 flex w-full max-w-2xl -translate-x-1/2 flex-col items-center gap-2 px-6">
        {currentEvent?.timeLabel && (
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/50 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
            {currentEvent.timeLabel}
          </p>
        )}
        <p className="text-center text-2xl font-bold uppercase tracking-[0.08em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)]">
          {currentEvent?.activityLabel ?? sceneContext(timeProgress)}
        </p>
        {narrative && (
          <p className="text-center text-[13px] leading-relaxed text-white/75 drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)]">
            {narrative}
          </p>
        )}
      </div>

      {/* Bottom-right: pause/resume */}
      <div className="pointer-events-auto absolute bottom-6 right-5">
        <button
          onClick={onPauseToggle}
          className="rounded-full border border-white/25 bg-black/45 px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white/80 backdrop-blur-sm transition hover:bg-white/20 hover:text-white"
        >
          {isPaused ? "Resume" : "Pause"}
        </button>
      </div>
    </div>
  );
}
