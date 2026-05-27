"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UserProfile, MapAction, EntertainmentSummaryMapAction } from "@/lib/tools/types";
import { buildWeekSchedule, type DayEvent } from "@/lib/dailySchedule";
import { fetchOSRMRoute, commuteMode } from "@/lib/fetchRoute";
import { NEIGHBORHOOD_COORDINATES } from "@/lib/neighborhoodCoordinates";
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
  const [isSeasonTransitioning, setIsSeasonTransitioning] = useState(false);
  const [isAnimatingCommute, setIsAnimatingCommute] = useState(false);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [commuteRouteCoords, setCommuteRouteCoords] = useState<[number, number][]>([]);
  const [timeProgress, setTimeProgress] = useState(0);
  const [dailySchedule, setDailySchedule] = useState<DayEvent[]>([]);
  const [currentEvent, setCurrentEvent] = useState<DayEvent | null>(null);
  const [streetViewCoords, setStreetViewCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [streetViewHeading, setStreetViewHeading] = useState(0);

  // Four seasonal snapshots — Jan, Apr, Jul, Oct
  const SEASONS = [1, 4, 7, 10];

  const [waitingForContinue, setWaitingForContinue] = useState(false);
  const [summaryNarrative, setSummaryNarrative] = useState("");
  const [summaryMonth, setSummaryMonth] = useState<number | null>(null);

  const runStateRef = useRef<RunState>("idle");
  const monthSummariesRef = useRef<Record<number, string>>({});
  const prevDwellCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const prefetchChunksRef = useRef<string[]>([]);
  const prefetchActionsRef = useRef<MapAction[] | null>(null);
  const prefetchDoneRef = useRef(false);
  const narrativeRef = useRef("");
  const continueResolveRef = useRef<(() => void) | null>(null);

  // Fetch commute geometry once per (neighborhood x workplace). Transit uses the
  // local CTA GTFS route API; OSRM remains for walking/driving/biking only.
  useEffect(() => {
    if (step !== "sim" || !profile) return;
    const workCoords = getProfileWorkplaceCoords(profile);
    if (!workCoords) return;
    const homePt = NEIGHBORHOOD_COORDINATES.find((c) => c.name === neighborhood);
    if (!homePt) return;

    setCommuteRouteCoords([]);
    if (profile.commutePref === "transit") {
      fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: { lat: homePt.lat, lng: homePt.lng },
          destination: workCoords,
          modes: ["transit"],
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: unknown) => {
          const option = data && typeof data === "object"
            ? (data as { options?: Array<{ geometry?: [number, number][] }> }).options?.[0]
            : null;
          if (option?.geometry && option.geometry.length >= 2) setCommuteRouteCoords(option.geometry);
        })
        .catch(() => { /* route is optional */ });
      return;
    }

    fetchOSRMRoute(
      { lat: homePt.lat, lng: homePt.lng },
      workCoords,
      commuteMode(profile.commutePref),
    ).then(({ coords }) => {
      if (coords && coords.length >= 2) setCommuteRouteCoords(coords);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, neighborhood, profile?.commutePref, profile?.workplaceLat, profile?.workplaceLng]);

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
    const namedPlaces = entertainmentAction?.places;
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
        namedPlaces,
      ),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMapActions, autoRunMonth, neighborhood, profile]);

  // Drive Street View position directly from the avatar's current schedule event location
  useEffect(() => {
    if (runState === "idle" || !currentEvent) return;
    if (currentEvent.kind === "transit") return;

    // Use the event's actual coordinates — these already point to real named places
    const coord = { lat: currentEvent.location.lat, lng: currentEvent.location.lng };

    if (prevDwellCoordsRef.current) {
      const dist = Math.hypot(coord.lat - prevDwellCoordsRef.current.lat, coord.lng - prevDwellCoordsRef.current.lng);
      if (dist > 0.0001) setStreetViewHeading(bearingTo(prevDwellCoordsRef.current, coord));
    }
    prevDwellCoordsRef.current = coord;
    setStreetViewCoords(coord);
  }, [currentEvent, runState]);

  // Auto-run loop — processes one month whenever runState === 'running' and autoRunMonth is set
  useEffect(() => {
    if (runState !== "running" || autoRunMonth === null || !profile) return;

    let cancelled = false;
    const abortController = new AbortController();
    let clockId: ReturnType<typeof setInterval> | null = null;

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

      // Tick-based clock — advances 0→1 over 60s regardless of stream speed
      const clockStart = Date.now();
      const MONTH_MS = 60000;
      clockId = setInterval(() => {
        if (cancelled) { if (clockId) clearInterval(clockId); clockId = null; return; }
        setTimeProgress(Math.min(1, (Date.now() - clockStart) / MONTH_MS));
      }, 120);

      const hasPrefetch = prefetchChunksRef.current.length > 0;

      if (hasPrefetch) {
        if (prefetchActionsRef.current?.length) setActiveMapActions(prefetchActionsRef.current);

        let replayText = "";
        for (const token of prefetchChunksRef.current) {
          if (cancelled) break;
          replayText += token;
          setAutoRunNarrative(replayText);
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

      if (clockId) { clearInterval(clockId); clockId = null; }
      if (cancelled) return;

      if (fullNarrative) {
        setMessages((prev) => [...prev, createSimMessage("assistant", fullNarrative, m, "answer")]);
        const sentences = fullNarrative.match(/[^.!?]+[.!?]+/g) ?? [];
        const summary = sentences.slice(0, 2).join(" ").trim();
        if (summary) monthSummariesRef.current = { ...monthSummariesRef.current, [m]: summary };
      }

      await new Promise<void>((resolve) => setTimeout(resolve, 800));
      if (cancelled) return;

      setCompletedMonths((prev) => [...prev, m]);
      setMonth(m);

      const nextM = SEASONS[SEASONS.indexOf(m) + 1] ?? null;

      if (nextM !== null) {
        // Season transition card — slides in while Street View crossfades behind it
        setAutoRunMonth(nextM);
        setIsSeasonTransitioning(true);
        await new Promise<void>((resolve) => setTimeout(resolve, 2800));
        if (cancelled) return;
        setIsSeasonTransitioning(false);

        // Pause for "Month in Review" — user must click Continue before next month starts
        setSummaryNarrative(fullNarrative);
        setSummaryMonth(m);
        setWaitingForContinue(true);
        await new Promise<void>((resolve) => { continueResolveRef.current = resolve; });
        if (cancelled) return;
        setWaitingForContinue(false);
        continueResolveRef.current = null;
      } else {
        // Last month — brief pause before year-complete state
        setSummaryNarrative(fullNarrative);
        setSummaryMonth(m);
        setWaitingForContinue(true);
        await new Promise<void>((resolve) => { continueResolveRef.current = resolve; });
        if (cancelled) return;
        setWaitingForContinue(false);
        continueResolveRef.current = null;
        await new Promise<void>((resolve) => setTimeout(resolve, 300));
        if (cancelled) return;
      }

      if (runStateRef.current !== "running") return;

      if (nextM === null) {
        setRunState("done");
        runStateRef.current = "done";
        setAutoRunMonth(null);
      }
    }

    void processMonth();
    return () => {
      cancelled = true;
      abortController.abort();
      if (clockId) { clearInterval(clockId); clockId = null; }
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
    setWaitingForContinue(false);
    setSummaryNarrative("");
    setSummaryMonth(null);
    continueResolveRef.current = null;
    setAutoRunMonth(SEASONS[0] ?? 1);
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
    setWaitingForContinue(false);
    setSummaryNarrative("");
    setSummaryMonth(null);
    continueResolveRef.current?.();
    continueResolveRef.current = null;
  }

  const continueMonth = useCallback(() => {
    continueResolveRef.current?.();
  }, []);

  return {
    runState,
    completedMonths,
    autoRunMonth,
    autoRunNarrative,
    isSeasonTransitioning,
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
    waitingForContinue,
    summaryNarrative,
    summaryMonth,
    continueMonth,
  };
}
