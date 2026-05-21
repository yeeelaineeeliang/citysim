"use client";

import { useEffect, useRef, useState } from "react";
import { AuthActions } from "@/components/AuthActions";
import { SeasonalStreetOverlay } from "@/components/SeasonalStreetOverlay";
import { Skybox } from "@/components/Skybox";
import { WeatherLayer } from "@/components/WeatherLayer";
import {
  groupMessagesByMonth,
  monthGroupKey,
  toChatHistory,
  type SimMessage,
  type SimMessageKind,
} from "@/lib/simMessages";
import type { MapAction, UserProfile } from "@/lib/tools/types";
import dynamic from "next/dynamic";
import { OnboardingProfileForm } from "./OnboardingProfileForm";
import { NEIGHBORHOOD_COORDINATES } from "@/lib/neighborhoodCoordinates";
import type { MapNeighborhood } from "@/components/NeighborhoodMap";
import { DEMO_PROFILE, DEMO_NEIGHBORHOOD, DEMO_MONTH, DEMO_OPENING, matchDemoQA } from "@/lib/demoData";
import { straightLineCoords } from "@/lib/decodePolyline";

const NeighborhoodMap = dynamic(
  () => import("@/components/NeighborhoodMap").then((m) => m.NeighborhoodMap),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse rounded-2xl bg-[color:var(--panel-border)]" /> },
);
const SimulationMap = dynamic(
  () => import("@/components/SimulationMap").then((m) => m.SimulationMap),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-white/20" /> },
);
const MapboxStreetScene = dynamic(
  () => import("@/components/MapboxStreetScene").then((m) => m.MapboxStreetScene),
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
const SimAvatarScene = dynamic(
  () => import("@/components/SimAvatarScene").then((m) => m.SimAvatarScene),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-[#0d1520]" /> },
);

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "profile" | "neighborhood" | "sim";
type SceneMode = "street" | "map";
type RunState = "idle" | "running" | "paused" | "done";

interface AgentResponse {
  response?: string;
  toolsUsed?: string[];
  mapActions?: MapAction[];
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
const SIM_YEAR = 2024;

const SUGGESTED_QUESTIONS = [
  "What is crime like here this month?",
  "What is my morning commute like?",
  "How responsive is the city to service issues?",
  "What can I do on weekends here?",
  "Can I afford to live here?",
];

const ALL_NEIGHBORHOODS = NEIGHBORHOOD_COORDINATES.map((c) => c.name).sort();

function createSimMessage(role: SimMessage["role"], content: string, month: number, kind: SimMessageKind): SimMessage {
  return { role, content, month, year: SIM_YEAR, kind };
}

function timeProgressToHeading(p: number): number {
  if (p <= 0.10) return 45   // dawn — NE toward downtown
  if (p <= 0.40) return 110  // morning — SE residential
  if (p <= 0.60) return 220  // afternoon — SW commercial strip
  if (p <= 0.78) return 290  // dusk — W (sunset direction)
  return 170                  // night — S quieter blocks
}

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

function MessageBubble({ message, compact = false }: { message: SimMessage; compact?: boolean }) {
  const isUser = message.role === "user";
  const isOpener = message.kind === "opener";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[86%] rounded-2xl rounded-br-md bg-[color:var(--accent)] px-4 py-3 text-sm leading-relaxed text-white shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  if (isOpener && !compact) {
    return (
      <div className="rounded-2xl border border-[#dbcbb8] border-l-[#b7793e] bg-[#fffaf2]/95 px-5 py-4 text-[15px] leading-7 text-[#1d252b] shadow-sm">
        {message.content}
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div
        className={`max-w-[92%] rounded-2xl rounded-tl-md px-4 py-3 text-sm leading-relaxed text-[#1d252b] ${
          compact
            ? "bg-white/45 text-[#53616b]"
            : "border border-[#e2d7ca] bg-white/72 shadow-sm"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
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
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastToolsUsed, setLastToolsUsed] = useState<string[]>([]);
  const [activeMapActions, setActiveMapActions] = useState<MapAction[]>([]);
  const [sceneMode, setSceneMode] = useState<SceneMode>("street");
  const [openingThinking, setOpeningThinking] = useState(false);

  // Auto-run state
  const [runState, setRunState] = useState<RunState>("idle");
  const [completedMonths, setCompletedMonths] = useState<number[]>([]);
  const [autoRunMonth, setAutoRunMonth] = useState<number | null>(null);
  const [autoRunNarrative, setAutoRunNarrative] = useState<string>("");
  const [isAnimatingCommute, setIsAnimatingCommute] = useState(false);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const runStateRef = useRef<RunState>("idle");

  // Scene time progress — drives weather, lighting, and DailyLifePanel context
  const [timeProgress, setTimeProgress] = useState(0);

  // Demo mode — activated by ?demo=1 in the URL
  const [isDemoMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("demo") === "1";
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<SimMessage[]>([]);
  const openingRequestRef = useRef(0);
  const openingAbortRef = useRef<AbortController | null>(null);

  // Prefetch refs for N+1 month
  const prefetchChunksRef = useRef<string[]>([]);
  const prefetchActionsRef = useRef<MapAction[] | null>(null);
  const prefetchDoneRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, openingThinking]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    return () => openingAbortRef.current?.abort();
  }, []);

  // Auto-run loop — processes one month whenever runState === 'running' and autoRunMonth is set
  useEffect(() => {
    if (runState !== "running" || autoRunMonth === null || !profile) return;

    let cancelled = false;
    const abortController = new AbortController();

    async function drainSSE(
      res: Response,
      m: number,
      onTools: (actions: MapAction[]) => void,
      onChunk: (token: string) => void,
    ): Promise<string> {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      let toolsReceived = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done || cancelled) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          try {
            const evt = JSON.parse(line.slice(6)) as {
              type: string;
              mapActions?: MapAction[];
              toolsUsed?: string[];
              text?: string;
            };
            if (evt.type === "tools" && !toolsReceived) {
              toolsReceived = true;
              const actions = evt.mapActions ?? [];
              if (actions.length) onTools(actions);

              // Kick off prefetch for N+1 as soon as tools phase is done
              if (m < 12 && !cancelled) {
                prefetchChunksRef.current = [];
                prefetchActionsRef.current = null;
                prefetchDoneRef.current = false;
                fetch("/api/sim-month", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
                  body: JSON.stringify({ neighborhood, month: m + 1, year: SIM_YEAR, profile }),
                }).then(async (r) => {
                  if (cancelled || !r.body) return;
                  const rdr = r.body.getReader();
                  const dec = new TextDecoder();
                  let buf = "";
                  while (true) {
                    const { done: d, value: v } = await rdr.read();
                    if (d || cancelled) break;
                    buf += dec.decode(v, { stream: true });
                    const ps = buf.split("\n\n"); buf = ps.pop() ?? "";
                    for (const p of ps) {
                      const ln = p.split("\n").find((l) => l.startsWith("data: "));
                      if (!ln) continue;
                      try {
                        const e = JSON.parse(ln.slice(6)) as { type: string; mapActions?: MapAction[]; text?: string };
                        if (e.type === "tools" && e.mapActions) prefetchActionsRef.current = e.mapActions;
                        if (e.type === "chunk" && e.text) prefetchChunksRef.current.push(e.text);
                        if (e.type === "done") prefetchDoneRef.current = true;
                      } catch { /* skip */ }
                    }
                  }
                }).catch(() => { /* silent prefetch failure */ });
              }
            }
            if (evt.type === "chunk" && evt.text) {
              fullText += evt.text;
              onChunk(fullText);
              setTimeProgress(Math.min(1, fullText.length / 380));
            }
          } catch { /* skip malformed */ }
        }
      }
      return fullText;
    }

    async function processMonth() {
      const m = autoRunMonth!;
      setAutoRunNarrative("");
      setTimeProgress(0);
      let fullNarrative = "";

      // Check if we have a usable prefetch from the previous month
      const hasPrefetch = prefetchChunksRef.current.length > 0;

      if (hasPrefetch) {
        if (prefetchActionsRef.current?.length) setActiveMapActions(prefetchActionsRef.current);

        // Replay buffered tokens smoothly via rAF
        let replayText = "";
        for (const token of prefetchChunksRef.current) {
          if (cancelled) break;
          replayText += token;
          setAutoRunNarrative(replayText);
          setTimeProgress(Math.min(1, replayText.length / 380));
          await new Promise((r) => requestAnimationFrame(r));
        }
        fullNarrative = replayText;
        prefetchChunksRef.current = [];
        prefetchActionsRef.current = null;

        // If prefetch wasn't fully done, continue draining with a new fetch
        if (!prefetchDoneRef.current && !cancelled) {
          try {
            const res = await fetch("/api/sim-month", {
              method: "POST",
              signal: abortController.signal,
              headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
              body: JSON.stringify({ neighborhood, month: m, year: SIM_YEAR, profile }),
            });
            if (res.headers.get("content-type")?.includes("text/event-stream")) {
              const extra = await drainSSE(res, m, setActiveMapActions, (text) => setAutoRunNarrative(text));
              if (extra) fullNarrative = extra;
            }
          } catch { /* continue */ }
        }
        prefetchDoneRef.current = false;
      } else {
        // Normal fetch path
        try {
          const res = await fetch("/api/sim-month", {
            method: "POST",
            signal: abortController.signal,
            headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
            body: JSON.stringify({ neighborhood, month: m, year: SIM_YEAR, profile }),
          });

          if (res.headers.get("content-type")?.includes("text/event-stream")) {
            fullNarrative = await drainSSE(res, m, setActiveMapActions, (text) => setAutoRunNarrative(text));
          } else {
            // JSON fallback (old deployment or SSE not supported)
            const data = (await res.json()) as { response?: string; mapActions?: MapAction[] };
            fullNarrative = data.response ?? "";
            setAutoRunNarrative(fullNarrative);
            if (data.mapActions?.length) setActiveMapActions(data.mapActions);
          }
        } catch { /* continue even on error */ }
      }

      if (cancelled) return;

      if (fullNarrative) {
        setMessages((prev) => [...prev, createSimMessage("assistant", fullNarrative, m, "answer")]);
      }

      // 1200ms dwell after narrative completes (narrative itself provides the natural pacing)
      await new Promise<void>((resolve) => setTimeout(resolve, 1200));
      if (cancelled) return;

      setCompletedMonths((prev) => [...prev, m]);
      setMonth(m);

      await new Promise<void>((resolve) => setTimeout(resolve, 600));
      if (cancelled) return;

      if (runStateRef.current !== "running") return;

      if (m >= 12) {
        setRunState("done");
        runStateRef.current = "done";
        setAutoRunMonth(null);
      } else {
        setAutoRunMonth(m + 1);
      }
    }

    void processMonth();
    return () => {
      cancelled = true;
      abortController.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runState, autoRunMonth]);

  // Auto-start demo mode on mount
  useEffect(() => {
    if (!isDemoMode) return;
    setProfile(DEMO_PROFILE);
    setMonth(DEMO_MONTH);
    setNeighborhood(DEMO_NEIGHBORHOOD);
    setMessages([]);
    setSessionId(null);
    setActiveMapActions([]);
    setSceneMode("street");
    setStep("sim");
    setOpeningThinking(false);
    setMessages([createSimMessage("assistant", DEMO_OPENING, DEMO_MONTH, "opener")]);
  }, [isDemoMode]);


  // ── Profile complete ────────────────────────────────────────────────────────

  function handleProfileComplete(p: UserProfile) {
    setProfile(p);
    setStep("neighborhood");
    setMatchMode(null);
    setMatches([]);
    setMatchError(null);
  }

  // ── Auto-run controls ───────────────────────────────────────────────────────

  function startAutoRun() {
    if (runState !== "idle" || !profile) return;
    setRunState("running");
    runStateRef.current = "running";
    setCompletedMonths([]);
    setAutoRunNarrative("");
    prefetchChunksRef.current = [];
    prefetchActionsRef.current = null;
    prefetchDoneRef.current = false;
    setAutoRunMonth(month);
  }

  function togglePause() {
    if (runState === "running") {
      setRunState("paused");
      runStateRef.current = "paused";
    } else if (runState === "paused") {
      setRunState("running");
      runStateRef.current = "running";
      if (autoRunMonth !== null) {
        // re-trigger the effect by resetting to the same month
        setAutoRunMonth((m) => m);
      }
    }
  }

  function stopAutoRun() {
    setRunState("idle");
    runStateRef.current = "idle";
    setAutoRunMonth(null);
    setIsAnimatingCommute(false);
    setSceneMode("street");
  }

  // ── Sam monthly opener ──────────────────────────────────────────────────────

  function localOpeningFallback(targetNeighborhood: string, targetMonth: number) {
    const targetMonthName = MONTH_NAMES[targetMonth - 1] ?? "This month";
    return `${targetMonthName} in ${targetNeighborhood} changes the feel of the streets before you even ask a question. Ask me what you want to understand about being here.`;
  }

  function insertOpening(content: string, targetMonth: number, insertIndex: number) {
    setMessages((prev) => {
      const next = [...prev];
      next.splice(Math.min(insertIndex, next.length), 0, createSimMessage("assistant", content, targetMonth, "opener"));
      messagesRef.current = next;
      return next;
    });
  }

  async function fetchOpening(
    targetNeighborhood: string,
    targetMonth: number,
    currentProfile: UserProfile,
    options: { reset?: boolean } = {},
  ) {
    openingAbortRef.current?.abort();
    const requestId = openingRequestRef.current + 1;
    openingRequestRef.current = requestId;

    const insertIndex = options.reset ? 0 : messagesRef.current.length;
    if (options.reset) {
      messagesRef.current = [];
      setMessages([]);
    }

    setError(null);
    setLastToolsUsed([]);
    setOpeningThinking(false);

    if (isDemoMode) {
      insertOpening(
        targetMonth === DEMO_MONTH && targetNeighborhood === DEMO_NEIGHBORHOOD
          ? DEMO_OPENING
          : localOpeningFallback(targetNeighborhood, targetMonth),
        targetMonth,
        insertIndex,
      );
      return;
    }

    const controller = new AbortController();
    openingAbortRef.current = controller;
    const thinkingTimer = window.setTimeout(() => {
      if (openingRequestRef.current === requestId) setOpeningThinking(true);
    }, 2000);

    try {
      const res = await fetch("/api/opening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          neighborhood: targetNeighborhood,
          month: targetMonth,
          year: SIM_YEAR,
          profile: currentProfile,
        }),
      });
      const data = (await res.json()) as { response?: string; error?: string };
      if (openingRequestRef.current !== requestId) return;
      if (res.ok && data.response) {
        insertOpening(data.response, targetMonth, insertIndex);
      } else {
        insertOpening(localOpeningFallback(targetNeighborhood, targetMonth), targetMonth, insertIndex);
      }
    } catch (err) {
      if (openingRequestRef.current !== requestId) return;
      if (err instanceof Error && err.name === "AbortError") return;
      insertOpening(localOpeningFallback(targetNeighborhood, targetMonth), targetMonth, insertIndex);
    } finally {
      window.clearTimeout(thinkingTimer);
      if (openingRequestRef.current === requestId) {
        setOpeningThinking(false);
        openingAbortRef.current = null;
      }
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
    setSessionId(null);
    setActiveMapActions([]);
    setSceneMode("street");
    setStep("sim");
    if (profile) void fetchOpening(name, month, profile, { reset: true });
  }

  function changeMonth(nextMonth: number) {
    if (nextMonth === month) return;
    setMonth(nextMonth);
    setActiveMapActions([]);
    if (profile && step === "sim") void fetchOpening(neighborhood, nextMonth, profile);
  }

  function changeNeighborhood(nextNeighborhood: string) {
    if (nextNeighborhood === neighborhood) return;
    setNeighborhood(nextNeighborhood);
    setSessionId(null);
    setActiveMapActions([]);
    setSceneMode("street");
    if (profile) void fetchOpening(nextNeighborhood, month, profile, { reset: true });
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
          createSimMessage("user", userMessage, month, "user"),
          createSimMessage("assistant", match.answer, month, "answer"),
        ]);
        setLastToolsUsed(match.toolsUsed);
        if (match.mapActions?.length) {
          setActiveMapActions(match.mapActions);
          setSceneMode("map");
        }
        return;
      }
    }

    const next: SimMessage[] = [...messages, createSimMessage("user", userMessage, month, "user")];
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
          year: SIM_YEAR,
          profile,
          history: toChatHistory(messages),
          sessionId,
        }),
      });

      const data = (await res.json()) as AgentResponse;
      if (!res.ok || data.error) throw new Error(data.error ?? "Agent request failed");
      if (!data.response) throw new Error("Empty response from agent");

      setMessages([...next, createSimMessage("assistant", data.response, month, "answer")]);
      if (data.toolsUsed) setLastToolsUsed(data.toolsUsed);
      if (data.mapActions?.length) {
        setActiveMapActions(data.mapActions);
        setSceneMode("map");
      }
      if (data.sessionId && !sessionId) setSessionId(data.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  }

  function renderSuggestedQuestionChips() {
    return (
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => void send(q)}
            className="rounded-full border border-[#d8c9b8] bg-white/65 px-3 py-1.5 text-left text-xs font-medium text-[#53616b] transition-colors hover:border-[color:var(--accent)] hover:bg-white hover:text-[color:var(--accent)]"
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
  const messageGroups = groupMessagesByMonth(messages);
  const currentGroupKey = monthGroupKey(month, SIM_YEAR);
  const currentGroup = messageGroups.find((group) => group.key === currentGroupKey);
  const earlierGroups = messageGroups.filter((group) => group.key !== currentGroupKey);
  const currentMessages = currentGroup?.messages ?? [];
  const hasCurrentOpener = currentMessages.some((message) => message.kind === "opener");

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
            <span>Demo mode — Hyde Park × October {SIM_YEAR}</span>
            <a href="/sim" className="underline opacity-70 hover:opacity-100">Exit demo</a>
          </div>
        )}
        <header className="flex flex-col gap-3 border-b border-white/10 bg-[#26313a]/55 px-4 py-2.5 shadow-lg backdrop-blur-xl sm:flex-row sm:items-center sm:gap-4">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex shrink-0 items-center gap-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">
                Neighborhood
              </label>
              <select
                value={neighborhood}
                onChange={(e) => {
                  const next = e.target.value;
                  changeNeighborhood(next);
                }}
                className="rounded-lg border border-white/20 bg-white/95 px-2 py-1 text-sm text-[color:var(--foreground)] outline-none focus:border-[#e8b84b]"
              >
                {ALL_NEIGHBORHOODS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-1 gap-0.5 overflow-x-auto">
              {MONTH_SHORT.map((name, i) => {
                const m = i + 1;
                const isCompleted = completedMonths.includes(m);
                const isCurrent = month === m;
                const isAutoRunning = autoRunMonth === m && runState === "running";
                return (
                  <button
                    key={name}
                    onClick={() => changeMonth(m)}
                    className={`shrink-0 rounded px-2 py-1 text-xs font-medium transition-colors ${
                      isCompleted
                        ? "bg-[#2da55e] text-white"
                        : isAutoRunning
                          ? "bg-[#3a7bd5] text-white"
                          : isCurrent
                            ? "bg-[#e8b84b] text-[#182027]"
                            : "text-white/65 hover:bg-white/15 hover:text-white"
                    }`}
                  >
                    {isCompleted ? `✓` : name}
                  </button>
                );
              })}
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

        {/* Full-screen auto-run layout — 3D city-builder view */}
        {runState !== "idle" && sceneCoords && (() => {
          const sceneMonth = autoRunMonth ?? month;
          return (
            <div data-testid="sim-avatar-scene" className="relative min-h-0 flex-1 overflow-hidden">
              {/* Layer 1: Leaflet avatar scene — dark map, animated avatar, mini-map HUD */}
              <SimAvatarScene
                lat={sceneCoords.lat}
                lng={sceneCoords.lng}
                workplaceCoords={workplaceCoords}
                routeCoords={routeCoords}
                isAnimating={runState === "running"}
                month={sceneMonth}
              />
              {/* Layer 2: CSS weather particles — works over any background */}
              <WeatherLayer month={sceneMonth} />
              {/* Exit button */}
              <div className="absolute right-4 top-4 z-[1050]">
                <button
                  onClick={stopAutoRun}
                  className="rounded-full border border-white/20 bg-[#1a2530]/80 px-3 py-1.5 text-xs font-semibold text-white/80 shadow backdrop-blur transition hover:bg-[#1a2530] hover:text-white"
                >
                  ✕ Exit
                </button>
              </div>
              {/* Narrative panel */}
              <DailyLifePanel
                monthName={MONTH_NAMES[sceneMonth - 1] ?? ""}
                neighborhood={neighborhood}
                narrative={autoRunNarrative || (runState === "running" ? "Looking around…" : runState === "done" ? "Year complete." : "")}
                isPaused={runState === "paused"}
                onPauseToggle={togglePause}
                timeProgress={timeProgress}
              />
            </div>
          );
        })()}

        <main className={`grid min-h-0 flex-1 grid-rows-[minmax(360px,56vh)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_430px] lg:grid-rows-1 ${runState !== "idle" ? "hidden" : ""}`}>
          <section className="relative min-h-0 overflow-hidden bg-black/20">
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
                    <MapboxStreetScene lat={sceneCoords.lat} lng={sceneCoords.lng} month={month} />
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
                  {/* Hero CTA — overlaid on scene when simulation hasn't started */}
                  {runState === "idle" && (
                    <div className="absolute inset-0 z-[800] flex flex-col items-center justify-center px-6">
                      <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-black/55 px-6 py-7 text-center shadow-2xl backdrop-blur-md">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/60">
                          {neighborhood} · {monthName}
                        </p>
                        <h2 className="mb-1 text-2xl font-bold leading-tight text-white">
                          Simulate your year
                        </h2>
                        <p className="mb-5 text-sm leading-relaxed text-white/65">
                          A month-by-month story of your life here — commute, weather, city rhythms.
                        </p>
                        <button
                          onClick={startAutoRun}
                          className="w-full rounded-full bg-[color:var(--accent)] py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[color:var(--accent-strong)] active:scale-[0.97]"
                        >
                          ▶ Run my year in {neighborhood}
                        </button>
                        <p className="mt-4 text-xs text-white/45">
                          Or ask Sam a question in the chat →
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex flex-wrap items-start justify-between gap-3 bg-gradient-to-b from-black/60 to-transparent px-4 py-3">
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
                    <p className="rounded bg-black/42 px-2 py-1 text-xs font-medium text-white">{monthName} {SIM_YEAR}</p>
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[900] bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-4 pt-16">
                    <p className="text-2xl font-semibold leading-tight text-white">{neighborhood}</p>
                  </div>
              </div>
            </div>
          </section>

          <section className="flex min-h-0 flex-col border-t border-white/10 bg-[rgba(249,244,236,0.96)] text-[color:var(--foreground)] shadow-2xl backdrop-blur-md lg:border-l lg:border-t-0 lg:border-white/10">
            <div className="border-b border-[#e1d6c8] px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#68747c]">SAM · {neighborhood} LOCAL</p>
              <p className="mt-1 text-sm font-semibold text-[#1d252b]">{monthName} {SIM_YEAR}</p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
              <div className="mx-auto flex max-w-2xl flex-col gap-5 lg:max-w-none">
                {earlierGroups.length > 0 && (
                  <details className="rounded-2xl border border-[#e2d7ca] bg-white/35 px-4 py-3 text-sm text-[#53616b]">
                    <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-[0.18em] text-[#68747c]">
                      Earlier months
                    </summary>
                    <div className="mt-4 space-y-5">
                      {earlierGroups.map((group) => (
                        <div key={group.key} className="space-y-2 border-t border-[#e2d7ca] pt-4 first:border-t-0 first:pt-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#879099]">
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
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#68747c]">Current chapter</p>
                    <p className="text-xs font-medium text-[#879099]">{monthName} · {neighborhood}</p>
                  </div>

                  {currentMessages.length === 0 && !loading && !openingThinking && (
                    <div className="space-y-3 rounded-2xl border border-[#e2d7ca] bg-white/45 px-4 py-4">
                      <p className="text-sm text-[#53616b]">Sam will open this month here.</p>
                      {renderSuggestedQuestionChips()}
                    </div>
                  )}

                  {currentMessages.map((msg, i) => (
                    <div key={`${currentGroupKey}-${msg.kind}-${i}`} className="space-y-3">
                      <MessageBubble message={msg} />
                      {msg.kind === "opener" && renderSuggestedQuestionChips()}
                    </div>
                  ))}

                  {!hasCurrentOpener && currentMessages.length > 0 && renderSuggestedQuestionChips()}
                </section>

                {openingThinking && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-tl-md border border-[#e2d7ca] bg-white/72 px-4 py-3 text-sm text-[#53616b] shadow-sm">
                      Sam is thinking...
                    </div>
                  </div>
                )}

                {loading && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-tl-md border border-[#e2d7ca] bg-white/72 px-4 py-3 text-sm text-[#53616b] shadow-sm">
                      Sam is thinking...
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
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

            <footer className="border-t border-[#e1d6c8] bg-[#fbf6ef]/90 px-5 py-4">
              {runState === "idle" && (
                <div className="mx-auto mb-3 max-w-2xl lg:max-w-none">
                  <button
                    onClick={startAutoRun}
                    className="w-full rounded-xl bg-[color:var(--accent)] px-4 py-3 text-sm font-bold text-white transition hover:bg-[color:var(--accent-strong)]"
                  >
                    ▶ Run my year in {neighborhood}
                  </button>
                </div>
              )}
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
