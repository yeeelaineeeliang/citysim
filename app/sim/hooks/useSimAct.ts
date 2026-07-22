"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MapAction } from "@/lib/tools/types";
import type { DataSummary } from "@/lib/tools/types";
import { NEIGHBORHOOD_COORDINATES } from "@/lib/neighborhoodCoordinates";
import { DEMO_ACTS } from "@/lib/demoData";
import { SIM_YEAR } from "../helpers";
import type { AuthPromptReason, MobilePanel, RunState } from "../types";
import { ACT_MONTH, ACT_SEASON } from "../types";
import type { ActSeason, SimAct } from "../types";
import type { UserProfile } from "@/lib/tools/types";

interface UseSimActParams {
  profile: UserProfile | null;
  neighborhood: string;
  setActiveMapActions: React.Dispatch<React.SetStateAction<MapAction[]>>;
  isDemoMode: boolean;
  isSignedIn: boolean | undefined;
  authLoaded: boolean;
  setMobilePanel: (p: MobilePanel) => void;
  setAuthPrompt: (r: AuthPromptReason | null) => void;
}

export function useSimAct({
  profile,
  neighborhood,
  setActiveMapActions,
  isDemoMode,
  isSignedIn,
  authLoaded,
  setMobilePanel,
  setAuthPrompt,
}: UseSimActParams) {
  const [runState, setRunState] = useState<RunState>("idle");
  const [currentAct, setCurrentAct] = useState<SimAct | null>(null);
  const [actNarrative, setActNarrative] = useState<string>("");
  const [actDataSummaries, setActDataSummaries] = useState<Partial<Record<SimAct, DataSummary>>>({});
  const [savedRunId, setSavedRunId] = useState<string | null>(null);
  const [completedActs, setCompletedActs] = useState<SimAct[]>([]);
  const [streetViewUrls, setStreetViewUrls] = useState<Partial<Record<ActSeason, string>>>({});
  const [monthDataSummary, setMonthDataSummary] = useState<DataSummary | null>(null);

  const runStateRef = useRef<RunState>("idle");
  const prefetchChunksRef = useRef<string[]>([]);
  const prefetchActionsRef = useRef<MapAction[] | null>(null);
  const prefetchDoneRef = useRef(false);
  const prefetchSummaryRef = useRef<DataSummary | null>(null);
  const prevNarrativesRef = useRef<string[]>([]);
  // Mirrors actDataSummaries state — the act-4 completion branch needs the full
  // set synchronously, before React has applied the act-4 setState.
  const actDataSummariesRef = useRef<Partial<Record<SimAct, DataSummary>>>({});
  const runSavedRef = useRef(false);

  // Auto-run loop — processes one act whenever runState === 'running' and currentAct is set
  useEffect(() => {
    if (runState !== "running" || currentAct === null || !profile) return;

    let cancelled = false;
    const abortController = new AbortController();

    async function drainSSE(
      res: Response,
      act: SimAct,
      onTools: (actions: MapAction[]) => void,
      onChunk: (text: string) => void,
    ): Promise<{ fullText: string; dataSummary: DataSummary | null }> {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      let toolsReceived = false;
      let capturedSummary: DataSummary | null = null;

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
              dataSummary?: DataSummary;
              text?: string;
            };
            if (evt.type === "tools" && !toolsReceived) {
              toolsReceived = true;
              const actions = evt.mapActions ?? [];
              if (actions.length) onTools(actions);
              if (evt.dataSummary) {
                capturedSummary = evt.dataSummary;
                setMonthDataSummary(evt.dataSummary);
              }

              // Kick off prefetch for act N+1 as soon as tools phase is done
              if (act < 4 && !cancelled) {
                const nextAct = (act + 1) as SimAct;
                prefetchChunksRef.current = [];
                prefetchActionsRef.current = null;
                prefetchDoneRef.current = false;
                prefetchSummaryRef.current = null;
                fetch("/api/sim-month", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
                  body: JSON.stringify({
                    neighborhood,
                    month: ACT_MONTH[nextAct],
                    year: SIM_YEAR,
                    profile,
                    actContext: ACT_SEASON[nextAct],
                    prevMonthSummaries: prevNarrativesRef.current,
                  }),
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
                        const e = JSON.parse(ln.slice(6)) as { type: string; mapActions?: MapAction[]; dataSummary?: DataSummary; text?: string };
                        if (e.type === "tools" && e.mapActions) prefetchActionsRef.current = e.mapActions;
                        if (e.type === "tools" && e.dataSummary) prefetchSummaryRef.current = e.dataSummary;
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
      return { fullText, dataSummary: capturedSummary };
    }

    const MIN_ACT_DISPLAY_MS = 20_000;

    async function processAct() {
      const act = currentAct!;
      const actStartTime = Date.now();
      setActNarrative("");
      setMonthDataSummary(null);
      let fullNarrative = "";

      const hasPrefetch = prefetchChunksRef.current.length > 0;
      let capturedSummary: DataSummary | null = null;

      if (isDemoMode) {
        // Demo runs on pre-validated data — the API routes are auth-gated and
        // would 401 for a signed-out demo user. Replay the canned act instead.
        const demoAct = DEMO_ACTS[act];
        if (demoAct.mapActions.length) setActiveMapActions(demoAct.mapActions);
        capturedSummary = demoAct.dataSummary;
        setMonthDataSummary(demoAct.dataSummary);

        // Time-based pacing: reveal proportional to elapsed time so React render
        // cost can't stretch the replay — the whole 4-act run must stay under ~2 min.
        const tokens = demoAct.narrative.split(/(?<=\s)/);
        const REPLAY_MS = 10_000;
        const replayStart = Date.now();
        let shown = 0;
        while (shown < tokens.length && !cancelled) {
          const target = Math.min(
            tokens.length,
            Math.ceil(((Date.now() - replayStart) / REPLAY_MS) * tokens.length),
          );
          if (target > shown) {
            shown = target;
            setActNarrative(tokens.slice(0, shown).join(""));
          }
          await new Promise((r) => setTimeout(r, 50));
        }
        fullNarrative = demoAct.narrative;
        setActNarrative(fullNarrative);
      } else if (hasPrefetch) {
        if (prefetchActionsRef.current?.length) setActiveMapActions(prefetchActionsRef.current);
        if (prefetchSummaryRef.current) {
          capturedSummary = prefetchSummaryRef.current;
          setMonthDataSummary(prefetchSummaryRef.current);
        }

        let replayText = "";
        for (const token of prefetchChunksRef.current) {
          if (cancelled) break;
          replayText += token;
          setActNarrative(replayText);
          await new Promise((r) => setTimeout(r, 25));
        }
        fullNarrative = replayText;
        prefetchChunksRef.current = [];
        prefetchActionsRef.current = null;
        prefetchSummaryRef.current = null;

        // Kick off prefetch for act N+1 — normally drainSSE does this when the tools event
        // fires, but we bypassed drainSSE via the hasPrefetch path, so it never ran.
        if (act < 4 && !cancelled) {
          const nextAct = (act + 1) as SimAct;
          fetch("/api/sim-month", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
            body: JSON.stringify({
              neighborhood,
              month: ACT_MONTH[nextAct],
              year: SIM_YEAR,
              profile,
              actContext: ACT_SEASON[nextAct],
              prevMonthSummaries: prevNarrativesRef.current,
            }),
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
                  const e = JSON.parse(ln.slice(6)) as { type: string; mapActions?: MapAction[]; dataSummary?: DataSummary; text?: string };
                  if (e.type === "tools" && e.mapActions) prefetchActionsRef.current = e.mapActions;
                  if (e.type === "tools" && e.dataSummary) prefetchSummaryRef.current = e.dataSummary;
                  if (e.type === "chunk" && e.text) prefetchChunksRef.current.push(e.text);
                  if (e.type === "done") prefetchDoneRef.current = true;
                } catch { /* skip */ }
              }
            }
          }).catch(() => { /* silent prefetch failure */ });
        }

        if (!prefetchDoneRef.current && !cancelled) {
          try {
            const res = await fetch("/api/sim-month", {
              method: "POST",
              signal: abortController.signal,
              headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
              body: JSON.stringify({
                neighborhood,
                month: ACT_MONTH[act],
                year: SIM_YEAR,
                profile,
                actContext: ACT_SEASON[act],
                prevMonthSummaries: prevNarrativesRef.current,
              }),
            });
            if (res.headers.get("content-type")?.includes("text/event-stream")) {
              const { fullText: extra, dataSummary: extraSummary } = await drainSSE(res, act, setActiveMapActions, (text) => setActNarrative(text));
              if (extra) fullNarrative = extra;
              if (extraSummary) capturedSummary = extraSummary;
            }
          } catch { /* continue */ }
        }
        prefetchDoneRef.current = false;
      } else {
        try {
          const res = await fetch("/api/sim-month", {
            method: "POST",
            signal: abortController.signal,
            headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
            body: JSON.stringify({
              neighborhood,
              month: ACT_MONTH[act],
              year: SIM_YEAR,
              profile,
              actContext: ACT_SEASON[act],
              prevMonthSummaries: prevNarrativesRef.current,
            }),
          });

          if (res.headers.get("content-type")?.includes("text/event-stream")) {
            const { fullText, dataSummary } = await drainSSE(res, act, setActiveMapActions, (text) => setActNarrative(text));
            fullNarrative = fullText;
            capturedSummary = dataSummary;
          } else {
            const data = (await res.json()) as { response?: string; mapActions?: MapAction[] };
            fullNarrative = data.response ?? "";
            setActNarrative(fullNarrative);
            if (data.mapActions?.length) setActiveMapActions(data.mapActions);
          }
        } catch { /* continue even on error */ }
      }

      if (cancelled) return;

      // Hold the act on screen so the user can read the narrative.
      // Polls every 300ms so pause/stop (which set cancelled=true) exit immediately.
      const waitUntil = actStartTime + MIN_ACT_DISPLAY_MS;
      while (!cancelled && Date.now() < waitUntil) {
        await new Promise((r) => setTimeout(r, 300));
      }

      if (cancelled) return;

      if (fullNarrative || capturedSummary) {
        actDataSummariesRef.current = { ...actDataSummariesRef.current, [act]: capturedSummary ?? undefined };
        setActDataSummaries((prev) => ({ ...prev, [act]: capturedSummary }));
      }
      if (fullNarrative) {
        prevNarrativesRef.current = [...prevNarrativesRef.current, fullNarrative];
      }
      setCompletedActs((prev) => [...prev, act]);

      if (act < 4) {
        setCurrentAct((act + 1) as SimAct);
      } else {
        if (runStateRef.current !== "running") return;
        setRunState("done");
        runStateRef.current = "done";
        setCurrentAct(null);

        // Persist the completed run for signed-in users (fire-and-forget).
        // Demo runs are canned data and must never be saved.
        if (!isDemoMode && isSignedIn && profile && !runSavedRef.current) {
          runSavedRef.current = true;
          fetch("/api/runs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              neighborhood,
              year: SIM_YEAR,
              profile,
              actSummaries: actDataSummariesRef.current,
            }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((data: unknown) => {
              const id = data && typeof data === "object" && "id" in data ? (data as { id: string }).id : null;
              if (id) setSavedRunId(id);
            })
            .catch(() => { /* saving is best-effort */ });
        }
      }
    }

    void processAct();
    return () => {
      cancelled = true;
      abortController.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runState, currentAct]);

  async function startAutoRun() {
    if (runState !== "idle" || !profile) return;
    if (!isDemoMode && (!authLoaded || !isSignedIn)) {
      setAuthPrompt("year");
      setMobilePanel("advisor");
      return;
    }
    setAuthPrompt(null);
    setRunState("running");
    runStateRef.current = "running";
    setCompletedActs([]);
    setActNarrative("");
    setMonthDataSummary(null);
    setActDataSummaries({});
    actDataSummariesRef.current = {};
    runSavedRef.current = false;
    setSavedRunId(null);
    prefetchChunksRef.current = [];
    prefetchActionsRef.current = null;
    prefetchDoneRef.current = false;
    prefetchSummaryRef.current = null;
    prevNarrativesRef.current = [];

    // Fetch all 4 Street View images in the background — don't block Act 1 from
    // starting on them. SimClient already falls back to a seasonal gradient while
    // streetViewUrls[act] is undefined, so each image can pop in as it resolves.
    // Demo mode skips this: /api/street-view is auth-gated and would 401.
    const seasons: ActSeason[] = isDemoMode ? [] : ["spring", "summer", "autumn", "winter"];
    for (const s of seasons) {
      fetch(`/api/street-view?neighborhood=${encodeURIComponent(neighborhood)}&season=${s}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: unknown) => {
          const url = data && typeof data === "object" && "imageUrl" in data
            ? (data as { imageUrl: string | null }).imageUrl
            : null;
          if (url) setStreetViewUrls((prev) => ({ ...prev, [s]: url }));
        })
        .catch(() => { /* keep gradient fallback */ });
    }

    setCurrentAct(1);
  }

  function togglePause() {
    if (runState === "running") {
      setRunState("paused");
      runStateRef.current = "paused";
    } else if (runState === "paused") {
      setRunState("running");
      runStateRef.current = "running";
      if (currentAct !== null) {
        setCurrentAct((a) => a);
      }
    }
  }

  const resetTransientRunState = useCallback(() => {
    setRunState("idle");
    runStateRef.current = "idle";
    setCurrentAct(null);
    setActNarrative("");
    setMonthDataSummary(null);
    setStreetViewUrls({});
    prefetchChunksRef.current = [];
    prefetchActionsRef.current = null;
    prefetchDoneRef.current = false;
    prefetchSummaryRef.current = null;
    prevNarrativesRef.current = [];
  }, []);

  // Leave the cinematic view but keep the finished run's history — the debrief
  // screen reads actDataSummaries/completedActs/savedRunId. startAutoRun resets
  // them anyway, so a later re-run starts clean.
  const exitToDebrief = useCallback(() => {
    resetTransientRunState();
  }, [resetTransientRunState]);

  // Full reset — mid-run Back button and neighborhood switches, where stale
  // run history must not survive.
  const stopAutoRun = useCallback(() => {
    resetTransientRunState();
    setActDataSummaries({});
    actDataSummariesRef.current = {};
    setCompletedActs([]);
    setSavedRunId(null);
  }, [resetTransientRunState]);

  return {
    runState,
    currentAct,
    actNarrative,
    actDataSummaries,
    completedActs,
    streetViewUrls,
    monthDataSummary,
    savedRunId,
    startAutoRun,
    togglePause,
    stopAutoRun,
    exitToDebrief,
  };
}
