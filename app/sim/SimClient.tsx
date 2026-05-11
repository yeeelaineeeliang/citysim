"use client";

import { useEffect, useRef, useState } from "react";
import { AuthActions } from "@/components/AuthActions";
import { Skybox } from "@/components/Skybox";
import type { ChatMessage, UserProfile } from "@/lib/tools/types";
import { OnboardingProfileForm } from "./OnboardingProfileForm";
import { NEIGHBORHOOD_COORDINATES } from "@/lib/neighborhoodCoordinates";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "profile" | "neighborhood" | "sim";

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

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── Profile complete ────────────────────────────────────────────────────────

  function handleProfileComplete(p: UserProfile) {
    setProfile(p);
    setStep("neighborhood");
    setMatchMode(null);
    setMatches([]);
    setMatchError(null);
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
    setStep("sim");
  }

  // ── Chat send ───────────────────────────────────────────────────────────────

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
              {!matchLoading && matches.length > 0 && (
                <>
                  <p className="mb-4 text-sm font-semibold">Top matches for your profile:</p>
                  <ul className="grid gap-3">
                    {matches.map((m) => (
                      <li key={m.communityAreaNumber}>
                        <button
                          onClick={() => pickNeighborhood(m.name)}
                          className="w-full rounded-xl border border-[color:var(--panel-border)] bg-white p-4 text-left transition hover:border-[color:var(--accent)] hover:shadow"
                        >
                          <p className="font-semibold text-[color:var(--foreground)]">{m.name}</p>
                          {m.descriptors.length > 0 && (
                            <p className="mt-1 text-xs text-[color:var(--muted)]">
                              {m.descriptors.join(" · ")}
                            </p>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
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

  return (
    <div className="flex h-screen flex-col bg-[color:var(--background)] text-[color:var(--foreground)]">

      <header className="flex flex-col gap-3 border-b border-[color:var(--panel-border)] bg-[color:var(--panel)] px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex shrink-0 items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
              Neighborhood
            </label>
            <select
              value={neighborhood}
              onChange={(e) => {
                setNeighborhood(e.target.value);
                setMessages([]);
                setSessionId(null);
              }}
              className="rounded-lg border border-[color:var(--panel-border)] bg-white px-2 py-1 text-sm outline-none focus:border-[color:var(--accent)]"
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
                    ? "bg-[color:var(--accent)] text-white"
                    : "text-[color:var(--muted)] hover:bg-[color:var(--panel-border)]"
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
            className="text-xs text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
          >
            ← Change neighborhood
          </button>
          <AuthActions className="border-[color:var(--panel-border)] bg-white/45" />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-4">

          {messages.length === 0 && !loading && (
            <div className="mt-10 text-center">
              <p className="text-sm font-medium">You&apos;re in {neighborhood}, {monthName} 2024.</p>
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

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-4 py-3 text-sm text-[color:var(--muted)]">
                Querying data…
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
