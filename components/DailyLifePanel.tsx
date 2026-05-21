"use client";

interface DailyLifePanelProps {
  monthName: string;
  neighborhood: string;
  narrative: string;
  isPaused: boolean;
  onPauseToggle: () => void;
  timeProgress?: number;
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
}: DailyLifePanelProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1100] flex items-end justify-center p-4">
      <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-white/20 bg-[#1a2530]/90 px-6 py-4 shadow-2xl backdrop-blur-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#e8b84b]">
                {monthName} · {neighborhood}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/45 transition-[opacity] duration-500">
                {sceneContext(timeProgress)}
              </p>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-white/90">{narrative}</p>
          </div>
          <button
            onClick={onPauseToggle}
            className="shrink-0 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            {isPaused ? "▶ Resume" : "⏸ Pause"}
          </button>
        </div>
      </div>
    </div>
  );
}
