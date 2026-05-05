"use client";

import { useEffect, useRef, useState } from "react";
import { Skybox } from "@/components/Skybox";
import type { ChatMessage, UserProfile } from "@/lib/tools/types";
import { OnboardingProfileForm } from "./OnboardingProfileForm";

type Step = "profile" | "sim";

interface AgentResponse {
  response?: string;
  toolsUsed?: string[];
  error?: string;
}

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

export function SimClient() {
  const [step, setStep] = useState<Step>("profile");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [neighborhood, setNeighborhood] = useState("Hyde Park");
  const [month, setMonth] = useState(10); // October default

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastToolsUsed, setLastToolsUsed] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function handleProfileComplete(p: UserProfile) {
    setProfile(p);
    setStep("sim");
  }

  async function send(question: string) {
    if (!question.trim() || !profile || loading) return;

    const userMessage = question.trim();
    setInput("");
    setError(null);
    setLastToolsUsed([]);

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
        }),
      });

      const data = (await res.json()) as AgentResponse;
      if (!res.ok || data.error) throw new Error(data.error ?? "Agent request failed");
      if (!data.response) throw new Error("Empty response from agent");

      setMessages([...next, { role: "assistant", content: data.response }]);
      if (data.toolsUsed) setLastToolsUsed(data.toolsUsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMessages(messages); // roll back optimistic user message
    } finally {
      setLoading(false);
    }
  }

  // ─── Profile step ────────────────────────────────────────────────────────────

  if (step === "profile") {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[color:var(--background)] px-6 py-8 text-[color:var(--foreground)]">
        {/* Skybox background on onboarding */}
        <div aria-hidden="true" className="absolute inset-0">
          <Skybox month={6} crimeSignal={0} serviceSignal={null} transitSignal={0} fullBleed />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-8">
          <header>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/80">
              CityLiving Sim
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              Set up your living profile
            </h1>
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

  // ─── Sim step ────────────────────────────────────────────────────────────────

  const monthName = MONTH_NAMES[month - 1] ?? "this month";

  return (
    <div className="flex h-screen flex-col bg-[color:var(--background)] text-[color:var(--foreground)]">

      {/* Top bar: neighborhood + month strip */}
      <header className="flex flex-col gap-2 border-b border-[color:var(--panel-border)] bg-[color:var(--panel)] px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex shrink-0 items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
            Neighborhood
          </label>
          <input
            type="text"
            value={neighborhood}
            onChange={(e) => {
              setNeighborhood(e.target.value);
              setMessages([]); // reset chat on neighborhood change
            }}
            className="w-36 rounded-lg border border-[color:var(--panel-border)] bg-white px-2 py-1 text-sm outline-none focus:border-[color:var(--accent)]"
          />
        </div>

        {/* Month strip */}
        <div className="flex flex-1 gap-0.5 overflow-x-auto">
          {MONTH_SHORT.map((name, i) => (
            <button
              key={name}
              onClick={() => setMonth(i + 1)}
              className={`shrink-0 rounded px-2 py-1 text-xs font-medium transition-colors ${
                month === i + 1
                  ? "bg-[color:var(--accent)] text-white"
                  : "text-[color:var(--muted)] hover:bg-[color:var(--panel-border)]"
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        <button
          onClick={() => setStep("profile")}
          className="shrink-0 text-xs text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
        >
          ← Edit profile
        </button>
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-4">

          {/* Empty state */}
          {messages.length === 0 && !loading && (
            <div className="mt-10 text-center">
              <p className="text-sm font-medium">
                You&apos;re in {neighborhood}, {monthName} 2024.
              </p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">Ask anything about living here.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => void send(q)}
                    className="rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-3 py-1.5 text-xs text-[color:var(--muted)] transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message bubbles */}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-lg rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[color:var(--accent)] text-white"
                    : "border border-[color:var(--panel-border)] bg-[color:var(--panel)]"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Loading */}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-4 py-3 text-sm text-[color:var(--muted)]">
                Querying data…
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            </div>
          )}

          {/* Tool debug badge */}
          {lastToolsUsed.length > 0 && !loading && (
            <p className="text-center text-xs text-[color:var(--muted)]">
              ↳ {lastToolsUsed.join(", ")}
            </p>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <footer className="border-t border-[color:var(--panel-border)] bg-[color:var(--panel)] px-4 py-3">
        <form
          onSubmit={(e) => { e.preventDefault(); void send(input); }}
          className="mx-auto flex max-w-2xl gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask about ${neighborhood} in ${monthName}…`}
            disabled={loading}
            className="flex-1 rounded-xl border border-[color:var(--panel-border)] bg-white px-4 py-2.5 text-sm outline-none focus:border-[color:var(--accent)] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="rounded-xl bg-[color:var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)] disabled:opacity-40"
          >
            Ask
          </button>
        </form>
      </footer>
    </div>
  );
}
