"use client";

import type { DayEvent } from "@/lib/dailySchedule";
import { getActivityFlavor } from "@/lib/activityFlavor";

interface DailyLifePanelProps {
  monthName: string;
  month: number;
  neighborhood: string;
  narrative: string;
  isPaused: boolean;
  onPauseToggle: () => void;
  timeProgress?: number;
  currentEvent?: DayEvent;
}

const isMomentEvent = (e: DayEvent) =>
  e.kind === "social" && e.timeLabel === "9:30 PM";

export function DailyLifePanel({
  monthName,
  month,
  neighborhood,
  narrative,
  isPaused,
  onPauseToggle,
  timeProgress = 0,
  currentEvent,
}: DailyLifePanelProps) {
  const isMoment = currentEvent ? isMomentEvent(currentEvent) : false;

  const flavor = currentEvent
    ? getActivityFlavor({ event: currentEvent, month, neighborhood })
    : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[1100]">
      {/* Top-left: season + neighborhood clock */}
      <div className="absolute left-5 top-5">
        <p className="font-mono text-[11px] tracking-[0.12em] text-white/50 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
          {monthName} · {neighborhood}
        </p>
      </div>

      {/* Bottom-center: activity context card */}
      <div className="absolute bottom-8 left-1/2 flex w-full max-w-xl -translate-x-1/2 flex-col items-center gap-0 px-6">
        {currentEvent ? (
          <div
            style={{
              background: isMoment
                ? "rgba(38, 20, 8, 0.88)"
                : "rgba(8, 14, 22, 0.72)",
              border: isMoment
                ? "1px solid rgba(220, 110, 40, 0.55)"
                : "1px solid rgba(255,255,255,0.12)",
              borderRadius: 14,
              padding: isMoment ? "20px 28px" : "14px 22px",
              backdropFilter: "blur(10px)",
              textAlign: "center",
              width: "100%",
              boxShadow: isMoment
                ? "0 0 32px rgba(220,110,40,0.25), 0 4px 24px rgba(0,0,0,0.7)"
                : "0 4px 20px rgba(0,0,0,0.55)",
              transition: "all 0.4s ease",
            }}
          >
            {/* Time label */}
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: isMoment ? "rgba(220,150,80,0.9)" : "rgba(255,255,255,0.4)",
                marginBottom: 6,
              }}
            >
              {currentEvent.timeLabel}
            </p>

            {/* Activity label */}
            <p
              style={{
                fontSize: isMoment ? 24 : 20,
                fontWeight: 800,
                color: "#ffffff",
                lineHeight: 1.15,
                letterSpacing: "-0.01em",
                marginBottom: 4,
                textShadow: "0 2px 12px rgba(0,0,0,0.9)",
              }}
            >
              {currentEvent.activityLabel}
            </p>

            {/* Context label — place / neighborhood */}
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255,255,255,0.5)",
                marginBottom: flavor ? 10 : 0,
              }}
            >
              {currentEvent.contextLabel}
            </p>

            {/* Flavor sentence */}
            {flavor && (
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: "rgba(255,255,255,0.72)",
                  textShadow: "0 1px 6px rgba(0,0,0,0.8)",
                }}
              >
                {flavor}
              </p>
            )}
          </div>
        ) : (
          // Fallback when no event yet — show LLM narrative
          narrative ? (
            <p className="text-center text-[13px] leading-relaxed text-white/75 drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)]">
              {narrative}
            </p>
          ) : null
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

      {/* Time-of-day progress bar — thin line at very bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          background: "rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.round(timeProgress * 100)}%`,
            background: "rgba(255,255,255,0.35)",
            transition: "width 0.3s linear",
          }}
        />
      </div>
    </div>
  );
}
