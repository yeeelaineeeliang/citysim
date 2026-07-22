"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { ArrowLeft, CalendarDays, ListChecks, MapIcon, MessageCircle, Play, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { AuthActions } from "@/components/AuthActions";
import { JourneyRail } from "@/components/JourneyRail";
import { SeasonalStreetOverlay } from "@/components/SeasonalStreetOverlay";
import { Skybox } from "@/components/Skybox";
import {
  groupMessagesByMonth,
  monthGroupKey,
  type SimMessage,
} from "@/lib/simMessages";
import type { UserProfile } from "@/lib/tools/types";
import dynamic from "next/dynamic";
import { NEIGHBORHOOD_COORDINATES } from "@/lib/neighborhoodCoordinates";
import type { CommunityAreaMapMatch } from "@/components/CommunityAreaBlockMap";
import { DEMO_PROFILE, DEMO_NEIGHBORHOOD, DEMO_MONTH, DEMO_OPENING } from "@/lib/demoData";
import {
  MATCH_RANK_BADGE_STROKE,
  MATCH_RANK_BADGE_SURFACE,
  MATCH_RANK_BADGE_TEXT,
  MATCH_RANK_SELECTED_STROKE,
  MATCH_RANK_SELECTED_SURFACE,
} from "@/lib/matchRankColors";
import { useSimProfile } from "./hooks/useSimProfile";
import { useSimChat } from "./hooks/useSimChat";
import { useSimAct } from "./hooks/useSimAct";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion";
import { SimVerdict } from "@/components/SimVerdict";
import { ProfileOnboardingShell } from "./ProfileOnboardingShell";
import {
  commuteModePhrase,
  createSimMessage,
  displayWorkplaceContext,
  getProfileWorkplaceCoords,
  ALL_NEIGHBORHOODS,
  MONTH_NAMES,
  SIM_YEAR,
  SUGGESTED_QUESTIONS,
} from "./helpers";
import type { AuthPromptReason, IdleView, MobilePanel, SceneMode, SimAct, Step } from "./types";
import { ACT_MONTH, ACT_SEASON, MONTH_TO_ACT, SEASON_ORDER } from "./types";
import { AuthGateCard } from "./AuthGateCard";
import { SeasonTicket } from "./SeasonTicket";

