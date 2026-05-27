"use client";

import { useEffect, useRef, useState } from "react";
import { SignInButton, SignUpButton, useUser } from "@clerk/nextjs";
import { ArrowLeft, CalendarDays, ListChecks, LockKeyhole, MapIcon, MessageCircle, Play, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { AuthActions } from "@/components/AuthActions";
import { SeasonalStreetOverlay } from "@/components/SeasonalStreetOverlay";
import { Skybox } from "@/components/Skybox";
import { WeatherLayer } from "@/components/WeatherLayer";
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
import { useSimProfile } from "./hooks/useSimProfile";
import { useSimChat } from "./hooks/useSimChat";
import { useSimRun } from "./hooks/useSimRun";
import { ProfileOnboardingShell } from "./ProfileOnboardingShell";
import {
  createSimMessage,
  getProfileWorkplaceCoords,
  ALL_NEIGHBORHOODS,
  MONTH_NAMES,
  MONTH_SHORT,
  SIM_YEAR,
  SUGGESTED_QUESTIONS,
} from "./helpers";
import type { AuthPromptReason, MobilePanel, SceneMode, Step } from "./types";

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
const AnimatedSimMap = dynamic(
  () => import("@/components/AnimatedSimMap").then((m) => m.AnimatedSimMap),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-[#1a2530]" /> },
);
const DailyLifePanel = dynamic(
  () => import("@/components/DailyLifePanel").then((m) => m.DailyLifePanel),
  { ssr: false },
);
const SeasonTransitionCard = dynamic(
  () => import("@/components/SeasonTransitionCard").then((m) => m.SeasonTransitionCard),
  { ssr: false },
);
const SimAvatarScene = dynamic(
  () => import("@/components/SimAvatarScene").then((m) => m.SimAvatarScene),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-[#0d1520]" /> },
);

// ─── UI-only helpers ──────────────────────────────────────────────────────────

const MATCH_RANK_COLORS = ["#295C88", "#3F78A5", "#5B95BD", "#7CB6D0", "#A7D6E3"];

function matchRankColor(rank: number) {
  return MATCH_RANK_COLORS[rank - 1] ?? MATCH_RANK_COLORS[MATCH_RANK_COLORS.length - 1] ?? "#6f8d5f";
}

function commuteModePhrase(mode?: UserProfile["commutePref"]) {
  if (mode === "driving") return "drive";
  if (mode === "walking") return "walk";
  if (mode === "biking") return "bike";
  return "by bus/transit";
}

function displayMatchSummary(value: string | undefined, commutePref?: UserProfile["commutePref"]) {
  if (!value) return null;
  return value.replace(/^~(\d+)\s+min\s+from\b/i, `~$1 min ${commuteModePhrase(commutePref)} from`);
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

function displayWorkplaceContext(workplace?: string) {
  const trimmed = workplace?.trim();
  if (!trimmed || trimmed.toLowerCase() === "not specified") return null;
  const withoutChicago = trimmed.replace(/,\s*Chicago(?:,\s*(?:IL|Illinois))?$/i, "");
  return withoutChicago.replace(/^The University of Chicago$/i, "University of Chicago");
}

function AuthGateCard({
  reason,
  onDismiss,
}: {
  reason: AuthPromptReason;
  onDismiss: () => void;
}) {
  const title = reason === "year" ? "Save your profile to run the year" : "Save your profile to ask Sam";
  const body =
    reason === "year"
      ? "The full month-by-month simulation uses protected AI calls and keeps your profile available after sign-in."
      : "Sam uses protected grounded tools for personalized answers, maps, and session history.";

  return (
    <div className="rounded-[var(--radius-md)] border border-[rgba(101,151,184,0.36)] bg-[rgba(101,151,184,0.12)] p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 text-[color:var(--lake-strong)]">
          <LockKeyhole size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-[color:var(--foreground)]">{title}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-[color:var(--muted)]">{body}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <SignInButton mode="modal">
              <button type="button" className="atlas-button-secondary">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button type="button" className="atlas-button-primary">
                Create account
              </button>
            </SignUpButton>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-[var(--radius-md)] px-3 text-xs font-extrabold text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            >
              Keep previewing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SimClientProps {
  demoMode?: boolean;
}

export function SimClient({ demoMode = false }: Readonly<SimClientProps>) {
  const { isLoaded: authLoaded, isSignedIn } = useUser();
  const isDemoMode = demoMode;

  // Top-level UI state — shared across all three domains
  const [step, setStep] = useState<Step>("profile");
  const [month, setMonth] = useState(10);
  const [sceneMode, setSceneMode] = useState<SceneMode>("street");
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("map");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const currentMonthButtonRef = useRef<HTMLButtonElement | null>(null);

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

  const runData = useSimRun({
    profile: profileData.profile,
    neighborhood: profileData.neighborhood,
    month,
    setMonth,
    step,
    setMessages: chat.setMessages,
    setActiveMapActions: chat.setActiveMapActions,
    activeMapActions: chat.activeMapActions,
    isDemoMode,
    isSignedIn,
    authLoaded,
    setMobilePanel,
    setAuthPrompt: chat.setAuthPrompt,
    setSceneMode,
  });

  useEffect(() => {
    if (step !== "sim") return;
    currentMonthButtonRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [month, step]);

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

  // ── Neighborhood / month coordination ────────────────────────────────────────

  function pickNeighborhood(name: string) {
    profileData.setNeighborhood(name);
    setSessionId(null);
    chat.setActiveMapActions([]);
    setSceneMode("street");
    setStep("sim");
    setMobilePanel("map");
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
    if (profileData.profile) {
      void chat.fetchOpening(nextNeighborhood, month, profileData.profile, { reset: true });
    }
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
      <main className="atlas-page atlas-page-neighborhood min-h-screen px-5 py-5 text-[color:var(--foreground)] sm:px-8 sm:py-7">
        <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-[1760px] flex-col gap-6 sm:min-h-[calc(100vh-3.5rem)]">
          <header className="atlas-topbar">
            <a className="atlas-brand" href="/">
              <span className="atlas-brand-mark" />
              CityLiving Sim
            </a>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep("profile")}
                className="hidden text-xs font-bold tracking-[0.08em] text-[color:var(--foreground)] opacity-70 hover:opacity-100 sm:inline-flex"
              >
                Edit profile
              </button>
              <AuthActions />
            </div>
          </header>

          <section className="grid min-h-0 flex-1 gap-6 lg:h-[calc(100vh-8.25rem)] lg:max-h-[calc(100vh-8.25rem)] lg:min-h-[640px] lg:overflow-hidden lg:grid-cols-[340px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="atlas-card min-h-0 p-5 text-[color:var(--foreground)] lg:h-full lg:overflow-hidden">
              <div className="flex h-full min-h-0 flex-col gap-4">
                <div>
                  <p className="atlas-kicker text-[color:var(--muted)]">Neighborhood fit</p>
                  <div className="mt-2 flex items-center gap-2">
                    <ListChecks size={19} className="text-[color:var(--sage-strong)]" aria-hidden="true" />
                    <h1 className="text-2xl font-extrabold tracking-normal">Top matches</h1>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-[color:var(--muted)]">
                    {profileContext.length ? profileContext.join(" · ") : "Ranked against your profile."}
                  </p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
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
                        const rankColor = matchRankColor(match.rank);
                        const matchSummary = displayMatchSummary(match.matchReason, profileData.profile?.commutePref);
                        return (
                          <button
                            key={match.communityAreaNumber}
                            type="button"
                            onClick={() => profileData.setNeighborhood(match.name)}
                            style={active ? { borderColor: rankColor, backgroundColor: `${rankColor}14` } : undefined}
                            className={`grid grid-cols-[32px_minmax(0,1fr)] items-start gap-3 rounded-[var(--radius-md)] border p-3 text-left transition ${
                              active
                                ? "border-[color:var(--panel-border)] shadow-sm"
                                : "border-[color:var(--panel-border)] bg-white/64 hover:border-[color:var(--sage)] hover:bg-white/78"
                            }`}
                          >
                            <span
                              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold text-white shadow-sm"
                              style={{ backgroundColor: rankColor }}
                            >
                              {match.rank}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-extrabold text-[color:var(--foreground)]">{match.name}</span>
                              <span className="mt-0.5 block line-clamp-2 text-xs font-semibold leading-4 text-[color:var(--muted)]">
                                {matchSummary || match.descriptors?.slice(0, 2).join(" · ") || "Matches your profile"}
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
    runState, completedMonths, autoRunMonth, autoRunNarrative,
    isSeasonTransitioning, timeProgress, dailySchedule, currentEvent, setCurrentEvent,
    streetViewCoords, streetViewHeading, routeCoords, commuteRouteCoords,
    startAutoRun, togglePause, stopAutoRun,
  } = runData;

  const monthName = MONTH_NAMES[month - 1] ?? "this month";
  const sceneCoords = NEIGHBORHOOD_COORDINATES.find((c) => c.name === neighborhood);
  const workplaceCoords = getProfileWorkplaceCoords(profile);
  const messageGroups = groupMessagesByMonth(messages);
  const currentGroupKey = monthGroupKey(month, SIM_YEAR);
  const currentGroup = messageGroups.find((group) => group.key === currentGroupKey);
  const earlierGroups = messageGroups.filter((group) => group.key !== currentGroupKey);
  const currentMessages = currentGroup?.messages ?? [];

  return (
    <div className="relative h-screen overflow-hidden bg-[color:var(--sage-strong)] text-white">
      <div aria-hidden="true" className="absolute inset-0">
        <Skybox
          month={month}
          crimeSignal={0}
          serviceSignal={null}
          transitSignal={0}
          fullBleed
          showElements={false}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(79,111,69,0.12)_0%,rgba(79,111,69,0.54)_56%,rgba(38,49,38,0.86)_100%)]" />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        {isDemoMode && (
          <div className="flex items-center justify-between gap-2 bg-[color:var(--amber)] px-4 py-1.5 text-xs font-extrabold text-[color:var(--foreground)]">
            <span>Demo mode - Hyde Park x October {SIM_YEAR}</span>
            <a href="/sim" className="underline opacity-70 hover:opacity-100">Exit demo</a>
          </div>
        )}
        <header className="relative z-20 flex flex-col gap-3 overflow-visible border-b border-white/12 bg-[rgba(79,111,69,0.72)] px-3 py-2.5 shadow-lg backdrop-blur-xl md:flex-row md:items-center md:gap-4 md:px-4">
          <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <div className="flex min-w-0 shrink-0 items-center gap-2">
              <Link
                href="/profile"
                aria-label="Back to profile"
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-white/20 bg-white/12 px-2.5 text-xs font-extrabold text-white/85 shadow-sm backdrop-blur transition hover:bg-white/20 hover:text-white sm:px-3"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                <span className="hidden sm:inline">Profile</span>
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

            <div className={`atlas-scrollbar -mb-2 flex w-full min-w-0 flex-1 gap-1 overflow-x-auto pb-2 md:w-auto ${runState !== "idle" ? "hidden" : ""}`}>
              {MONTH_SHORT.map((name, i) => {
                const m = i + 1;
                const isCompleted = completedMonths.includes(m);
                const isCurrent = month === m;
                const isAutoRunning = autoRunMonth === m && runState === "running";
                return (
                  <button
                    key={name}
                    ref={isCurrent ? currentMonthButtonRef : undefined}
                    onClick={() => changeMonth(m)}
                    title={isCompleted ? `View ${name} recap` : undefined}
                    className={`relative shrink-0 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-xs font-bold transition-colors ${
                      isCompleted
                        ? "bg-[color:var(--park)] text-white"
                        : isAutoRunning
                          ? "bg-[color:var(--sage)] text-white"
                          : isCurrent
                            ? "bg-[color:var(--amber)] text-[color:var(--foreground)]"
                            : "text-white/65 hover:bg-white/15 hover:text-white"
                    }`}
                  >
                    {isCompleted ? `✓ ${name}` : name}
                    {isCurrent && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute left-1/2 top-full h-2 w-px -translate-x-1/2 bg-[color:var(--amber)]"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hidden shrink-0 items-center justify-between gap-3 md:flex">
            <AuthActions className="border-white/20 bg-white/15" />
          </div>
        </header>

        {/* Full-screen auto-run layout — Street View immersion */}
        {runState !== "idle" && sceneCoords && (() => {
          const sceneMonth = autoRunMonth ?? month;
          const streetHour = Math.round(7 + timeProgress * 16); // 7 AM → 11 PM arc
          return (
            <div data-testid="sim-avatar-scene" className="relative min-h-0 flex-1 overflow-hidden bg-black">
              {/* Layer 1: Mapillary street imagery — primary full-screen visual */}
              <div className="absolute inset-0">
                <MapillaryStreetView
                  lat={(streetViewCoords ?? sceneCoords).lat}
                  lng={(streetViewCoords ?? sceneCoords).lng}
                  month={sceneMonth}
                  hourOfDay={streetHour}
                  targetHeading={streetViewHeading}
                  neighborhoodName={neighborhood}
                  enableDrift
                />
              </div>
              {/* Layer 2: Avatar route map — corner inset, top-right */}
              <div
                data-testid="mini-map"
                style={{
                  position: "absolute",
                  top: 56,
                  right: 16,
                  width: 300,
                  height: 200,
                  zIndex: 1050,
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.18)",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
                }}
              >
                <SimAvatarScene
                  lat={sceneCoords.lat}
                  lng={sceneCoords.lng}
                  workplaceCoords={workplaceCoords}
                  routeCoords={routeCoords}
                  isAnimating={runState === "running"}
                  month={sceneMonth}
                  schedule={dailySchedule.length > 0 ? dailySchedule : undefined}
                  commuteRouteCoords={commuteRouteCoords.length > 0 ? commuteRouteCoords : undefined}
                  onEventChange={setCurrentEvent}
                  neighborhoodName={neighborhood}
                  workplaceName={profile?.workplace}
                  compact
                />
                {/* Label — tells the user what this map shows */}
                <div
                  style={{
                    position: "absolute", top: 0, left: 0, right: 0,
                    padding: "4px 7px",
                    fontSize: 9,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.65)",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    background: "linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)",
                    pointerEvents: "none",
                    zIndex: 1201,
                  }}
                >
                  Day route
                </div>
              </div>
              {/* Layer 3: CSS weather particles */}
              <WeatherLayer month={sceneMonth} />
              {/* Exit button */}
              <div className="absolute right-4 top-4 z-[1100]">
                <button
                  onClick={stopAutoRun}
                  className="rounded-[var(--radius-sm)] border border-white/20 bg-[rgba(19,33,43,0.82)] px-3 py-2 text-xs font-bold text-white/80 shadow backdrop-blur transition hover:bg-[color:var(--foreground)] hover:text-white"
                >
                  Exit
                </button>
              </div>
              {/* Narrative panel */}
              <DailyLifePanel
                monthName={MONTH_NAMES[sceneMonth - 1] ?? ""}
                month={sceneMonth}
                neighborhood={neighborhood}
                narrative={autoRunNarrative || (runState === "running" ? "Looking around…" : runState === "done" ? "Year complete." : "")}
                isPaused={runState === "paused"}
                onPauseToggle={togglePause}
                timeProgress={timeProgress}
                currentEvent={currentEvent ?? undefined}
              />
              {/* Season transition card — floats over Street View, no black screen */}
              <SeasonTransitionCard
                month={autoRunMonth ?? month}
                neighborhood={neighborhood}
                visible={isSeasonTransitioning}
              />
            </div>
          );
        })()}

        <main className={`grid min-h-0 flex-1 pb-[72px] lg:grid-cols-[minmax(0,1fr)_420px] lg:grid-rows-1 lg:pb-0 ${runState !== "idle" ? "hidden" : ""}`}>
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
                  ) : sceneCoords && runState === "idle" ? (
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
                        {sceneMode === "map" ? "Interactive map" : "Street view"}
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
                            {mode === "street" ? "Street view" : "Map"}
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
            <div className="border-b border-[color:var(--panel-border)] px-5 py-4">
              <p className="text-xs font-bold text-[color:var(--muted)]">Your simulation · {neighborhood}</p>
              <p className="mt-1 text-sm font-extrabold text-[color:var(--foreground)]">{monthName} {SIM_YEAR}</p>
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
                  <p className="text-xs font-bold text-[color:var(--muted)]">Current month</p>

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

                {runState === "idle" && (
                  <section>
                    <button
                      type="button"
                      onClick={startAutoRun}
                      className="group grid w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-white/58 px-4 py-3 text-left shadow-sm transition hover:border-[color:var(--sage)] hover:bg-white/78"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(111,141,95,0.14)] text-[color:var(--sage-strong)]">
                        <Play size={16} aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-extrabold text-[color:var(--foreground)]">
                          Run a year in {neighborhood}
                        </span>
                        <span className="mt-1 block text-xs font-semibold leading-5 text-[color:var(--muted)]">
                          4 seasons · Jan → Apr → Jul → Oct · ~2 min
                        </span>
                      </span>
                      <span className="rounded-[var(--radius-sm)] border border-[rgba(111,141,95,0.32)] px-2.5 py-1.5 text-xs font-extrabold text-[color:var(--sage-strong)] transition group-hover:bg-[color:var(--sage)] group-hover:text-white">
                        Start →
                      </span>
                    </button>
                  </section>
                )}

                <section className="space-y-3 border-t border-[color:var(--panel-border)] pt-5">
                  <p className="text-xs font-bold text-[color:var(--muted)]">Suggested questions</p>
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
                      <Sparkles size={14} /> Evidence used
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
                  placeholder={`Ask about ${neighborhood} in ${monthName}...`}
                  disabled={loading}
                  className="atlas-input flex-1 px-4 py-2.5 text-sm disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[color:var(--accent)] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-[color:var(--accent-strong)] disabled:opacity-40"
                >
                  <Send size={15} /> <span className="hidden sm:inline">Ask</span>
                </button>
              </form>
            </footer>
          </section>

          <section className={`min-h-0 overflow-y-auto bg-[color:var(--panel-solid)] px-5 py-5 text-[color:var(--foreground)] lg:hidden ${mobilePanel !== "timeline" ? "hidden" : ""}`}>
            <div className="mx-auto grid max-w-2xl gap-4">
              <div>
                <p className="atlas-kicker text-[color:var(--muted)]">Timeline</p>
                <h2 className="mt-2 text-2xl font-extrabold">{neighborhood} in {SIM_YEAR}</h2>
              </div>
              <div className="grid gap-2">
                {MONTH_SHORT.map((name, i) => {
                  const m = i + 1;
                  const isCompleted = completedMonths.includes(m);
                  const isCurrent = month === m;
                  return (
                    <button
                      key={`mobile-${name}`}
                      type="button"
                      onClick={() => {
                        changeMonth(m);
                        setMobilePanel("advisor");
                      }}
                      className={`flex items-center justify-between rounded-[var(--radius-md)] border px-4 py-3 text-left text-sm font-bold ${
                        isCurrent
                          ? "border-[color:var(--amber)] bg-[rgba(231,173,78,0.18)] text-[color:var(--foreground)]"
                          : "border-[color:var(--panel-border)] bg-white/70 text-[color:var(--muted-strong)]"
                      }`}
                    >
                      <span>{name} {SIM_YEAR}</span>
                      <span className="text-xs text-[color:var(--muted)]">{isCompleted ? "complete" : isCurrent ? "current" : "preview"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </main>

        {runState === "idle" && (
          <nav className="fixed inset-x-0 bottom-0 z-[1300] grid grid-cols-3 border-t border-[color:var(--panel-border)] bg-[rgba(255,249,238,0.96)] px-3 py-2 text-[color:var(--foreground)] shadow-[0_-14px_34px_rgba(38,49,38,0.16)] backdrop-blur lg:hidden">
            {[
              { id: "map" as const, label: "Map", Icon: MapIcon },
              { id: "advisor" as const, label: "Advisor", Icon: MessageCircle },
              { id: "timeline" as const, label: "Timeline", Icon: CalendarDays },
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
