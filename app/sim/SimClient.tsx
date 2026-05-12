"use client";

import { useEffect, useRef, useState } from "react";
import { AuthActions } from "@/components/AuthActions";
import { Skybox } from "@/components/Skybox";
import type { ChatMessage, UserProfile } from "@/lib/tools/types";
import dynamic from "next/dynamic";
import { OnboardingProfileForm } from "./OnboardingProfileForm";
import { NEIGHBORHOOD_COORDINATES } from "@/lib/neighborhoodCoordinates";
import type { MapNeighborhood } from "@/components/NeighborhoodMap";
import { DEMO_PROFILE, DEMO_NEIGHBORHOOD, DEMO_MONTH, DEMO_BRIEF, matchDemoQA } from "@/lib/demoData";

const NeighborhoodMap = dynamic(
  () => import("@/components/NeighborhoodMap").then((m) => m.NeighborhoodMap),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse rounded-2xl bg-[color:var(--panel-border)]" /> },
);
const SimulationMap = dynamic(
  () => import("@/components/SimulationMap").then((m) => m.SimulationMap),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-white/20" /> },
);
const StreetViewPanorama = dynamic(
  () => import("@/components/StreetViewPanorama").then((m) => m.StreetViewPanorama),
  { ssr: false },
);

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "profile" | "neighborhood" | "sim";
type SceneMode = "street" | "map";

interface AgentResponse {
  response?: string;
  toolsUsed?: string[];
  sessionId?: string;
  error?: string;
}

