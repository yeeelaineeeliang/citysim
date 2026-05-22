"use client";

import { useEffect, useRef, useState } from "react";
import type { UserProfile, MapAction, EntertainmentSummaryMapAction } from "@/lib/tools/types";
import { buildWeekSchedule, type DayEvent } from "@/lib/dailySchedule";
import { fetchOSRMRoute, commuteMode } from "@/lib/fetchRoute";
import { NEIGHBORHOOD_COORDINATES } from "@/lib/neighborhoodCoordinates";
import { getScenesForNeighborhood } from "@/lib/neighborhoodScenes";
import type { SimMessage } from "@/lib/simMessages";
import { createSimMessage, bearingTo, getProfileWorkplaceCoords, SIM_YEAR } from "../helpers";
import type { AuthPromptReason, MobilePanel, RunState, SceneMode, Step } from "../types";

interface UseSimRunParams {
  profile: UserProfile | null;
  neighborhood: string;
  month: number;
  setMonth: (m: number) => void;
  step: Step;
  setMessages: React.Dispatch<React.SetStateAction<SimMessage[]>>;
  setActiveMapActions: React.Dispatch<React.SetStateAction<MapAction[]>>;
  activeMapActions: MapAction[];
  isDemoMode: boolean;
  isSignedIn: boolean | undefined;
  authLoaded: boolean;
  setMobilePanel: (p: MobilePanel) => void;
  setAuthPrompt: (r: AuthPromptReason | null) => void;
  setSceneMode: (s: SceneMode) => void;
}

