"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, Play } from "lucide-react";
import { AuthActions } from "@/components/AuthActions";
import { AuthGateCard } from "./AuthGateCard";
import { JourneyRail } from "@/components/JourneyRail";
import { commuteModePhrase, displayWorkplaceContext } from "./helpers";
import type { AuthPromptReason } from "./types";
import type { UserProfile } from "@/lib/tools/types";

const CinematicStreetPano = dynamic(
  () => import("@/components/CinematicStreetPano").then((m) => m.CinematicStreetPano),
  { ssr: false },
);

interface SeasonTicketProps {
  readonly neighborhood: string;
  readonly profile: UserProfile | null;
  readonly sceneCoords: { lat: number; lng: number } | null;
  readonly isDemoMode: boolean;
  readonly authPrompt: AuthPromptReason | null;
  readonly onDismissAuthPrompt: () => void;
  readonly onBegin: () => void;
  readonly onSkip: () => void;
  readonly onBackToMatches: () => void;
}

/**
 * Full-screen "season ticket" — the moment between picking a neighborhood and
 * living a year in it. The run is the primary path; chat is the explicit opt-out.
 */
export function SeasonTicket({
  neighborhood,
  profile,
  sceneCoords,
  isDemoMode,
  authPrompt,
  onDismissAuthPrompt,
  onBegin,
  onSkip,
  onBackToMatches,
}: SeasonTicketProps) {
  const [panoOk, setPanoOk] = useState(true);
  const workplace = displayWorkplaceContext(profile?.workplace);

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-[color:var(--cinema-ink)]">
      {/* Backdrop: drifting street pano with a gradient fallback beneath */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(150deg, #111315 0%, #2b3438 58%, #111315 100%)" }}
      />
      {sceneCoords && panoOk && (
        <CinematicStreetPano
          lat={sceneCoords.lat}
          lng={sceneCoords.lng}
          onImageryStatus={(ok) => setPanoOk(ok)}
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(8,9,10,0.9)_0%,rgba(8,9,10,0.58)_52%,rgba(8,9,10,0.18)_100%),linear-gradient(180deg,rgba(8,9,10,0.2),rgba(8,9,10,0.68))]" />

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-[1200] flex items-center justify-between p-4 sm:p-5">
        {isDemoMode ? (
          <span className="rounded-lg bg-black/45 px-3 py-1.5 text-xs font-bold text-white/80 backdrop-blur-sm">
            Demo · Hyde Park
          </span>
        ) : (
          <button
            type="button"
            onClick={onBackToMatches}
            className="flex items-center gap-1.5 rounded-lg bg-black/45 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-black/65"
          >
            <ArrowLeft size={13} /> Back to matches
          </button>
        )}
        <AuthActions className="border-white/20 bg-white/15" />
      </div>

      <div className="absolute inset-x-5 top-20 z-[1150] hidden max-w-3xl sm:block lg:left-1/2 lg:-translate-x-1/2">
        <JourneyRail current="live" inverse />
      </div>

      {/* Center content */}
      <div className="absolute inset-0 z-[1100] flex items-center p-5 pt-24 sm:p-8 sm:pt-28 lg:p-16">
        <div className="w-full max-w-2xl text-left text-white">
          <p className="film-caption text-white/48">Chapter three · Your year in</p>
          <h1 className="film-display mt-3 text-6xl leading-[0.88] drop-shadow-lg sm:text-8xl">{neighborhood}</h1>
          <p className="mt-5 max-w-xl text-base font-medium leading-7 text-white/64">
            Four seasons will test the neighborhood against the life you described. Watch the routines settle in, the tradeoffs surface, and the final verdict take shape.
          </p>

          {profile && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              {profile.monthlyBudget ? (
                <span className="rounded-full border border-white/14 bg-black/35 px-3 py-1.5 text-xs font-semibold text-white/82 backdrop-blur-sm">
                  ${profile.monthlyBudget.toLocaleString()}/mo budget
                </span>
              ) : (
                <span className="rounded-full border border-white/14 bg-black/35 px-3 py-1.5 text-xs font-semibold text-white/82 backdrop-blur-sm">
                  {profile.budgetRange} budget
                </span>
              )}
              {workplace && (
                <span className="rounded-full border border-white/14 bg-black/35 px-3 py-1.5 text-xs font-semibold text-white/82 backdrop-blur-sm">
                  Daily anchor · {workplace}
                </span>
              )}
              <span className="rounded-full border border-white/14 bg-black/35 px-3 py-1.5 text-xs font-semibold text-white/82 backdrop-blur-sm">
                Moves {commuteModePhrase(profile.commutePref)}
              </span>
            </div>
          )}

          {authPrompt === "year" ? (
            <div className="mt-8 max-w-md">
              <AuthGateCard reason="year" onDismiss={onDismissAuthPrompt} />
            </div>
          ) : (
            <>
              <div className="mt-8 grid max-w-xl grid-cols-4 gap-1.5">
                {[
                  ["Spring", "Morning", "var(--season-spring)"],
                  ["Summer", "Afternoon", "var(--season-summer)"],
                  ["Autumn", "Evening", "var(--season-autumn)"],
                  ["Winter", "Night", "var(--season-winter)"],
                ].map(([season, time, color]) => (
                  <div key={season} className="border-t-2 pt-2" style={{ borderColor: color }}>
                    <p className="text-xs font-extrabold">{season}</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-white/42">{time}</p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={onBegin}
                className="mt-8 flex items-center gap-3 rounded-[var(--radius-md)] bg-[color:var(--cinema-ivory)] px-7 py-4 text-base font-extrabold text-[color:var(--cinema-ink)] shadow-xl transition hover:bg-white"
              >
                <Play size={20} fill="currentColor" /> Begin your year
              </button>
              <p className="mt-2 text-xs font-semibold text-white/48">
                Four acts · Spring to winter · About 90 seconds
              </p>

              <button
                type="button"
                onClick={onSkip}
                className="mt-5 text-sm font-bold text-white/48 underline underline-offset-4 transition hover:text-white/85"
              >
                Skip the film and investigate the neighborhood
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