const SimPlayerMap = dynamic(
  () => import("@/components/SimPlayerMap").then((m) => m.SimPlayerMap),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-white/20" /> },
);
const CommunityAreaBlockMap = dynamic(
  () => import("@/components/CommunityAreaBlockMap").then((m) => m.CommunityAreaBlockMap),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse rounded-2xl bg-[color:var(--panel-border)]" /> },
);
const SimulationMap = dynamic(
  () => import("@/components/SimulationMap").then((m) => m.SimulationMap),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-white/20" /> },
);
const MapillaryStreetView = dynamic(
  () => import("@/components/MapillaryStreetView").then((m) => m.MapillaryStreetView),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-[#1a2530]" /> },
);
const CinematicStreetPano = dynamic(
  () => import("@/components/CinematicStreetPano").then((m) => m.CinematicStreetPano),
  { ssr: false },
);
const SeasonalAtmosphere = dynamic(
  () => import("@/components/SeasonalAtmosphere").then((m) => m.SeasonalAtmosphere),
  { ssr: false },
);

// ─── UI-only helpers ──────────────────────────────────────────────────────────

function seasonalTintForMonth(m: number): string {
  if (m <= 3) return "rgba(200,220,255,0.08)";
  if (m <= 6) return "rgba(120,200,120,0.06)";
  if (m <= 9) return "rgba(255,200,50,0.08)";
  return "rgba(180,120,60,0.10)";
}

// Cinematic act tint = season + time of day (spring morning → winter night).
// Applied over the live street pano, this carries the season shift between acts.
const ACT_TINT: Record<SimAct, string> = {
  1: "rgba(190,215,255,0.12)",
  2: "rgba(255,215,130,0.12)",
  3: "rgba(225,130,45,0.20)",
  4: "rgba(8,15,40,0.52)",
};

const ACT_ACCENT: Record<SimAct, string> = {
  1: "var(--season-spring)",
  2: "var(--season-summer)",
  3: "var(--season-autumn)",
  4: "var(--season-winter)",
};

function AnimatedCounter({ to, from = 0 }: { to: number; from?: number }) {
  const [value, setValue] = useState(from);
  const reducedMotion = usePrefersReducedMotion();
  useEffect(() => {
    if (reducedMotion || to === from) { setValue(to); return; }
    const duration = 1500;
    const start = performance.now();
    let rafId: number;
    function tick() {
      const elapsed = performance.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + eased * (to - from)));
      if (progress < 1) rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [to, from, reducedMotion]);
  return <>{value}</>;
}

type MatchChipTone = "good" | "warn" | "caution" | "info" | "neutral";

function splitMatchReason(value: string | undefined) {
  return value
    ? value
        .split("·")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function compactMatchChipLabel(value: string, commutePref?: UserProfile["commutePref"]) {
  const commute = value.match(/~?(\d+)\s+min/i);
  if (commute) return `~${commute[1]} min ${commuteModePhrase(commutePref)}`;

  const rent = value.match(/\$[\d,]+\/mo/i);
  if (rent) {
    if (/over budget/i.test(value)) return `${rent[0]} over`;
    if (/fits your budget/i.test(value)) return `${rent[0]} fit`;
    return rent[0];
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function matchChipTone(value: string): MatchChipTone {
  const lower = value.toLowerCase();
  const commute = lower.match(/~?(\d+)\s+min/);
  if (commute) {
    const minutes = Number(commute[1]);
    if (minutes >= 35) return "warn";
    if (minutes >= 25) return "neutral";
    return "good";
  }
  if (/over budget|higher crime/.test(lower)) return "caution";
  if (/budget|rent|\$|low crime|fast city services/.test(lower)) return "good";
  if (/transit|dining|nightlife/.test(lower)) return "info";
  return "neutral";
}

function matchChipClassName(tone: MatchChipTone, active: boolean) {
  if (active) return "border-white/24 bg-white/14 text-white";
  if (tone === "good") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "warn") return "border-amber-200 bg-amber-50 text-amber-800";
  if (tone === "caution") return "border-red-200 bg-red-50 text-red-700";
  if (tone === "info") return "border-sky-200 bg-sky-50 text-sky-800";
  return "border-stone-200 bg-stone-50 text-stone-700";
}

function matchChips(match: CommunityAreaMapMatch, commutePref?: UserProfile["commutePref"]) {
  const labels = match.descriptors?.length ? match.descriptors : splitMatchReason(match.matchReason);
  return labels.slice(0, 3).map((label) => ({
    label: compactMatchChipLabel(label, commutePref),
    tone: matchChipTone(label),
  }));
}

function MessageBubble({ message, compact = false }: { message: SimMessage; compact?: boolean }) {
  const isUser = message.role === "user";
  const isOpener = message.kind === "opener";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[86%] rounded-[var(--radius-lg)] rounded-br-[var(--radius-sm)] bg-[color:var(--sage)] px-4 py-3 text-sm font-medium leading-relaxed text-white shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  if (isOpener && !compact) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[color:var(--panel-border)] border-l-[color:var(--accent)] bg-[color:var(--panel-solid)] px-5 py-4 text-[15px] leading-7 text-[color:var(--foreground)] shadow-sm">
        {message.content}
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div
        className={`max-w-[92%] rounded-[var(--radius-lg)] rounded-tl-[var(--radius-sm)] px-4 py-3 text-sm leading-relaxed text-[color:var(--foreground)] ${
          compact
            ? "bg-white/45 text-[color:var(--muted)]"
            : "border border-[color:var(--panel-border)] bg-white/76 shadow-sm"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

const TOOL_EVIDENCE: Record<string, { label: string; detail: string }> = {
  query_crime: {
    label: "Safety",
    detail: "Reported incident totals and neighborhood-vs-city context.",
  },
  query_commute: {
    label: "Commute",
    detail: "Distance and estimated travel time from your anchor.",
  },
  query_transit: {
    label: "Transit",
    detail: "CTA access, ridership, crowding, and route signals.",
  },
  query_housing: {
    label: "Budget",
    detail: "Rent estimates and affordable-housing stock signals.",
  },
  query_311: {
    label: "City services",
    detail: "311 request volume and average response timing.",
  },
  query_entertainment: {
    label: "Daily life",
    detail: "Restaurants, bars, parks, civic amenities, and markets.",
  },
  get_neighborhood_profile: {
    label: "Profile",
    detail: "Community-area context and local descriptors.",
  },
};

function toolEvidence(tool: string) {
  return TOOL_EVIDENCE[tool] ?? {
    label: tool.replace(/^query_/, "").replaceAll("_", " "),
    detail: "Grounded civic-data lookup used for this answer.",
  };
}


// ─── Component ────────────────────────────────────────────────────────────────

interface SimClientProps {
  demoMode?: boolean;
  autorun?: boolean;
}

export function SimClient({ demoMode = false, autorun = false }: Readonly<SimClientProps>) {
  const { isLoaded: authLoaded, isSignedIn } = useUser();
  const isDemoMode = demoMode;
  // Whether the cinematic street pano found imagery — false keeps the gradient fallback.
  const [cinematicPanoOk, setCinematicPanoOk] = useState(true);

  // Top-level UI state — shared across all three domains
  const [step, setStep] = useState<Step>("profile");
  const [month, setMonth] = useState(10);
  const [sceneMode, setSceneMode] = useState<SceneMode>("street");
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("map");
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Idle presentation: season-ticket interstitial (run is the default path)
  // or the debrief/Q&A two-panel screen (explicit opt-out or post-run).
  const [idleView, setIdleView] = useState<IdleView>("interstitial");
  const autorunFiredRef = useRef(false);

  const profileData = useSimProfile({ demoMode, setStep });

  const chat = useSimChat({
    profile: profileData.profile,
    neighborhood: profileData.neighborhood,
    month,
    sessionId,
    setSessionId,
    isDemoMode,
    isSignedIn,
    authLoaded,
    setSceneMode,
    setMobilePanel,
  });

  const runData = useSimAct({
    profile: profileData.profile,
    neighborhood: profileData.neighborhood,
    setActiveMapActions: chat.setActiveMapActions,
    isDemoMode,
    isSignedIn,
    authLoaded,
    setMobilePanel,
    setAuthPrompt: chat.setAuthPrompt,
  });

  // Retry pano imagery lookup whenever the simulated neighborhood changes.
  useEffect(() => {
    setCinematicPanoOk(true);
  }, [profileData.neighborhood]);

  // Demo init — touches state from all hooks, so lives here
  useEffect(() => {
    if (!isDemoMode) return;
    profileData.setProfile(DEMO_PROFILE);
    setMonth(DEMO_MONTH);
    profileData.setNeighborhood(DEMO_NEIGHBORHOOD);
    setSessionId(null);
    chat.setActiveMapActions([]);
    setSceneMode("street");
    chat.setOpeningThinking(false);
    setStep("sim");
    chat.setMessages([createSimMessage("assistant", DEMO_OPENING, DEMO_MONTH, "opener")]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoMode]);

  // Demo autorun (/sim?demo=1&autorun=1): the landing CTA promises an
  // auto-playing demo, so skip the interstitial and start the run as soon as
  // the demo profile has committed. Separate effect from demo-init because
  // setProfile hasn't applied within the same pass.
  useEffect(() => {
    if (!isDemoMode || !autorun || autorunFiredRef.current) return;
    if (step === "sim" && profileData.profile && runData.runState === "idle") {
      autorunFiredRef.current = true;
      void runData.startAutoRun();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoMode, autorun, step, profileData.profile, runData.runState]);

  // ── Neighborhood / month coordination ────────────────────────────────────────

  function pickNeighborhood(name: string) {
    profileData.setNeighborhood(name);
    setSessionId(null);
    chat.setActiveMapActions([]);
    setSceneMode("street");
    setStep("sim");
    setMobilePanel("map");
    runData.stopAutoRun();
    setIdleView("interstitial");
    if (profileData.profile) void chat.fetchOpening(name, month, profileData.profile, { reset: true });
  }

  function changeMonth(nextMonth: number) {
    if (nextMonth === month) return;
    setMonth(nextMonth);
    chat.setActiveMapActions([]);
    if (profileData.profile && step === "sim") {
      void chat.fetchOpening(profileData.neighborhood, nextMonth, profileData.profile);
    }
  }

  function changeNeighborhood(nextNeighborhood: string) {
    if (nextNeighborhood === profileData.neighborhood) return;
    profileData.setNeighborhood(nextNeighborhood);
    setSessionId(null);
    chat.setActiveMapActions([]);
    setSceneMode("street");
    runData.stopAutoRun();
    setIdleView("interstitial");
    if (profileData.profile) {
      void chat.fetchOpening(nextNeighborhood, month, profileData.profile, { reset: true });
    }
  }

  // Verdict → debrief: seed Sam's opener from the year the user just watched,
  // then drop back to the two-panel screen with run history intact.
  function handleVerdictDebrief() {
    const spring = runData.actDataSummaries[1];
    const winter = runData.actDataSummaries[4];
    const callouts: string[] = [];
    if (spring?.commuteMinutes != null && winter?.commuteMinutes != null && winter.commuteMinutes > spring.commuteMinutes) {
      callouts.push(`your commute stretched from ${spring.commuteMinutes} to ${winter.commuteMinutes} minutes by winter`);
    } else if (spring?.commuteMinutes != null) {
      callouts.push(`your commute held near ${spring.commuteMinutes} minutes all year`);
    }
    if (spring?.avgRent != null) {
      callouts.push(`rent estimates ran about $${spring.avgRent.toLocaleString()}/mo`);
    }
    const opener = `Your year in ${profileData.neighborhood} is complete${
      callouts.length ? ` — ${callouts.join(", and ")}` : ""
    }. Ask me anything about how it went.`;
    chat.setMessages((prev) => [...prev, createSimMessage("assistant", opener, month, "opener")]);
    runData.exitToDebrief();
    setIdleView("debrief");
    setMobilePanel("advisor");
  }

  function handleVerdictTryAnother() {
    runData.stopAutoRun();
    setStep("neighborhood");
  }

  function renderSuggestedQuestionChips() {
    return (
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => void chat.send(q)}
            className="rounded-[var(--radius-sm)] border border-[color:var(--panel-border)] bg-white/72 px-3 py-2 text-left text-xs font-bold text-[color:var(--muted-strong)] transition-colors hover:border-[color:var(--sage)] hover:bg-white hover:text-[color:var(--sage-strong)]"
          >
            {q}
          </button>
        ))}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Profile step
  // ══════════════════════════════════════════════════════════════════════════════

  if (step === "profile") {
    return <ProfileOnboardingShell onComplete={profileData.handleProfileComplete} />;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Neighborhood selection step
  // ══════════════════════════════════════════════════════════════════════════════

  if (step === "neighborhood") {
    const mapMatches: CommunityAreaMapMatch[] = profileData.matches.map((match, index) => ({
      communityAreaNumber: match.communityAreaNumber,
      name: match.name,
      slug: match.slug,
      descriptors: match.descriptors,
      matchReason: match.matchReason,
      rank: index + 1,
    }));
    const activeMatch = mapMatches.find((match) => match.name === profileData.neighborhood);
    const workplaceContext = displayWorkplaceContext(profileData.profile?.workplace);
    const profileContext = [
      profileData.profile?.budgetRange ? `Budget ${profileData.profile.budgetRange}` : null,
      workplaceContext ? `Near ${workplaceContext}` : null,
    ].filter((item): item is string => Boolean(item));

    return (
      <main className="atlas-page-neighborhood min-h-screen px-4 py-4 text-[color:var(--foreground)] sm:px-7 sm:py-6">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[1760px] flex-col gap-4 sm:min-h-[calc(100vh-3rem)]">
          <header className="atlas-topbar">
            <a className="atlas-brand" href="/">
              <span className="atlas-brand-mark" />
              LivingThere
            </a>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep("profile")}
                className="hidden text-xs font-bold text-[color:var(--foreground)] opacity-70 hover:opacity-100 sm:inline-flex"
              >
                Edit my life
              </button>
              <AuthActions />
            </div>
          </header>

          <section className="atlas-surface px-4 py-3 sm:px-5">
            <JourneyRail current="match" />
          </section>

          <section className="grid min-h-0 flex-1 gap-4 lg:h-[calc(100vh-10.5rem)] lg:max-h-[calc(100vh-10.5rem)] lg:min-h-[620px] lg:overflow-hidden lg:grid-cols-[380px_minmax(0,1fr)]">
            <aside className="atlas-card min-h-0 overflow-hidden text-[color:var(--foreground)] lg:h-full">
              <div className="flex h-full min-h-0 flex-col gap-4">
                <div className="border-b border-[color:var(--panel-border)] bg-[color:var(--cinema-ink)] p-5 text-white">
                  <p className="film-caption text-white/44">Chapter two · The shortlist</p>
                  <div className="mt-3 flex items-start gap-2">
                    <ListChecks size={19} className="mt-1 text-[color:var(--season-summer)]" aria-hidden="true" />
                    <h1 className="film-display text-3xl leading-none">Choose a year worth living.</h1>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm font-medium leading-5 text-white/58">
                    {profileContext.length ? profileContext.join(" · ") : "Ranked against your profile."}
                  </p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                  {profileData.matchLoading && (
                    <div className="grid gap-2">
                      {[0, 1, 2, 3, 4].map((item) => (
                        <div key={item} className="h-[74px] animate-pulse rounded-[var(--radius-md)] bg-white/58" />
                      ))}
                    </div>
                  )}

                  {!profileData.matchLoading && profileData.matchError && (
                    <div className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 p-3">
                      <p className="text-sm font-bold text-red-700">Matches could not load.</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-red-700/80">{profileData.matchError}</p>
                      <button
                        type="button"
                        onClick={() => void profileData.runMatching()}
                        className="mt-3 rounded-[var(--radius-sm)] border border-red-200 bg-white/72 px-3 py-2 text-xs font-extrabold text-red-700 transition hover:bg-white"
                      >
                        Try again
                      </button>
                    </div>
                  )}

                  {!profileData.matchLoading && !profileData.matchError && mapMatches.length === 0 && (
                    <div className="rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-white/62 p-3">
                      <p className="text-sm font-bold text-[color:var(--foreground)]">No ranked matches yet.</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-[color:var(--muted)]">
                        Use the map or search to choose any community area.
                      </p>
                    </div>
                  )}

                  {!profileData.matchLoading && mapMatches.length > 0 && (
                    <div className="grid gap-2">
                      {mapMatches.slice(0, 5).map((match) => {
                        const active = activeMatch?.communityAreaNumber === match.communityAreaNumber;
                        const chips = matchChips(match, profileData.profile?.commutePref);
                        return (
                          <button
                            key={match.communityAreaNumber}
                            type="button"
                            onClick={() => profileData.setNeighborhood(match.name)}
                            style={active ? { borderColor: MATCH_RANK_SELECTED_STROKE, backgroundColor: MATCH_RANK_SELECTED_SURFACE } : undefined}
                            className={`grid grid-cols-[32px_minmax(0,1fr)] items-start gap-3 rounded-[var(--radius-md)] border p-3 text-left transition ${
                              active
                                ? "text-white shadow-md"
                                : "border-[color:var(--panel-border)] bg-white/72 hover:border-[#0F766E] hover:bg-[#F0FDFA]"
                            }`}
                          >
                            <span
                              className="flex h-8 w-8 items-center justify-center rounded-full border text-sm font-extrabold shadow-sm"
                              style={{
                                backgroundColor: MATCH_RANK_BADGE_SURFACE,
                                borderColor: active ? "rgba(255,249,238,0.74)" : MATCH_RANK_BADGE_STROKE,
                                color: active ? MATCH_RANK_SELECTED_SURFACE : MATCH_RANK_BADGE_TEXT,
                              }}
                            >
                              {match.rank}
                            </span>
                            <span className="min-w-0">
                              <span className={`block truncate text-sm font-extrabold ${active ? "text-white" : "text-[color:var(--foreground)]"}`}>{match.name}</span>
                              <span className="mt-2 flex flex-wrap gap-1.5">
                                {chips.length ? chips.map((chip) => (
                                  <span
                                    key={`${match.communityAreaNumber}-${chip.label}`}
                                    className={`rounded-full border px-2 py-0.5 text-[11px] font-extrabold leading-4 ${matchChipClassName(chip.tone, active)}`}
                                  >
                                    {chip.label}
                                  </span>
                                )) : (
                                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-extrabold leading-4 ${matchChipClassName("neutral", active)}`}>
                                    Matches your profile
                                  </span>
                                )}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </aside>

            <section className="atlas-surface flex min-h-[560px] flex-col p-4 sm:p-5 lg:h-full lg:min-h-0 lg:overflow-hidden">
              <div className="min-h-0 flex-1">
                <CommunityAreaBlockMap
                  selectedName={profileData.neighborhood}
                  onSelect={profileData.setNeighborhood}
                  onConfirm={pickNeighborhood}
                  matches={mapMatches}
                  mode={mapMatches.length ? "match" : "browse"}
                  workplaceCoords={getProfileWorkplaceCoords(profileData.profile)}
                  workplaceName={profileData.profile?.workplace}
                  budgetRange={profileData.profile?.budgetRange}
                  monthlyBudget={profileData.profile?.monthlyBudget}
                  commutePref={profileData.profile?.commutePref}
                  priorities={profileData.profile?.priorities}
                  month={month}
                  year={SIM_YEAR}
                />
              </div>
            </section>
          </section>
        </div>
      </main>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Simulation step
  // ══════════════════════════════════════════════════════════════════════════════

  const { neighborhood, profile } = profileData;
  const {
    messages, input, setInput, loading, error, lastToolsUsed,
    activeMapActions, openingThinking, authPrompt, setAuthPrompt, messagesEndRef,
  } = chat;
  const {
    runState, currentAct, actNarrative, actDataSummaries,
    completedActs, streetViewUrls, monthDataSummary, savedRunId,
    startAutoRun, togglePause, stopAutoRun,
  } = runData;

  const monthName = MONTH_NAMES[month - 1] ?? "this month";
  const sceneCoords = NEIGHBORHOOD_COORDINATES.find((c) => c.name === neighborhood);
  const workplaceCoords = getProfileWorkplaceCoords(profile);
  const showInterstitial = runState === "idle" && idleView === "interstitial";
  const hasCompletedRun = completedActs.length === 4;
  const currentSeasonAct = MONTH_TO_ACT[month] ?? null;
  const messageGroups = groupMessagesByMonth(messages);
  const currentGroupKey = monthGroupKey(month, SIM_YEAR);
  const currentGroup = messageGroups.find((group) => group.key === currentGroupKey);
  const earlierGroups = messageGroups.filter((group) => group.key !== currentGroupKey);
  const currentMessages = currentGroup?.messages ?? [];

  return (
    <div className="relative h-screen overflow-hidden bg-[color:var(--cinema-ink)] text-white">
      <div aria-hidden="true" className="absolute inset-0">
        <Skybox
          month={month}
          crimeSignal={0}
          serviceSignal={null}
          transitSignal={0}
          fullBleed
          showElements={false}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,19,21,0.18)_0%,rgba(17,19,21,0.5)_58%,rgba(17,19,21,0.92)_100%)]" />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        {isDemoMode && (
          <div className="flex items-center justify-between gap-2 bg-[color:var(--cinema-paper)] px-4 py-1.5 text-xs font-extrabold text-[color:var(--foreground)]">
            <span>Demo screening · Hyde Park · {SIM_YEAR}</span>
            <a href="/sim" className="underline opacity-70 hover:opacity-100">Exit demo</a>
          </div>
        )}
        {!showInterstitial && runState === "idle" && (
        <header className="relative z-20 flex flex-col gap-3 overflow-visible border-b border-white/12 bg-[rgba(17,19,21,0.82)] px-3 py-2.5 shadow-lg backdrop-blur-xl md:flex-row md:items-center md:gap-4 md:px-4">
          <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <div className="flex min-w-0 shrink-0 items-center gap-2">
              <Link
                href="/profile"
                aria-label="Back to profile"
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-white/20 bg-white/12 px-2.5 text-xs font-extrabold text-white/85 shadow-sm backdrop-blur transition hover:bg-white/20 hover:text-white sm:px-3"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                <span className="hidden sm:inline">My life</span>
              </Link>
              <select
                aria-label="Neighborhood"
                value={neighborhood}
                onChange={(e) => {
                  const next = e.target.value;
                  changeNeighborhood(next);
                }}
                className="min-w-0 rounded-[var(--radius-sm)] border border-white/20 bg-white/95 px-2 py-1 text-sm font-bold text-[color:var(--foreground)] outline-none focus:border-[color:var(--amber)]"
              >
                {ALL_NEIGHBORHOODS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {runState === "idle" && (
              <div className="flex w-full min-w-0 flex-1 flex-wrap items-center gap-1.5 md:w-auto">
                {SEASON_ORDER.map((act) => {
                  const isCurrent = currentSeasonAct === act;
                  const label = ACT_SEASON[act].charAt(0).toUpperCase() + ACT_SEASON[act].slice(1);
                  return (
                    <button
                      key={act}
                      onClick={() => changeMonth(ACT_MONTH[act])}
                      style={isCurrent ? { backgroundColor: ACT_ACCENT[act] } : undefined}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                        isCurrent
                          ? "text-white shadow-sm"
                          : "text-white/65 hover:bg-white/15 hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="hidden shrink-0 items-center justify-between gap-3 md:flex">
            {runState === "idle" && (
              <button
                type="button"
                onClick={() => void startAutoRun()}
                className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] bg-[color:var(--cinema-ivory)] px-3 text-xs font-extrabold text-[color:var(--cinema-ink)] shadow-sm transition hover:bg-white"
              >
                <Play size={13} fill="currentColor" />
                {hasCompletedRun ? "Replay the year" : "Live the year"}
              </button>
            )}
            <AuthActions className="border-white/20 bg-white/15" />
          </div>
        </header>
        )}

        {runState !== "idle" ? (
          /* ── Cinematic 4-act mode ── */
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {/* Layer 0 — seasonal gradient, always present so there is never a blank frame */}
            {currentAct && (
              <div
                className="absolute inset-0"
                style={{
                  background: ({
                    spring: "linear-gradient(160deg, #0d2b1a 0%, #1e5c35 50%, #0d2b1a 100%)",
                    summer: "linear-gradient(160deg, #1a1a0a 0%, #5c4a10 50%, #1a1a0a 100%)",
                    autumn: "linear-gradient(160deg, #1a0d00 0%, #6b3010 50%, #1a0d00 100%)",
                    winter: "linear-gradient(160deg, #050d1a 0%, #102040 50%, #050d1a 100%)",
                  } as Record<string, string>)[ACT_SEASON[currentAct]] ?? "linear-gradient(160deg, #111 0%, #222 100%)",
                }}
              />
            )}

            {/* Layer 1 — live drifting street panorama (mounted once, survives act changes) */}
            {sceneCoords && cinematicPanoOk && (
              <CinematicStreetPano
                lat={sceneCoords.lat}
                lng={sceneCoords.lng}
                onImageryStatus={(ok) => setCinematicPanoOk(ok)}
              />
            )}

            {/* Layer 2 — cached Google seasonal Street View takes priority when available */}
            {currentAct && streetViewUrls[ACT_SEASON[currentAct]] && (
              <img
                key={streetViewUrls[ACT_SEASON[currentAct]]}
                src={streetViewUrls[ACT_SEASON[currentAct]]}
                className="absolute inset-0 h-full w-full object-cover"
                style={{ animation: "sim-act-fade 1200ms ease" }}
                alt=""
              />
            )}

            {/* Layer 3 — act tint (season + time of day), crossfades between acts */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundColor: currentAct ? ACT_TINT[currentAct] : "transparent",
                transition: "background-color 2000ms ease",
              }}
            />

            {/* Layer 4 — ambient weather (snow / leaves / petals / sun haze) */}
            {currentAct && runState !== "done" && (
              <SeasonalAtmosphere season={ACT_SEASON[currentAct]} />
            )}

            {/* Season label top-left */}
            {currentAct && (
              <div className="absolute left-4 top-4 z-[1200] sm:left-6 sm:top-6">
                <span
                  key={currentAct}
                  className="inline-block border-l-2 bg-black/46 px-3 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-white backdrop-blur-sm"
                  style={{ animation: "sim-act-fade 800ms ease", borderColor: ACT_ACCENT[currentAct] }}
                >
                  {`${ACT_SEASON[currentAct].charAt(0).toUpperCase()}${ACT_SEASON[currentAct].slice(1)} · ${{ 1: "Morning", 2: "Midday", 3: "Afternoon", 4: "Night" }[currentAct]}`}
                </span>
              </div>
            )}

            {/* Act progress dots top-center */}
            <div className="absolute left-1/2 top-6 z-[1200] flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/38 px-3 py-2 backdrop-blur-sm">
              {([1, 2, 3, 4] as SimAct[]).map((act) => (
                <span
                  key={act}
                  style={currentAct === act || completedActs.includes(act) ? { backgroundColor: ACT_ACCENT[act] } : undefined}
                  className={`inline-block h-2 w-8 rounded-full transition-all ${
                    completedActs.includes(act)
                      ? ""
                      : currentAct === act
                        ? "animate-pulse"
                        : "bg-white/30"
                  }`}
                />
              ))}
            </div>

            {/* Back button top-right */}
            <button
              type="button"
              onClick={stopAutoRun}
              aria-label="Back to neighborhood"
              className="absolute right-4 top-4 z-[1200] rounded-[var(--radius-sm)] border border-white/14 bg-black/46 px-3 py-2 text-xs font-bold text-white backdrop-blur-sm hover:bg-black/70 sm:right-6 sm:top-6"
            >
              End screening
            </button>

            {/* Narrative overlay — hidden when done */}
            {runState !== "done" && (
              <div
                key={currentAct ?? "none"}
                className="absolute left-4 top-1/2 z-[1100] max-h-[58vh] w-[min(440px,calc(100vw-2rem))] -translate-y-1/2 overflow-y-auto border-l-2 bg-black/58 p-5 text-white shadow-2xl backdrop-blur-md sm:left-6 sm:p-6"
                style={{ animation: "sim-act-fade 800ms ease", borderColor: currentAct ? ACT_ACCENT[currentAct] : "white" }}
              >
                <p className="film-caption mb-4 text-white/42">
                  Act {currentAct ?? "—"} · {neighborhood}
                </p>
                {actNarrative ? (
                  <div className="space-y-3">
                    {actNarrative.split(/\n\n+/).filter(Boolean).map((para, i) => (
                      <p key={i} className="whitespace-pre-line text-sm leading-relaxed">{para.trim()}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/60">
                    Pulling {currentAct ? ACT_SEASON[currentAct] : "season"} data…
                  </p>
                )}
              </div>
            )}

            {/* Verdict screen */}
            {runState === "done" && profile && (
              <SimVerdict
                neighborhood={neighborhood}
                profile={profile}
                actDataSummaries={actDataSummaries}
                onDebrief={handleVerdictDebrief}
                onTryAnother={handleVerdictTryAnother}
                isDemoMode={isDemoMode}
                savedRunId={savedRunId}
              />
            )}

            {/* Data card bottom-left */}
            {monthDataSummary && currentAct && (
              <div className="absolute bottom-5 left-4 z-[1200] hidden rounded-[var(--radius-md)] border border-white/12 bg-black/62 px-4 py-3 text-xs text-white backdrop-blur-md sm:block sm:left-6">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                  {ACT_SEASON[currentAct].charAt(0).toUpperCase()}{ACT_SEASON[currentAct].slice(1)} Snapshot
                </div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-1.5">
                  {monthDataSummary.commuteMinutes != null && (
                    <div>
                      <span className="text-white/50">Commute </span>
                      <span className="font-semibold">
                        <AnimatedCounter
                          to={monthDataSummary.commuteMinutes}
                          from={(currentAct > 1 ? actDataSummaries[(currentAct - 1) as SimAct]?.commuteMinutes : null) ?? 0}
                        /> min
                      </span>
                      {(() => {
                        const prev = currentAct > 1 ? actDataSummaries[(currentAct - 1) as SimAct]?.commuteMinutes : null;
                        if (prev != null && monthDataSummary.commuteMinutes != null) {
                          const delta = monthDataSummary.commuteMinutes - prev;
                          if (Math.abs(delta) >= 2) return <span className={`ml-1 ${delta > 0 ? "text-red-400" : "text-green-400"}`}>{delta > 0 ? `+${delta}` : delta}</span>;
                        }
                        return null;
                      })()}
                    </div>
                  )}
                  {monthDataSummary.avgRent != null && (
                    <div>
                      <span className="text-white/50">Rent </span>
                      <span className="font-semibold">${monthDataSummary.avgRent.toLocaleString()}/mo</span>
                    </div>
                  )}
                  {monthDataSummary.crime != null && (
                    <div>
                      <span className="text-white/50">Crime </span>
                      <span className="font-semibold">
                        <AnimatedCounter
                          to={monthDataSummary.crime}
                          from={(currentAct > 1 ? actDataSummaries[(currentAct - 1) as SimAct]?.crime : null) ?? 0}
                        /> incidents
                      </span>
                      {(() => {
                        const prev = currentAct > 1 ? actDataSummaries[(currentAct - 1) as SimAct]?.crime : null;
                        if (prev != null && monthDataSummary.crime != null) {
                          const pct = Math.round(((monthDataSummary.crime - prev) / Math.max(prev, 1)) * 100);
                          if (Math.abs(pct) >= 5) return <span className={`ml-1 ${pct > 0 ? "text-red-400" : "text-green-400"}`}>{pct > 0 ? `+${pct}%` : `${pct}%`}</span>;
                        }
                        return null;
                      })()}
                    </div>
                  )}
                  {monthDataSummary.requests311 != null && (
                    <div>
                      <span className="text-white/50">311 requests </span>
                      <span className="font-semibold">
                        <AnimatedCounter
                          to={monthDataSummary.requests311}
                          from={(currentAct > 1 ? actDataSummaries[(currentAct - 1) as SimAct]?.requests311 : null) ?? 0}
                        />
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Minimap bottom-right — hidden on the verdict screen (currentAct is null) */}
            {sceneCoords && currentAct && (
            <div className="absolute bottom-4 right-4 z-[1200] h-[132px] w-[132px] overflow-hidden rounded-[var(--radius-md)] border border-white/24 shadow-xl sm:bottom-6 sm:right-6 sm:h-[190px] sm:w-[190px]">
                <SimPlayerMap
                  neighborhoodName={neighborhood}
                  homeCoords={{ lat: sceneCoords.lat, lng: sceneCoords.lng }}
                  workplaceCoords={workplaceCoords}
                  workplaceName={profile?.workplace ?? "Workplace"}
                  simMonth={ACT_MONTH[currentAct]}
                  isRunning={runState === "running"}
                  mapActions={activeMapActions}
                  season={ACT_SEASON[currentAct]}
                  monthDataSummary={monthDataSummary ?? undefined}
                />
            </div>
            )}

            {/* Pause/Resume bottom-center */}
            {runState !== "done" && (
              <button
                type="button"
                onClick={togglePause}
                className="absolute bottom-4 left-1/2 z-[1200] -translate-x-1/2 rounded-[var(--radius-sm)] border border-white/14 bg-black/58 px-4 py-2 text-sm font-bold text-white backdrop-blur-sm hover:bg-black/70 sm:bottom-6"
              >
                {runState === "paused" ? "▶ Resume" : "⏸ Pause"}
              </button>
            )}
          </div>
        ) : showInterstitial ? (
          /* ── Season ticket — the moment before the year begins ── */
          <SeasonTicket
            neighborhood={neighborhood}
            profile={profile}
            sceneCoords={sceneCoords ? { lat: sceneCoords.lat, lng: sceneCoords.lng } : null}
            isDemoMode={isDemoMode}
            authPrompt={authPrompt === "year" ? authPrompt : null}
            onDismissAuthPrompt={() => setAuthPrompt(null)}
            onBegin={() => void startAutoRun()}
            onSkip={() => setIdleView("debrief")}
            onBackToMatches={() => {
              stopAutoRun();
              setStep("neighborhood");
            }}
          />
        ) : (
        <main className="grid min-h-0 flex-1 pb-[72px] lg:grid-cols-[minmax(0,1fr)_420px] lg:grid-rows-1 lg:pb-0">
          <section className={`relative min-h-0 overflow-hidden bg-black/20 ${mobilePanel !== "map" ? "max-lg:hidden" : ""}`}>
            <div className="relative h-full w-full overflow-hidden bg-black/35 shadow-2xl">
              <div className="relative h-full min-h-[360px] w-full lg:min-h-0">
                {sceneMode === "map" && sceneCoords ? (
                  <SimulationMap
                    neighborhoodName={neighborhood}
                    neighborhoodCoords={{ lat: sceneCoords.lat, lng: sceneCoords.lng }}
                    workplaceCoords={workplaceCoords}
                    workplaceName={profile?.workplace}
                    mapActions={activeMapActions}
                  />
                ) : sceneCoords ? (
                  <MapillaryStreetView lat={sceneCoords.lat} lng={sceneCoords.lng} month={month} neighborhoodName={neighborhood} />
                ) : (
                  <Skybox
                    month={month}
                    crimeSignal={0}
                    serviceSignal={null}
                    transitSignal={0}
                    fullBleed
                    showElements
                  />
                )}
                {sceneMode === "street" && (
                  <SeasonalStreetOverlay month={month} monthName={monthName} neighborhood={neighborhood} />
                )}
                <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex flex-wrap items-start justify-between gap-3 bg-gradient-to-b from-black/60 to-transparent px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-bold text-white/75">
                      {sceneMode === "map" ? "Interactive map" : sceneMode === "city3d" ? "3D city view" : "Street view"}
                    </p>
                    <div className="pointer-events-auto flex rounded-[var(--radius-sm)] border border-white/20 bg-black/45 p-0.5 shadow-sm backdrop-blur">
                      {(["street", "map"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={sceneMode === mode}
                          onClick={() => setSceneMode(mode)}
                          className={`rounded-[var(--radius-sm)] px-2 py-1 text-xs font-bold transition-colors ${
                            sceneMode === mode
                              ? "bg-white text-[color:var(--foreground)]"
                              : "text-white/75 hover:bg-white/15 hover:text-white"
                          }`}
                        >
                          {mode === "street" ? "Street" : "Map"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="rounded-[var(--radius-sm)] bg-black/42 px-2 py-1 text-xs font-bold text-white">{monthName} {SIM_YEAR}</p>
                </div>
                {sceneMode === "street" && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[900] bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-8 pt-16">
                    <p className="ml-14 text-2xl font-semibold leading-tight text-white">{neighborhood}</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className={`flex min-h-0 flex-col border-t border-white/10 bg-[color:var(--panel-solid)] text-[color:var(--foreground)] shadow-2xl backdrop-blur-md lg:border-l lg:border-t-0 lg:border-white/10 ${mobilePanel !== "advisor" ? "max-lg:hidden" : ""}`}>
            <>
                <div className="border-b border-[color:var(--panel-border)] px-5 py-4">
                  <p className="film-caption text-[color:var(--muted)]">
                    {hasCompletedRun ? "After the film · Investigate the year" : "Neighborhood investigation"}
                  </p>
                  <h2 className="film-display mt-1 text-2xl leading-tight text-[color:var(--foreground)]">
                    Ask Sam about {neighborhood}
                  </h2>
                  <p className="mt-1 text-xs font-bold text-[color:var(--muted)]">
                    {currentSeasonAct
                      ? `${ACT_SEASON[currentSeasonAct].charAt(0).toUpperCase()}${ACT_SEASON[currentSeasonAct].slice(1)} · ${monthName} ${SIM_YEAR}`
                      : `${monthName} ${SIM_YEAR}`}
                  </p>
                </div>

                {authPrompt && (
                  <div className="border-b border-[color:var(--panel-border)] px-5 py-4">
                    <AuthGateCard reason={authPrompt} onDismiss={() => setAuthPrompt(null)} />
                  </div>
                )}

                <div className="atlas-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-6">
                  <div className="mx-auto flex max-w-2xl flex-col gap-5 lg:max-w-none">
                    {earlierGroups.length > 0 && (
                      <details className="rounded-[var(--radius-lg)] border border-[color:var(--panel-border)] bg-white/45 px-4 py-3 text-sm text-[color:var(--muted)]">
                        <summary className="cursor-pointer select-none text-xs font-bold text-[color:var(--muted)]">
                          Earlier months
                        </summary>
                        <div className="mt-4 space-y-5">
                          {earlierGroups.map((group) => (
                            <div key={group.key} className="space-y-2 border-t border-[color:var(--panel-border)] pt-4 first:border-t-0 first:pt-0">
                              <p className="text-xs font-bold text-[color:var(--muted)]">
                                {MONTH_NAMES[group.month - 1]} {group.year}
                              </p>
                              <div className="space-y-2 opacity-80">
                                {group.messages.map((msg, i) => (
                                  <MessageBubble key={`${group.key}-${msg.kind}-${i}`} message={msg} compact />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    <section className="space-y-4">
                      <p className="film-caption text-[color:var(--muted)]">Current chapter</p>

                      {currentMessages.length === 0 && !loading && !openingThinking && (
                        <div className="space-y-3 rounded-[var(--radius-lg)] border border-[color:var(--panel-border)] bg-white/58 px-4 py-4">
                          <p className="text-sm font-semibold text-[color:var(--muted)]">Sam will open this month here.</p>
                        </div>
                      )}

                      {currentMessages.map((msg, i) => (
                        <div key={`${currentGroupKey}-${msg.kind}-${i}`} className="space-y-3">
                          <MessageBubble message={msg} />
                        </div>
                      ))}
                    </section>

                    <section className="space-y-3 border-t border-[color:var(--panel-border)] pt-5">
                      <p className="film-caption text-[color:var(--muted)]">Investigate this chapter</p>
                      {renderSuggestedQuestionChips()}
                    </section>

                    {openingThinking && (
                      <div className="flex justify-start">
                        <div className="rounded-[var(--radius-lg)] rounded-tl-[var(--radius-sm)] border border-[color:var(--panel-border)] bg-white/72 px-4 py-3 text-sm text-[color:var(--muted)] shadow-sm">
                          Sam is thinking...
                        </div>
                      </div>
                    )}

                    {loading && (
                      <div className="flex justify-start">
                        <div className="rounded-[var(--radius-lg)] rounded-tl-[var(--radius-sm)] border border-[color:var(--panel-border)] bg-white/72 px-4 py-3 text-sm text-[color:var(--muted)] shadow-sm">
                          Sam is thinking...
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className="flex justify-start">
                        <div className="rounded-[var(--radius-lg)] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                          {error}
                        </div>
                      </div>
                    )}

                    {lastToolsUsed.length > 0 && !loading && (
                      <details className="rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-white/58 px-4 py-3">
                        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-extrabold text-[color:var(--muted-strong)]">
                          <Sparkles size={14} /> Civic evidence behind this answer
                        </summary>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {lastToolsUsed.map((tool) => {
                            const evidence = toolEvidence(tool);
                            return (
                              <span
                                key={tool}
                                title={evidence.detail}
                                className="rounded-[var(--radius-sm)] border border-[rgba(101,151,184,0.3)] bg-[rgba(101,151,184,0.12)] px-2.5 py-1.5 text-xs font-bold text-[color:var(--lake-strong)]"
                              >
                                {evidence.label}
                              </span>
                            );
                          })}
                        </div>
                        <div className="mt-3 grid gap-2">
                          {lastToolsUsed.map((tool) => {
                            const evidence = toolEvidence(tool);
                            return (
                              <p key={`${tool}-detail`} className="text-xs font-semibold leading-5 text-[color:var(--muted)]">
                                <span className="font-extrabold text-[color:var(--foreground)]">{evidence.label}:</span> {evidence.detail}
                              </p>
                            );
                          })}
                        </div>
                      </details>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                </div>

                <footer className="border-t border-[color:var(--panel-border)] bg-[rgba(255,250,242,0.94)] px-5 py-4">
                  <form
                    onSubmit={(e) => { e.preventDefault(); void chat.send(input); }}
                    className="mx-auto flex max-w-2xl gap-2 lg:max-w-none"
                  >
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={`Investigate ${neighborhood} in ${monthName}...`}
                      disabled={loading}
                      className="atlas-input flex-1 px-4 py-2.5 text-sm disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || loading}
                      className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[color:var(--accent)] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-[color:var(--accent-strong)] disabled:opacity-40"
                    >
                      <Send size={15} /> <span className="hidden sm:inline">Send</span>
                    </button>
                  </form>
                </footer>
            </>
          </section>

          <section className={`min-h-0 overflow-y-auto bg-[color:var(--panel-solid)] px-5 py-5 text-[color:var(--foreground)] lg:hidden ${mobilePanel !== "seasons" ? "hidden" : ""}`}>
            <div className="mx-auto grid max-w-2xl gap-4">
              <div>
                <p className="atlas-kicker text-[color:var(--muted)]">Seasons</p>
                <h2 className="mt-2 text-2xl font-extrabold">{neighborhood} in {SIM_YEAR}</h2>
              </div>
              <div className="grid gap-2">
                {SEASON_ORDER.map((act) => {
                  const isCurrent = currentSeasonAct === act;
                  const label = ACT_SEASON[act].charAt(0).toUpperCase() + ACT_SEASON[act].slice(1);
                  return (
                    <button
                      key={`mobile-season-${act}`}
                      type="button"
                      onClick={() => {
                        changeMonth(ACT_MONTH[act]);
                        setMobilePanel("advisor");
                      }}
                      className={`flex items-center justify-between rounded-[var(--radius-md)] border px-4 py-3 text-left text-sm font-bold ${
                        isCurrent
                          ? "border-[color:var(--amber)] bg-[rgba(231,173,78,0.18)] text-[color:var(--foreground)]"
                          : "border-[color:var(--panel-border)] bg-white/70 text-[color:var(--muted-strong)]"
                      }`}
                    >
                      <span>{label} · {MONTH_NAMES[ACT_MONTH[act] - 1]} {SIM_YEAR}</span>
                      <span className="text-xs text-[color:var(--muted)]">{isCurrent ? "current" : "ask about it"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </main>
        )}

        {runState === "idle" && !showInterstitial && (
          <nav className="fixed inset-x-0 bottom-0 z-[1300] grid grid-cols-3 border-t border-[color:var(--panel-border)] bg-[rgba(255,249,238,0.96)] px-3 py-2 text-[color:var(--foreground)] shadow-[0_-14px_34px_rgba(38,49,38,0.16)] backdrop-blur lg:hidden">
            {[
              { id: "map" as const, label: "Map", Icon: MapIcon },
              { id: "advisor" as const, label: "Advisor", Icon: MessageCircle },
              { id: "seasons" as const, label: "Seasons", Icon: CalendarDays },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMobilePanel(id)}
                className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] text-xs font-extrabold ${
                  mobilePanel === id
                    ? "bg-[color:var(--foreground)] text-white"
                    : "text-[color:var(--muted-strong)]"
                }`}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