export function useSimRun({
  profile,
  neighborhood,
  month,
  setMonth,
  step,
  setMessages,
  setActiveMapActions,
  activeMapActions,
  isDemoMode,
  isSignedIn,
  authLoaded,
  setMobilePanel,
  setAuthPrompt,
  setSceneMode,
}: UseSimRunParams) {
  const [runState, setRunState] = useState<RunState>("idle");
  const [completedMonths, setCompletedMonths] = useState<number[]>([]);
  const [autoRunMonth, setAutoRunMonth] = useState<number | null>(null);
  const [autoRunNarrative, setAutoRunNarrative] = useState<string>("");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isAnimatingCommute, setIsAnimatingCommute] = useState(false);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [commuteRouteCoords, setCommuteRouteCoords] = useState<[number, number][]>([]);
  const [timeProgress, setTimeProgress] = useState(0);
  const [dailySchedule, setDailySchedule] = useState<DayEvent[]>([]);
  const [currentEvent, setCurrentEvent] = useState<DayEvent | null>(null);
  const [streetViewCoords, setStreetViewCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [streetViewHeading, setStreetViewHeading] = useState(0);

  const runStateRef = useRef<RunState>("idle");
  const monthSummariesRef = useRef<Record<number, string>>({});
  const prevDwellCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const prefetchChunksRef = useRef<string[]>([]);
  const prefetchActionsRef = useRef<MapAction[] | null>(null);
  const prefetchDoneRef = useRef(false);

  // Fetch road-snapped commute route from OSRM once per (neighborhood × workplace)
  useEffect(() => {
    if (step !== "sim" || !profile) return;
    const workCoords = getProfileWorkplaceCoords(profile);
    if (!workCoords) return;
    const homePt = NEIGHBORHOOD_COORDINATES.find((c) => c.name === neighborhood);
    if (!homePt) return;

    setCommuteRouteCoords([]);
    fetchOSRMRoute(
      { lat: homePt.lat, lng: homePt.lng },
      workCoords,
      commuteMode(profile.commutePref),
    ).then(({ coords }) => {
      if (coords && coords.length >= 2) setCommuteRouteCoords(coords);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, neighborhood, profile?.workplaceLat, profile?.workplaceLng]);

  // Rebuild daily schedule when entertainment data or active month changes
  useEffect(() => {
    if (!profile) return;
    const homePt = NEIGHBORHOOD_COORDINATES.find((c) => c.name === neighborhood);
    if (!homePt) return;
    const workCoords = getProfileWorkplaceCoords(profile);

    const entertainmentAction = activeMapActions.find(
      (a): a is EntertainmentSummaryMapAction => a.type === "entertainment_summary",
    );
    const parks = entertainmentAction?.parks ?? [];
    const center = entertainmentAction?.center ?? { lat: homePt.lat, lng: homePt.lng };
    const targetMonth = autoRunMonth ?? month;

    setDailySchedule(
      buildWeekSchedule(
        profile,
        { lat: homePt.lat, lng: homePt.lng },
        workCoords,
        center,
        parks,
        targetMonth,
        neighborhood,
      ),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMapActions, autoRunMonth, neighborhood, profile]);

  // Drive Street View position from avatar's current schedule event
  useEffect(() => {
    if (runState === "idle" || !currentEvent) return;
    if (currentEvent.kind === "transit") return;

    const scenes = getScenesForNeighborhood(neighborhood);
    const wc = getProfileWorkplaceCoords(profile);
    let coord: { lat: number; lng: number };

    switch (currentEvent.kind) {
      case "work":
        coord = wc ?? scenes.commercial; break;
      case "lunch": case "errand": case "social":
        coord = scenes.commercial; break;
      case "park":
        coord = scenes.park; break;
      default:
        coord = scenes.residential;
    }

    if (prevDwellCoordsRef.current) {
      const dist = Math.hypot(coord.lat - prevDwellCoordsRef.current.lat, coord.lng - prevDwellCoordsRef.current.lng);
      if (dist > 0.0001) setStreetViewHeading(bearingTo(prevDwellCoordsRef.current, coord));
    }
    prevDwellCoordsRef.current = coord;
    setStreetViewCoords(coord);
  }, [currentEvent, runState, neighborhood, profile]);

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

      const hasPrefetch = prefetchChunksRef.current.length > 0;

      if (hasPrefetch) {
        if (prefetchActionsRef.current?.length) setActiveMapActions(prefetchActionsRef.current);

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

        if (!prefetchDoneRef.current && !cancelled) {
          try {
            const prevSummaries = Object.entries(monthSummariesRef.current)
              .filter(([k]) => Number(k) < m)
              .sort((a, b) => Number(a[0]) - Number(b[0]))
              .slice(-3)
              .map(([, v]) => v);
            const res = await fetch("/api/sim-month", {
              method: "POST",
              signal: abortController.signal,
              headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
              body: JSON.stringify({ neighborhood, month: m, year: SIM_YEAR, profile, prevMonthSummaries: prevSummaries }),
            });
            if (res.headers.get("content-type")?.includes("text/event-stream")) {
              const extra = await drainSSE(res, m, setActiveMapActions, (text) => setAutoRunNarrative(text));
              if (extra) fullNarrative = extra;
            }
          } catch { /* continue */ }
        }
        prefetchDoneRef.current = false;
      } else {
        try {
          const prevSummaries = Object.entries(monthSummariesRef.current)
            .filter(([k]) => Number(k) < m)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .slice(-3)
            .map(([, v]) => v);
          const res = await fetch("/api/sim-month", {
            method: "POST",
            signal: abortController.signal,
            headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
            body: JSON.stringify({ neighborhood, month: m, year: SIM_YEAR, profile, prevMonthSummaries: prevSummaries }),
          });

          if (res.headers.get("content-type")?.includes("text/event-stream")) {
            fullNarrative = await drainSSE(res, m, setActiveMapActions, (text) => setAutoRunNarrative(text));
          } else {
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
        const sentences = fullNarrative.match(/[^.!?]+[.!?]+/g) ?? [];
        const summary = sentences.slice(0, 2).join(" ").trim();
        if (summary) monthSummariesRef.current = { ...monthSummariesRef.current, [m]: summary };
      }

      await new Promise<void>((resolve) => setTimeout(resolve, 1200));
      if (cancelled) return;

      setCompletedMonths((prev) => [...prev, m]);
      setMonth(m);

      if (m < 12) {
        setIsTransitioning(true);
        await new Promise<void>((resolve) => setTimeout(resolve, 900));
        if (cancelled) return;
        setIsTransitioning(false);
        await new Promise<void>((resolve) => setTimeout(resolve, 80));
        if (cancelled) return;
      } else {
        await new Promise<void>((resolve) => setTimeout(resolve, 600));
        if (cancelled) return;
      }

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

  function startAutoRun() {
    if (runState !== "idle" || !profile) return;
    if (!isDemoMode && (!authLoaded || !isSignedIn)) {
      setAuthPrompt("year");
      setMobilePanel("advisor");
      return;
    }
    setAuthPrompt(null);
    setRunState("running");
    runStateRef.current = "running";
    setCompletedMonths([]);
    setAutoRunNarrative("");
    prefetchChunksRef.current = [];
    prefetchActionsRef.current = null;
    prefetchDoneRef.current = false;
    monthSummariesRef.current = {};
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
    setStreetViewCoords(null);
    setStreetViewHeading(0);
    prevDwellCoordsRef.current = null;
  }

  return {
    runState,
    completedMonths,
    autoRunMonth,
    autoRunNarrative,
    isTransitioning,
    isAnimatingCommute,
    routeCoords,
    commuteRouteCoords,
    timeProgress,
    dailySchedule,
    currentEvent, setCurrentEvent,
    streetViewCoords,
    streetViewHeading,
    startAutoRun,
    togglePause,
    stopAutoRun,
  };
}