interface NeighborhoodMatch {
  communityAreaNumber: number;
  name: string;
  slug: string;
  descriptors: string[];
  matchReason: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const SUGGESTED_QUESTIONS = [
  "What is crime like here this month?",
  "What is my morning commute like?",
  "How responsive is the city to service issues?",
  "What can I do on weekends here?",
  "Can I afford to live here?",
];

const ALL_NEIGHBORHOODS = NEIGHBORHOOD_COORDINATES.map((c) => c.name).sort();

function getProfileWorkplaceCoords(profile: UserProfile | null) {
  if (!profile) return null;

  const { workplaceLat, workplaceLng } = profile;
  if (
    typeof workplaceLat === "number" &&
    typeof workplaceLng === "number" &&
    Number.isFinite(workplaceLat) &&
    Number.isFinite(workplaceLng)
  ) {
    return { lat: workplaceLat, lng: workplaceLng };
  }

  const legacyProfile = profile as UserProfile & { lat?: unknown; lng?: unknown };
  if (
    typeof legacyProfile.lat === "number" &&
    typeof legacyProfile.lng === "number" &&
    Number.isFinite(legacyProfile.lat) &&
    Number.isFinite(legacyProfile.lng)
  ) {
    return { lat: legacyProfile.lat, lng: legacyProfile.lng };
  }

  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SimClient() {
  const [step, setStep] = useState<Step>("profile");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [neighborhood, setNeighborhood] = useState("Hyde Park");
  const [month, setMonth] = useState(10);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Neighborhood step state
  const [matchMode, setMatchMode] = useState<"known" | "match" | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matches, setMatches] = useState<NeighborhoodMatch[]>([]);
  const [matchError, setMatchError] = useState<string | null>(null);

  // Sim step state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastToolsUsed, setLastToolsUsed] = useState<string[]>([]);
  const [sceneMode, setSceneMode] = useState<SceneMode>("street");
  const [briefLoading, setBriefLoading] = useState(false);

  // Demo mode — activated by ?demo=1 in the URL
  const [isDemoMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("demo") === "1";
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-start demo mode on mount
  useEffect(() => {
    if (!isDemoMode) return;
    handleProfileComplete(DEMO_PROFILE);
    // pickNeighborhood is called inside handleProfileComplete flow; we do it
    // manually here because we also need to set the month first.
    setMonth(DEMO_MONTH);
    setNeighborhood(DEMO_NEIGHBORHOOD);
    setMessages([]);
    setSessionId(null);
    setSceneMode("street");
    setStep("sim");
    setBriefLoading(false);
    setMessages([{ role: "assistant", content: DEMO_BRIEF }]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoMode]);


  // ── Profile complete ────────────────────────────────────────────────────────

  function handleProfileComplete(p: UserProfile) {
    setProfile(p);
    setStep("neighborhood");
    setMatchMode(null);
    setMatches([]);
    setMatchError(null);
  }

  // ── Proactive monthly brief ─────────────────────────────────────────────────

  async function fetchBrief(targetNeighborhood: string, targetMonth: number, currentProfile: UserProfile) {
    if (isDemoMode) {
      // Demo mode: brief is already seeded via the mount effect
      return;
    }
    setBriefLoading(true);
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          neighborhood: targetNeighborhood,
          month: targetMonth,
          year: 2024,
          profile: currentProfile,
        }),
      });
      const data = (await res.json()) as { response?: string; error?: string };
      if (res.ok && data.response) {
        setMessages([{ role: "assistant", content: data.response }]);
      }
    } catch {
      // Brief failure is silent — user can still ask questions
    } finally {
      setBriefLoading(false);
    }
  }

  // ── Neighborhood matching ───────────────────────────────────────────────────

  async function runMatching() {
    if (!profile) return;
    setMatchLoading(true);
    setMatchError(null);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, topN: 5 }),
      });
      const data = (await res.json()) as { matches?: NeighborhoodMatch[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Matching failed");
      setMatches(data.matches ?? []);
    } catch (err) {
      setMatchError(err instanceof Error ? err.message : "Could not load matches");
    } finally {
      setMatchLoading(false);
    }
  }

  function pickNeighborhood(name: string) {
    setNeighborhood(name);
    setMessages([]);
    setSessionId(null);
    setSceneMode("street");
    setStep("sim");
    if (profile) void fetchBrief(name, month, profile);
  }

  // ── Chat send ───────────────────────────────────────────────────────────────

  async function send(question: string) {
    if (!question.trim() || !profile || loading) return;

    const userMessage = question.trim();
    setInput("");
    setError(null);
    setLastToolsUsed([]);

    // Demo mode: serve pre-canned answer if question matches
    if (isDemoMode) {
      const match = matchDemoQA(userMessage, month);
      if (match) {
        setMessages((prev) => [
          ...prev,
          { role: "user", content: userMessage },
          { role: "assistant", content: match.answer },
        ]);
        setLastToolsUsed(match.toolsUsed);
        return;
      }
    }

    const next: ChatMessage[] = [...messages, { role: "user", content: userMessage }];
    setMessages(next);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          neighborhood,
          month,
          year: 2024,
          profile,
          history: messages,
          sessionId,
        }),
      });

      const data = (await res.json()) as AgentResponse;
      if (!res.ok || data.error) throw new Error(data.error ?? "Agent request failed");
      if (!data.response) throw new Error("Empty response from agent");

      setMessages([...next, { role: "assistant", content: data.response }]);
      if (data.toolsUsed) setLastToolsUsed(data.toolsUsed);
      if (data.sessionId && !sessionId) setSessionId(data.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Profile step
  // ══════════════════════════════════════════════════════════════════════════════

  if (step === "profile") {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[color:var(--background)] px-6 py-8 text-[color:var(--foreground)]">
        <div aria-hidden="true" className="absolute inset-0">
          <Skybox
            month={6}
            crimeSignal={0}
            serviceSignal={null}
            transitSignal={0}
            fullBleed
            showElements={false}
          />
        </div>
        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-8">
          <header>
            <div className="flex items-center justify-between gap-4 rounded-full border border-white/20 bg-white/10 px-4 py-3 shadow-sm backdrop-blur-md">
              <p className="text-[13px] font-black uppercase tracking-[0.22em] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
                CITYLIVING SIM
              </p>
              <AuthActions />
            </div>
            <h1 className="mt-6 text-3xl font-semibold text-white">Set up your living profile</h1>
          </header>
          <section className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-6 shadow-[var(--shadow)]">
            <p className="text-sm text-[color:var(--muted)]">
              Your answers shape every response — the simulation speaks from your perspective, not generically.
            </p>
            <OnboardingProfileForm onComplete={handleProfileComplete} />
          </section>
        </div>
      </main>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Neighborhood selection step
  // ══════════════════════════════════════════════════════════════════════════════

  if (step === "neighborhood") {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[color:var(--background)] px-6 py-8 text-[color:var(--foreground)]">
        <div aria-hidden="true" className="absolute inset-0">
          <Skybox
            month={10}
            crimeSignal={0}
            serviceSignal={null}
            transitSignal={0}
            fullBleed
            showElements={false}
          />
        </div>
        <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col gap-6 pt-12">
          <header>
            <div className="flex items-center justify-between gap-4 rounded-full border border-white/20 bg-white/10 px-4 py-3 shadow-sm backdrop-blur-md">
              <p className="text-[13px] font-black uppercase tracking-[0.22em] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
                CITYLIVING SIM
              </p>
              <AuthActions />
            </div>
            <h1 className="mt-6 text-3xl font-semibold text-white">Where do you want to simulate?</h1>
          </header>

          {/* Path picker */}
          {!matchMode && (
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => setMatchMode("known")}
                className="rounded-2xl border border-white/20 bg-white/10 p-6 text-left text-white backdrop-blur transition hover:bg-white/20"
              >
                <p className="text-lg font-semibold">I have a neighborhood in mind</p>
                <p className="mt-1 text-sm text-white/70">Pick from any of Chicago&apos;s 77 community areas</p>
              </button>
              <button
                onClick={() => { setMatchMode("match"); void runMatching(); }}
                className="rounded-2xl border border-white/20 bg-white/10 p-6 text-left text-white backdrop-blur transition hover:bg-white/20"
              >
                <p className="text-lg font-semibold">Help me find one</p>
                <p className="mt-1 text-sm text-white/70">We&apos;ll score all 77 neighborhoods against your profile</p>
              </button>
            </div>
          )}

          {/* Known path: dropdown of all 77 */}
          {matchMode === "known" && (
            <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-6 shadow-[var(--shadow)]">
              <label className="grid gap-3 text-sm font-semibold">
                Choose a neighborhood
                <select
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="rounded-xl border border-[color:var(--panel-border)] bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--accent)]"
                >
                  {ALL_NEIGHBORHOODS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => pickNeighborhood(neighborhood)}
                  className="rounded-full bg-[color:var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)]"
                >
                  Simulate {neighborhood} →
                </button>
                <button
                  onClick={() => setMatchMode(null)}
                  className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                >
                  ← Back
                </button>
              </div>
            </div>
          )}

          {/* Match path */}
          {matchMode === "match" && (
            <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-6 shadow-[var(--shadow)]">
              {matchLoading && (
                <p className="text-sm text-[color:var(--muted)]">Scoring all 77 neighborhoods against your profile…</p>
              )}
              {matchError && (
                <p className="text-sm text-red-600">{matchError}</p>
              )}
              {!matchLoading && !matchError && matches.length === 0 && (
                <p className="text-sm text-[color:var(--muted)]">
                  No matches returned — Supabase may not have data loaded, or the API key needs updating.
                </p>
              )}
              {!matchLoading && matches.length > 0 && (() => {
                const mapNeighborhoods: MapNeighborhood[] = matches.map((m, i) => {
                  const coord = NEIGHBORHOOD_COORDINATES.find(
                    (c) => c.communityAreaNumber === m.communityAreaNumber,
                  );
                  return {
                    communityAreaNumber: m.communityAreaNumber,
                    name: m.name,
                    lat: coord?.lat ?? 41.878,
                    lng: coord?.lng ?? -87.629,
                    rank: i + 1,
                    matchReason: m.matchReason,
                  };
                });
                const workplaceCoords = getProfileWorkplaceCoords(profile);
                return (
                  <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                    {/* Map */}
                    <div className="order-first h-[340px] lg:order-last lg:h-auto lg:min-h-[420px]">
                      <NeighborhoodMap
                        neighborhoods={mapNeighborhoods}
                        workplaceCoords={workplaceCoords}
                        workplaceName={profile?.workplace}
                        onSelect={pickNeighborhood}
                      />
                    </div>
                    {/* Cards */}
                    <div>
                      <p className="mb-3 text-sm font-semibold">Top matches for your profile:</p>
                      <ul className="grid gap-2">
                        {matches.map((m, i) => (
                          <li key={m.communityAreaNumber}>
                            <button
                              onClick={() => pickNeighborhood(m.name)}
                              className="w-full rounded-xl border border-[color:var(--panel-border)] bg-white p-3 text-left transition hover:border-[color:var(--accent)] hover:shadow"
                            >
                              <div className="flex items-start gap-2">
                                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent)] text-[10px] font-bold text-white">
                                  {i + 1}
                                </span>
                                <div>
                                  <p className="font-semibold text-[color:var(--foreground)]">{m.name}</p>
                                  {m.matchReason && (
                                    <p className="mt-0.5 text-xs text-[color:var(--foreground)]">{m.matchReason}</p>
                                  )}
                                </div>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })()}
              <button
                onClick={() => setMatchMode(null)}
                className="mt-4 text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
              >
                ← Back
              </button>
            </div>
          )}

          <button
            onClick={() => setStep("profile")}
            className="text-sm text-white/60 hover:text-white"
          >
            ← Edit profile
          </button>
        </div>
      </main>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Simulation step
  // ══════════════════════════════════════════════════════════════════════════════

  const monthName = MONTH_NAMES[month - 1] ?? "this month";
  const sceneCoords = NEIGHBORHOOD_COORDINATES.find((c) => c.name === neighborhood);
  const workplaceCoords = getProfileWorkplaceCoords(profile);

  return (
    <div className="relative h-screen overflow-hidden bg-[#101820] text-white">
      <div aria-hidden="true" className="absolute inset-0">
        <Skybox
          month={month}
          crimeSignal={0}
          serviceSignal={null}
          transitSignal={0}
          fullBleed
          showElements={false}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_34%_26%,rgba(255,255,255,0.16),transparent_28%),linear-gradient(180deg,rgba(6,10,14,0.12)_0%,rgba(6,10,14,0.72)_100%)]" />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        {isDemoMode && (
          <div className="flex items-center justify-between gap-2 bg-[#e8b84b] px-4 py-1.5 text-xs font-semibold text-[#182027]">
            <span>Demo mode — Hyde Park × October 2024</span>
            <a href="/sim" className="underline opacity-70 hover:opacity-100">Exit demo</a>
          </div>
        )}
        <header className="flex flex-col gap-3 border-b border-white/15 bg-black/35 px-4 py-3 shadow-lg backdrop-blur-md sm:flex-row sm:items-center sm:gap-4">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex shrink-0 items-center gap-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">
                Neighborhood
              </label>
              <select
                value={neighborhood}
                onChange={(e) => {
                  const next = e.target.value;
                  setNeighborhood(next);
                  setMessages([]);
                  setSessionId(null);
                  setSceneMode("street");
                  if (profile) void fetchBrief(next, month, profile);
                }}
                className="rounded-lg border border-white/20 bg-white/95 px-2 py-1 text-sm text-[color:var(--foreground)] outline-none focus:border-[#e8b84b]"
              >
                {ALL_NEIGHBORHOODS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-1 gap-0.5 overflow-x-auto">
              {MONTH_SHORT.map((name, i) => (
                <button
                  key={name}
                  onClick={() => setMonth(i + 1)}
                  className={`shrink-0 rounded px-2 py-1 text-xs font-medium transition-colors ${
                    month === i + 1
                      ? "bg-[#e8b84b] text-[#182027]"
                      : "text-white/65 hover:bg-white/15 hover:text-white"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <button
              onClick={() => setStep("neighborhood")}
              className="text-xs text-white/65 hover:text-white"
            >
              ← Change neighborhood
            </button>
            <AuthActions className="border-white/20 bg-white/15" />
          </div>
        </header>

        <main className="grid min-h-0 flex-1 grid-rows-[minmax(280px,42vh)_1fr] lg:grid-cols-[minmax(0,1fr)_430px] lg:grid-rows-1">
          <section className="flex min-h-0 items-center justify-center px-4 py-4 sm:px-6 lg:px-8">
            <div className="relative flex h-full w-full items-center justify-center">
              <div className="relative w-full max-w-[640px] overflow-hidden rounded-lg border border-white/20 bg-black/35 shadow-2xl">
                <div className="relative aspect-square">
                  {sceneMode === "map" && sceneCoords ? (
                    <SimulationMap
                      neighborhoodName={neighborhood}
                      neighborhoodCoords={{ lat: sceneCoords.lat, lng: sceneCoords.lng }}
                      workplaceCoords={workplaceCoords}
                      workplaceName={profile?.workplace}
                    />
                  ) : sceneCoords ? (
                    <StreetViewPanorama lat={sceneCoords.lat} lng={sceneCoords.lng} month={month} />
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
                  <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 bg-gradient-to-b from-black/60 to-transparent px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
                        {sceneMode === "map" ? "Interactive map" : "Street View"}
                      </p>
                      <div className="pointer-events-auto flex rounded-md border border-white/20 bg-black/45 p-0.5 shadow-sm backdrop-blur">
                        {(["street", "map"] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            aria-pressed={sceneMode === mode}
                            onClick={() => setSceneMode(mode)}
                            className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${
                              sceneMode === mode
                                ? "bg-white text-[#182027]"
                                : "text-white/75 hover:bg-white/15 hover:text-white"
                            }`}
                          >
                            {mode === "street" ? "Street View" : "Map"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="rounded bg-black/42 px-2 py-1 text-xs font-medium text-white">{monthName} 2024</p>
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-4 pt-16">
                    <p className="text-2xl font-semibold leading-tight text-white">{neighborhood}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="flex min-h-0 flex-col border-t border-white/15 bg-[rgba(255,250,242,0.92)] text-[color:var(--foreground)] shadow-2xl backdrop-blur-md lg:border-l lg:border-t-0">
            <div className="border-b border-[color:var(--panel-border)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-(--muted)">SAM · {neighborhood} LOCAL</p>
              <p className="mt-1 text-sm font-medium">{monthName} 2024</p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
              <div className="mx-auto flex max-w-2xl flex-col gap-4 lg:max-w-none">
                {messages.length === 0 && !loading && (
                  <div className="rounded-lg border border-[color:var(--panel-border)] bg-white/85 p-4 shadow-sm">
                    {briefLoading ? (
                      <p className="text-sm text-[color:var(--muted)]">Sam is preparing your monthly overview…</p>
                    ) : (
                      <>
                        <p className="text-sm font-semibold">Start the month</p>
                        <div className="mt-4 grid gap-2">
                          {SUGGESTED_QUESTIONS.map((q) => (
                            <button
                              key={q}
                              onClick={() => void send(q)}
                              className="rounded-lg border border-[color:var(--panel-border)] bg-white px-3 py-2 text-left text-xs font-medium text-[color:var(--muted)] transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-lg rounded-lg px-4 py-3 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-[color:var(--accent)] text-white"
                          : "border border-[color:var(--panel-border)] bg-white/88"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="rounded-lg border border-[color:var(--panel-border)] bg-white/88 px-4 py-3 text-sm text-[color:var(--muted)]">
                      Sam is thinking...
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex justify-start">
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                      {error}
                    </div>
                  </div>
                )}

                {lastToolsUsed.length > 0 && !loading && (
                  <p className="text-center text-xs text-[color:var(--muted)]">
                    ↳ {lastToolsUsed.join(", ")}
                  </p>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            <footer className="border-t border-[color:var(--panel-border)] bg-white/78 px-4 py-3">
              <form
                onSubmit={(e) => { e.preventDefault(); void send(input); }}
                className="mx-auto flex max-w-2xl gap-2 lg:max-w-none"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`Ask about ${neighborhood} in ${monthName}...`}
                  disabled={loading}
                  className="flex-1 rounded-lg border border-[color:var(--panel-border)] bg-white px-4 py-2.5 text-sm outline-none focus:border-[color:var(--accent)] disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="rounded-lg bg-[color:var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)] disabled:opacity-40"
                >
                  Ask
                </button>
              </form>
            </footer>
          </section>
        </main>
      </div>
    </div>
  );
}
