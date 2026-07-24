"use client";

import { useEffect, useRef, useState } from "react";
import type { UserProfile, MapAction } from "@/lib/tools/types";
import { toChatHistory, type SimMessage } from "@/lib/simMessages";
import { DEMO_MONTH, DEMO_NEIGHBORHOOD, DEMO_OPENING, matchDemoQA } from "@/lib/demoData";
import { createSimMessage, MONTH_NAMES, SIM_YEAR } from "../helpers";
import type { AgentResponse, AuthPromptReason, SceneMode, MobilePanel } from "../types";

interface UseSimChatParams {
  profile: UserProfile | null;
  neighborhood: string;
  month: number;
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  isDemoMode: boolean;
  isSignedIn: boolean | undefined;
  authLoaded: boolean;
  setSceneMode: (s: SceneMode) => void;
  setMobilePanel: (p: MobilePanel) => void;
}

export function useSimChat({
  profile,
  neighborhood,
  month,
  sessionId,
  setSessionId,
  isDemoMode,
  isSignedIn,
  authLoaded,
  setSceneMode,
  setMobilePanel,
}: UseSimChatParams) {
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastToolsUsed, setLastToolsUsed] = useState<string[]>([]);
  const [activeMapActions, setActiveMapActions] = useState<MapAction[]>([]);
  const [openingThinking, setOpeningThinking] = useState(false);
  const [authPrompt, setAuthPrompt] = useState<AuthPromptReason | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const latestAnswerRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<SimMessage[]>([]);
  const openingRequestRef = useRef(0);
  const openingAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // A new answer scrolls to its own top so the user reads it from the
    // beginning — scrolling to the very bottom buried long answers under
    // whatever renders after them.
    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && latestAnswerRef.current) {
      latestAnswerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, openingThinking]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    return () => openingAbortRef.current?.abort();
  }, []);

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

  async function send(question: string) {
    if (!question.trim() || !profile || loading) return;

    const userMessage = question.trim();
    setInput("");
    setError(null);
    setLastToolsUsed([]);
    setMobilePanel("advisor");

    if (!isDemoMode && (!authLoaded || !isSignedIn)) {
      setAuthPrompt("chat");
      return;
    }

    setAuthPrompt(null);

    if (isDemoMode) {
      const match = matchDemoQA(userMessage, month);
      if (match) {
        const demoAnswer = createSimMessage("assistant", match.answer, month, "answer");
        if (match.mapActions?.length) demoAnswer.mapActions = match.mapActions;
        setMessages((prev) => [
          ...prev,
          createSimMessage("user", userMessage, month, "user"),
          demoAnswer,
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
      if (res.status === 401) {
        setAuthPrompt("chat");
        setMessages(messages);
        return;
      }
      if (!res.ok || data.error) throw new Error(data.error ?? "Agent request failed");
      if (!data.response) throw new Error("Empty response from agent");

      const answer = createSimMessage("assistant", data.response, month, "answer");
      if (data.mapActions?.length) answer.mapActions = data.mapActions;
      setMessages([...next, answer]);
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

  return {
    messages, setMessages,
    input, setInput,
    loading, error,
    lastToolsUsed,
    activeMapActions, setActiveMapActions,
    openingThinking, setOpeningThinking,
    authPrompt, setAuthPrompt,
    messagesEndRef,
    latestAnswerRef,
    messagesRef,
    fetchOpening,
    send,
  };
}
