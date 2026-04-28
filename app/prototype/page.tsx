"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

const loadingLines = [
  "Pulling 12 months of CTA ridership...",
  "Reading 311 service records for your block...",
  "Checking crime patterns near your address...",
  "Writing your year...",
];

const neighborhoods = [
  {
    name: "Hyde Park",
    descriptors: "Campus · Quiet · Lakefront",
    fact: "Route 6 runs every 6–8 min at peak",
  },
  {
    name: "Logan Square",
    descriptors: "Tree-lined · Blue Line · Roomier rents",
    fact: "311 streetlight requests closed in about 4 days",
  },
  {
    name: "Wicker Park",
    descriptors: "Busy · Walkable · Late-night",
    fact: "Damen Blue Line stays active past midnight",
  },
];

const DATA_CONTEXT = {
  transit: {
    route: "CTA Route 6",
    peak_frequency_minutes: "6-8",
    peak_crowding: "moderate to high",
    notable_period: "Midterms week (Oct 12-16)",
    midterms_crowding: "standing room only",
    on_time_rate: "91%",
  },
  service_requests_311: {
    open_requests_on_block: 2,
    request_types: ["pothole", "graffiti"],
    avg_resolution_days: 9.1,
    city_avg_resolution_days: 5.2,
  },
  crime: {
    incidents_in_area: 14,
    most_common_type: "theft",
    change_vs_last_month: "-3%",
    city_avg_incidents: 22,
  },
  housing: {
    median_rent_1br: 1450,
    budget_slack_dollars: -50,
    available_units_in_range: 8,
  },
};

const comparison = {
  hydePark: [
    {
      month: "October",
      text: "Your commute settles quickly around the #6, with midterms week bringing the only real crowding.",
      points: ["6–8 min peak wait", "2 open 311 requests"],
    },
    {
      month: "November",
      text: "The buses stay dependable, but two dark streetlights make the block feel slower at night.",
      points: ["94% transit on-time", "9 days to fix outages"],
    },
    {
      month: "December",
      text: "Campus empties out and your commute becomes the easiest stretch of the year.",
      points: ["Ridership down 38%", "1 bike theft reported"],
    },
  ],
  loganSquare: [
    {
      month: "October",
      text: "Your apartment budget stretches further, but the campus commute asks for a longer transfer.",
      points: ["15–20 min longer each way", "$150 more monthly room"],
    },
    {
      month: "November",
      text: "Streetlight and alley requests close faster, so the block feels more quickly tended.",
      points: ["4.1 day service close", "1 open block request"],
    },
    {
      month: "December",
      text: "Holiday travel thins the trains, but the extra distance still shapes both ends of your day.",
      points: ["Blue Line quieter", "Longer late return"],
    },
  ],
};

type ChatMessage =
  | {
      id: string;
      role: "user" | "agent";
      month: string;
      text: string;
      sourceOpen?: boolean;
      sourceMonth?: string;
    }
  | {
      id: string;
      role: "error";
      month: string;
      text: string;
      retryQuestion: string;
    }
  | {
      id: string;
      role: "divider";
      month: string;
      text: string;
    };

type PersonaPayload = {
  workplace: string;
  monthlyBudget: number;
  priority: string;
};

function formatMoney(value: number) {
  return `$${value.toLocaleString()} / month`;
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatDataValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "number" && Math.abs(value) >= 1000) return value.toLocaleString();
  return String(value);
}

function flattenDataContext() {
  return Object.entries(DATA_CONTEXT).flatMap(([category, values]) =>
    Object.entries(values).map(([label, value]) => ({
      label: `${category}.${label}`,
      value: formatDataValue(value),
    })),
  );
}

function getSuggestedQuestions(month: string) {
  if (month === "November 2020") {
    return ["What changed this month?", "How did the weather affect the commute?", "Any new incidents on my block?"];
  }

  return ["What is my commute like?", "What happened on my block?", "How fast does the city respond here?"];
}

export default function PrototypePage() {
  const [screen, setScreen] = useState(1);
  const [budget, setBudget] = useState(1400);
  const [loadingStep, setLoadingStep] = useState(-1);
  const [activeMonth, setActiveMonth] = useState("October 2020");
  const [chipsVisible, setChipsVisible] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const chatThreadRef = useRef<HTMLDivElement | null>(null);

  function goTo(nextScreen: number) {
    if (nextScreen === 4) {
      setActiveMonth("October 2020");
      setChipsVisible(true);
      setChatMessages([]);
      setInputValue("");
      setPendingQuestion(null);
    }

    setScreen(nextScreen);
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 20);
  }

  function chooseNeighborhood() {
    setLoadingStep(-1);
    goTo(3);
  }

  async function sendQuestion(question: string) {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || pendingQuestion) return;

    const monthForRequest = activeMonth;
    const persona: PersonaPayload = {
      workplace: "UChicago — 5600 S University Ave",
      monthlyBudget: budget,
      priority: "transit reliability",
    };

    setInputValue("");
    setChipsVisible(false);
    setPendingQuestion(trimmedQuestion);
    setChatMessages((messages) => [
      ...messages,
      {
        id: makeId(),
        role: "user",
        month: monthForRequest,
        text: trimmedQuestion,
      },
    ]);

    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: trimmedQuestion,
          month: monthForRequest,
          neighborhood: "Hyde Park",
          persona,
        }),
      });

      const text = await response.text();
      if (!response.ok) throw new Error(text || "Simulation failed.");

      setChatMessages((messages) => [
        ...messages,
        {
          id: makeId(),
          role: "agent",
          month: monthForRequest,
          sourceMonth: monthForRequest,
          text,
          sourceOpen: false,
        },
      ]);
    } catch {
      setChatMessages((messages) => [
        ...messages,
        {
          id: makeId(),
          role: "error",
          month: monthForRequest,
          retryQuestion: trimmedQuestion,
          text: "Couldn't reach the simulation — try again.",
        },
      ]);
    } finally {
      setPendingQuestion(null);
    }
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendQuestion(inputValue);
  }

  function toggleSourceData(id: string) {
    setChatMessages((messages) =>
      messages.map((message) =>
        message.id === id && message.role === "agent" ? { ...message, sourceOpen: !message.sourceOpen } : message,
      ),
    );
  }

  function moveToNovember() {
    if (activeMonth === "November 2020") return;

    setActiveMonth("November 2020");
    setChipsVisible(true);
    setPendingQuestion(null);
    setInputValue("");
    setChatMessages((messages) => [
      ...messages,
      {
        id: makeId(),
        role: "divider",
        month: "November 2020",
        text: "── November 2020 ──",
      },
    ]);
  }

  useEffect(() => {
    if (screen !== 3) return;

    setLoadingStep(-1);
    const timers = loadingLines.map((_, index) =>
      window.setTimeout(() => setLoadingStep(index), 250 + index * 600),
    );
    timers.push(window.setTimeout(() => goTo(4), 250 + loadingLines.length * 600 + 850));

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [screen]);

  useEffect(() => {
    chatThreadRef.current?.scrollTo({
      top: chatThreadRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chatMessages, pendingQuestion]);

  return (
    <main className="prototype-shell">
      <section className={`screen ${screen === 1 ? "is-active" : ""}`} aria-hidden={screen !== 1}>
        <div className="screen-inner onboarding">
          <header className="topbar">
            <span>CITYLIVING SIM</span>
            <span>Step 1 of 2</span>
          </header>

          <div className="narrow">
            <h1>Where does your day start and end?</h1>

            <label className="field">
              <span>Where do you work or study?</span>
              <input type="text" defaultValue="UChicago — 5600 S University Ave" />
            </label>

            <label className="field">
              <span>Monthly rent budget</span>
              <div className="budget-readout">{formatMoney(budget)}</div>
              <input
                aria-label="Monthly rent budget"
                className="range"
                type="range"
                min="800"
                max="3000"
                step="50"
                value={budget}
                onChange={(event) => setBudget(Number(event.target.value))}
              />
              <div className="range-labels">
                <span>$800</span>
                <span>$3,000</span>
              </div>
            </label>

            <button className="primary-button" type="button" onClick={() => goTo(2)}>
              Choose a neighborhood →
            </button>
          </div>
        </div>
      </section>

      <section className={`screen ${screen === 2 ? "is-active" : ""}`} aria-hidden={screen !== 2}>
        <div className="screen-inner">
          <div className="intro-block">
            <p className="eyebrow">Pick a neighborhood to simulate</p>
            <h2>You&apos;ll experience a full year here.</h2>
            <p className="subtext">
              Transit, city services, crime patterns, seasonal changes — month by month.
            </p>
          </div>

          <div className="neighborhood-grid">
            {neighborhoods.map((neighborhood) => (
              <article className="neighborhood-card" key={neighborhood.name}>
                <h3>{neighborhood.name}</h3>
                <p className="descriptors">{neighborhood.descriptors}</p>
                <p className="fact">{neighborhood.fact}</p>
                <button className="text-button" type="button" onClick={chooseNeighborhood}>
                  Simulate a year here →
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={`screen ${screen === 3 ? "is-active" : ""}`} aria-hidden={screen !== 3}>
        <div className="screen-inner loading-screen">
          <div className="loading-title">
            <h2>Hyde Park</h2>
            <p>October 2020 – September 2021</p>
          </div>

          <div className="loading-lines" aria-live="polite">
            {loadingLines.map((line, index) => {
              const visible = loadingStep >= index;
              const active = loadingStep === index;
              const final = loadingStep === loadingLines.length - 1 && index === loadingLines.length - 1;

              return (
                <p
                  className={`loading-line ${visible ? "visible" : ""} ${active ? "active" : ""} ${final ? "final" : ""}`}
                  key={line}
                >
                  {line}
                </p>
              );
            })}
          </div>
        </div>
      </section>

      <section className={`screen simulation-screen ${screen === 4 ? "is-active" : ""}`} aria-hidden={screen !== 4}>
        <div className="screen-inner simulation-environment">
          <div className={`street-scene ${activeMonth === "November 2020" ? "is-november" : ""}`}>
            <p className="scene-kicker">Hyde Park · {activeMonth} · Morning</p>
            <div className="sky" />
            <div className="morning-light" />
            <div className="building building-left">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="building building-right">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="sidewalk" />
            <div className="street" />
            <div className="bus-stop">
              <div className="stop-sign">6</div>
              <div className="stop-pole" />
            </div>
            <div className="person person-one">
              <span className="head" />
              <span className="body" />
            </div>
            <div className="person person-two">
              <span className="head" />
              <span className="body" />
            </div>
            <div className="person person-three">
              <span className="head" />
              <span className="body" />
            </div>
          </div>

          <aside className="conversation-panel">
            <div className="conversation-top">
              <p className="eyebrow">Ask from inside the month</p>
              {chipsVisible ? (
                <div className="question-chips">
                  {getSuggestedQuestions(activeMonth).map((question) => (
                    <button key={question} type="button" onClick={() => void sendQuestion(question)}>
                      {question}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="chat-thread" ref={chatThreadRef} aria-live="polite">
              {chatMessages.length === 0 && !pendingQuestion ? (
                <p className="empty-chat">
                  You are standing near the Route 6 stop. Ask what this month feels like from here.
                </p>
              ) : null}

              {chatMessages.map((message) => {
                if (message.role === "divider") {
                  return (
                    <div className="month-divider" key={message.id}>
                      {message.text}
                    </div>
                  );
                }

                if (message.role === "error") {
                  return (
                    <div className="message-row agent-row" key={message.id}>
                      <div className="agent-message error-message">
                        <p>{message.text}</p>
                        <button type="button" onClick={() => void sendQuestion(message.retryQuestion)}>
                          Retry
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className={`message-row ${message.role === "user" ? "user-row" : "agent-row"}`} key={message.id}>
                    <div className={message.role === "user" ? "user-message" : "agent-message"}>
                      <p>{message.text}</p>
                      {message.role === "agent" ? (
                        <div className="source-data">
                          <button type="button" onClick={() => toggleSourceData(message.id)}>
                            ── source data ──
                          </button>
                          {message.sourceOpen ? (
                            <div className="source-table-wrap">
                              <p>Data retrieved for {message.sourceMonth}</p>
                              <table>
                                <tbody>
                                  {flattenDataContext().map((row) => (
                                    <tr key={row.label}>
                                      <th>{row.label}</th>
                                      <td>{row.value}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {pendingQuestion ? (
                <div className="message-row agent-row">
                  <div className="agent-message pending-message">
                    <p>Checking {activeMonth} data...</p>
                    <span>...</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="conversation-bottom">
              <form className="chat-input-row" onSubmit={submitQuestion}>
                <input
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  placeholder="Ask anything about living here..."
                  disabled={Boolean(pendingQuestion)}
                />
                <button type="submit" disabled={Boolean(pendingQuestion) || !inputValue.trim()}>
                  →
                </button>
              </form>
              <div className="conversation-actions">
                {activeMonth === "October 2020" ? (
                  <button className="secondary-button" type="button" onClick={moveToNovember}>
                    Move to November →
                  </button>
                ) : (
                  <div className="dual-actions">
                    <button className="secondary-button" type="button" onClick={() => goTo(5)}>
                      Compare with another neighborhood →
                    </button>
                    <button className="primary-button" type="button" onClick={() => goTo(6)}>
                      See your year summary →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className={`screen ${screen === 5 ? "is-active" : ""}`} aria-hidden={screen !== 5}>
        <div className="screen-inner">
          <div className="intro-block">
            <h2>Hyde Park vs. Logan Square</h2>
            <p className="subtext">Same year, different neighborhood</p>
          </div>

          <div className="comparison-grid">
            <ComparisonColumn title="Hyde Park" items={comparison.hydePark} />
            <ComparisonColumn title="Logan Square" items={comparison.loganSquare} />
          </div>

          <p className="plain-summary">
            Hyde Park put you closer to campus with a faster commute. Logan Square gave you more budget room and faster
            city services, but added 15–20 minutes each way.
          </p>

          <button className="primary-button" type="button" onClick={() => goTo(6)}>
            See your year summary →
          </button>
        </div>
      </section>

      <section className={`screen ${screen === 6 ? "is-active" : ""}`} aria-hidden={screen !== 6}>
        <div className="screen-inner">
          <div className="intro-block">
            <h2>You lived in Hyde Park.</h2>
            <p className="subtext">
              October 2020 – September 2021 · Simulated for UChicago commute · {formatMoney(budget).replace(" / month", "/mo")}
            </p>
          </div>

          <div className="summary-sections">
            <section className="summary-row positive">
              <span className="summary-icon">✓</span>
              <div>
                <h3>What worked</h3>
                <p>Transit was reliable. Your average commute ran 14 minutes — 4 under the city median for this route.</p>
              </div>
            </section>

            <section className="summary-row mixed">
              <span className="summary-icon">~</span>
              <div>
                <h3>What was mixed</h3>
                <p>
                  311 response times lagged the North Side average. Requests on your block averaged 7.1 days to close,
                  vs. 5.2 citywide.
                </p>
              </div>
            </section>

            <section className="summary-row warning">
              <span className="summary-icon">⚠</span>
              <div>
                <h3>One thing to know</h3>
                <p>
                  Crime on your block spiked in November — higher than any other month. Worth understanding before
                  signing a lease that starts in fall.
                </p>
              </div>
            </section>
          </div>

          <div className="dual-actions">
            <button className="secondary-button" type="button" onClick={() => goTo(2)}>
              Simulate another neighborhood →
            </button>
            <button
              className="disabled-button"
              type="button"
              disabled
              title="Coming in v2 — requires account"
            >
              Save this simulation
            </button>
          </div>
        </div>
      </section>

      <style jsx global>{`
        :root {
          --proto-bg: #F7F6F2;
          --proto-text: #1C1C1A;
          --proto-muted: #6F6B62;
          --proto-border: #D9D6CE;
          --proto-card: #FFFFFF;
          --proto-data: #F0EDE8;
          --proto-warning: #B85C2A;
          --proto-positive: #3A6B4A;
          --proto-shadow: 0 18px 44px rgba(28, 28, 26, 0.08);
          --proto-serif: Georgia, "Times New Roman", serif;
          --proto-label: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        }

        html {
          scroll-behavior: smooth;
          background: var(--proto-bg);
        }

        body {
          background: var(--proto-bg);
          color: var(--proto-text);
        }

        .prototype-shell {
          min-height: 100vh;
          background: var(--proto-bg);
          color: var(--proto-text);
          font-family: var(--proto-serif);
        }

        .screen {
          display: none;
          min-height: 100vh;
          opacity: 0;
        }

        .screen.is-active {
          display: block;
          animation: fadeIn 200ms ease forwards;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .screen-inner {
          width: min(1120px, calc(100vw - 40px));
          min-height: 100vh;
          margin: 0 auto;
          padding: 48px 0 72px;
        }

        .onboarding {
          display: flex;
          flex-direction: column;
        }

        .topbar,
        .eyebrow,
        .loading-lines,
        button,
        input,
        .descriptors,
        .summary-row h3,
        .scene-kicker,
        .chat-thread,
        .chat-input-row,
        .source-data,
        .month-divider {
          font-family: var(--proto-label);
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 96px;
          color: var(--proto-muted);
          font-size: 12px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .narrow {
          width: min(720px, 100%);
        }

        h1,
        h2,
        h3,
        p {
          margin: 0;
        }

        h1,
        .intro-block h2,
        .loading-title h2 {
          font-family: var(--proto-serif);
          font-weight: 500;
          letter-spacing: -0.015em;
        }

        h1 {
          max-width: 760px;
          margin-bottom: 44px;
          font-size: clamp(44px, 7vw, 76px);
          line-height: 1.05;
        }

        .field {
          display: block;
          margin-bottom: 26px;
        }

        .field > span,
        .eyebrow {
          display: block;
          margin-bottom: 10px;
          color: var(--proto-muted);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        input[type="text"] {
          width: 100%;
          border: 1px solid var(--proto-border);
          border-radius: 8px;
          background: var(--proto-card);
          padding: 17px 18px;
          color: var(--proto-text);
          font-size: 16px;
          box-shadow: var(--proto-shadow);
        }

        input:focus {
          outline: 2px solid rgba(28, 28, 26, 0.22);
          outline-offset: 2px;
        }

        .budget-readout {
          margin-bottom: 14px;
          font-family: var(--proto-serif);
          font-size: 30px;
        }

        .range {
          width: 100%;
          accent-color: var(--proto-text);
        }

        .range-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 8px;
          color: var(--proto-muted);
          font-family: var(--proto-label);
          font-size: 12px;
        }

        button {
          border: 0;
          cursor: pointer;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .primary-button,
        .secondary-button,
        .disabled-button {
          min-height: 48px;
          border-radius: 8px;
          padding: 0 22px;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        .primary-button {
          background: var(--proto-text);
          color: var(--proto-bg);
        }

        .secondary-button {
          border: 1px solid var(--proto-border);
          background: var(--proto-card);
          color: var(--proto-text);
        }

        .disabled-button {
          border: 1px solid var(--proto-border);
          background: #E5E1D9;
          color: #8C877D;
          cursor: not-allowed;
        }

        .text-button {
          margin-top: auto;
          background: transparent;
          color: var(--proto-text);
          padding: 0;
          font-size: 13px;
          font-weight: 700;
          text-align: left;
        }

        .intro-block {
          max-width: 780px;
          margin-bottom: 34px;
          padding-top: 36px;
        }

        .intro-block h2 {
          margin-bottom: 10px;
          font-size: clamp(38px, 6vw, 64px);
          line-height: 1.08;
        }

        .subtext {
          max-width: 660px;
          color: var(--proto-muted);
          font-size: 18px;
          line-height: 1.6;
        }

        .neighborhood-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }

        .neighborhood-card,
        .comparison-column,
        .summary-row,
        .plain-summary,
        .conversation-panel {
          border: 1px solid var(--proto-border);
          border-radius: 8px;
          background: var(--proto-card);
          box-shadow: var(--proto-shadow);
        }

        .neighborhood-card {
          display: flex;
          min-height: 320px;
          flex-direction: column;
          padding: 28px;
        }

        .neighborhood-card h3 {
          margin-bottom: 12px;
          font-size: 34px;
          font-weight: 500;
          line-height: 1.1;
        }

        .descriptors {
          margin-bottom: 24px;
          color: var(--proto-muted);
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .fact {
          margin-bottom: 34px;
          color: var(--proto-text);
          font-size: 18px;
          line-height: 1.55;
        }

        .loading-screen {
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .loading-title h2 {
          font-size: clamp(56px, 8vw, 92px);
          line-height: 1;
        }

        .loading-title p {
          margin-top: 16px;
          color: var(--proto-muted);
          font-family: var(--proto-label);
          font-size: 13px;
        }

        .loading-lines {
          margin-top: 66px;
          text-align: left;
        }

        .loading-line {
          min-height: 32px;
          color: var(--proto-text);
          font-size: 15px;
          opacity: 0;
          transform: translateY(8px);
          transition: opacity 200ms ease, transform 200ms ease, color 200ms ease;
        }

        .loading-line.visible {
          opacity: 0.35;
          transform: translateY(0);
        }

        .loading-line.active {
          opacity: 1;
        }

        .loading-line.final {
          font-weight: 800;
        }

        .simulation-environment {
          display: grid;
          grid-template-columns: minmax(0, 3fr) minmax(340px, 2fr);
          gap: 18px;
          min-height: 100vh;
        }

        .street-scene {
          position: sticky;
          top: 32px;
          min-height: calc(100vh - 96px);
          overflow: hidden;
          border: 1px solid var(--proto-border);
          border-radius: 8px;
          background: linear-gradient(180deg, #b9d7e6 0%, #f4c391 48%, #e7ded1 49%, #e7ded1 100%);
          box-shadow: var(--proto-shadow);
        }

        .street-scene.is-november {
          background: linear-gradient(180deg, #b8c9d5 0%, #d6bfa6 48%, #ddd9d0 49%, #ddd9d0 100%);
        }

        .scene-kicker {
          position: absolute;
          z-index: 10;
          top: 20px;
          left: 22px;
          color: rgba(28, 28, 26, 0.66);
          font-size: 12px;
          letter-spacing: 0.08em;
        }

        .sky,
        .morning-light {
          position: absolute;
          inset: 0;
        }

        .sky {
          background: linear-gradient(180deg, rgba(170, 209, 229, 0.7), rgba(255, 198, 139, 0.24) 52%, transparent 53%);
        }

        .morning-light {
          background: linear-gradient(115deg, rgba(255, 206, 126, 0.24), transparent 50%);
          pointer-events: none;
          z-index: 8;
        }

        .building {
          position: absolute;
          bottom: 28%;
          width: 24%;
          height: 40%;
          border: 1px solid rgba(28, 28, 26, 0.18);
          background: #9d6650;
        }

        .building-left {
          left: 7%;
        }

        .building-right {
          right: 9%;
          width: 28%;
          height: 45%;
          background: #b17555;
        }

        .building span {
          position: relative;
          display: inline-block;
          width: 22%;
          height: 14%;
          margin: 16% 0 0 8%;
          border: 1px solid rgba(28, 28, 26, 0.16);
          background: rgba(247, 246, 242, 0.72);
        }

        .sidewalk {
          position: absolute;
          right: 0;
          bottom: 16%;
          left: 0;
          height: 16%;
          background: #c9c5bd;
        }

        .street {
          position: absolute;
          right: 0;
          bottom: 0;
          left: 0;
          height: 18%;
          background: #353535;
        }

        .street::after {
          position: absolute;
          top: 46%;
          right: 8%;
          left: 8%;
          height: 2px;
          background: repeating-linear-gradient(90deg, rgba(247, 246, 242, 0.8) 0 36px, transparent 36px 64px);
          content: "";
        }

        .bus-stop {
          position: absolute;
          bottom: 26%;
          left: 46%;
          width: 42px;
          height: 170px;
          z-index: 7;
        }

        .stop-pole {
          position: absolute;
          bottom: 0;
          left: 19px;
          width: 4px;
          height: 138px;
          background: #2a2a28;
        }

        .stop-sign {
          position: absolute;
          top: 0;
          left: 0;
          z-index: 2;
          width: 42px;
          height: 30px;
          border: 2px solid #2a2a28;
          background: var(--proto-card);
          color: var(--proto-text);
          font-family: var(--proto-label);
          font-size: 18px;
          font-weight: 800;
          line-height: 27px;
          text-align: center;
        }

        .person {
          position: absolute;
          bottom: 21%;
          width: 22px;
          height: 58px;
          z-index: 7;
        }

        .person-one {
          left: 54%;
        }

        .person-two {
          left: 60%;
          transform: scale(0.88);
        }

        .person-three {
          left: 67%;
          transform: scale(0.96);
        }

        .person .head {
          display: block;
          width: 13px;
          height: 13px;
          margin: 0 auto 3px;
          border-radius: 50%;
          background: #1c1c1a;
        }

        .person .body {
          display: block;
          width: 14px;
          height: 38px;
          margin: 0 auto;
          border-radius: 7px 7px 2px 2px;
          background: #1c1c1a;
        }

        .conversation-panel {
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          min-height: calc(100vh - 96px);
          max-height: calc(100vh - 96px);
          padding: 18px;
        }

        .conversation-top {
          border-bottom: 1px solid var(--proto-border);
          padding-bottom: 14px;
        }

        .question-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .question-chips button {
          border: 1px solid var(--proto-border);
          border-radius: 999px;
          background: var(--proto-data);
          padding: 8px 10px;
          color: var(--proto-text);
          font-size: 12px;
        }

        .chat-thread {
          overflow-y: auto;
          padding: 18px 2px;
        }

        .empty-chat {
          color: var(--proto-muted);
          font-family: var(--proto-serif);
          font-size: 17px;
          line-height: 1.7;
        }

        .message-row {
          display: flex;
          margin-bottom: 12px;
        }

        .user-row {
          justify-content: flex-end;
        }

        .agent-row {
          justify-content: flex-start;
        }

        .user-message,
        .agent-message {
          max-width: 88%;
          border-radius: 8px;
          padding: 12px 14px;
          font-size: 13px;
          line-height: 1.6;
        }

        .user-message {
          background: var(--proto-text);
          color: var(--proto-bg);
        }

        .agent-message {
          border: 1px solid var(--proto-border);
          background: var(--proto-card);
          color: var(--proto-text);
          box-shadow: 0 8px 22px rgba(28, 28, 26, 0.06);
        }

        .agent-message p,
        .user-message p {
          white-space: pre-wrap;
        }

        .pending-message {
          color: var(--proto-muted);
        }

        .pending-message span {
          display: inline-block;
          margin-top: 4px;
          letter-spacing: 0.18em;
        }

        .error-message {
          border-color: rgba(184, 92, 42, 0.38);
        }

        .error-message button {
          margin-top: 10px;
          border: 1px solid rgba(184, 92, 42, 0.38);
          border-radius: 8px;
          background: var(--proto-data);
          padding: 7px 10px;
          color: var(--proto-warning);
          font-size: 12px;
          font-weight: 700;
        }

        .source-data {
          margin-top: 10px;
        }

        .source-data > button {
          background: transparent;
          color: var(--proto-muted);
          padding: 0;
          font-size: 11px;
        }

        .source-table-wrap {
          margin-top: 10px;
          border-radius: 8px;
          background: var(--proto-data);
          padding: 10px;
        }

        .source-table-wrap p {
          margin-bottom: 8px;
          color: var(--proto-muted);
          font-size: 11px;
        }

        .source-table-wrap table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }

        .source-table-wrap th,
        .source-table-wrap td {
          border-top: 1px solid var(--proto-border);
          padding: 7px 4px;
          text-align: left;
          vertical-align: top;
        }

        .source-table-wrap th {
          width: 48%;
          color: var(--proto-muted);
          font-weight: 500;
        }

        .source-table-wrap td {
          color: var(--proto-text);
          font-weight: 700;
        }

        .month-divider {
          margin: 18px 0;
          color: var(--proto-muted);
          font-size: 12px;
          letter-spacing: 0.1em;
          text-align: center;
        }

        .conversation-bottom {
          border-top: 1px solid var(--proto-border);
          padding-top: 14px;
        }

        .chat-input-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 46px;
          gap: 8px;
        }

        .chat-input-row input {
          width: 100%;
          border: 1px solid var(--proto-border);
          border-radius: 8px;
          background: var(--proto-data);
          padding: 13px 12px;
          color: var(--proto-text);
          font-size: 13px;
          box-shadow: none;
        }

        .chat-input-row button {
          border-radius: 8px;
          background: var(--proto-text);
          color: var(--proto-bg);
          font-size: 18px;
        }

        .conversation-actions {
          margin-top: 12px;
        }

        .conversation-actions .secondary-button,
        .conversation-actions .primary-button {
          width: 100%;
        }

        .dual-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 28px;
        }

        .conversation-actions .dual-actions {
          margin-top: 0;
        }

        .conversation-actions .dual-actions button {
          flex: 1 1 180px;
        }

        .comparison-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
          margin-bottom: 22px;
        }

        .comparison-column {
          padding: 26px;
        }

        .comparison-column h3 {
          margin-bottom: 22px;
          font-size: 32px;
          font-weight: 500;
        }

        .comparison-item {
          border-top: 1px solid var(--proto-border);
          padding: 18px 0;
        }

        .comparison-item:last-child {
          padding-bottom: 0;
        }

        .comparison-item h4 {
          margin: 0 0 8px;
          color: var(--proto-muted);
          font-family: var(--proto-label);
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .comparison-item p {
          font-size: 17px;
          line-height: 1.55;
        }

        .key-points {
          display: grid;
          gap: 4px;
          margin-top: 12px;
          color: var(--proto-muted);
          font-family: var(--proto-label);
          font-size: 12px;
        }

        .plain-summary {
          max-width: 900px;
          margin-bottom: 24px;
          padding: 24px 26px;
          font-size: 22px;
          line-height: 1.65;
        }

        .summary-sections {
          display: grid;
          gap: 16px;
          max-width: 900px;
        }

        .summary-row {
          display: grid;
          grid-template-columns: 44px 1fr;
          gap: 18px;
          padding: 24px 26px;
        }

        .summary-icon {
          font-family: var(--proto-label);
          font-size: 28px;
          line-height: 1.1;
        }

        .summary-row h3 {
          margin-bottom: 8px;
          font-size: 12px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .summary-row p {
          font-size: 19px;
          line-height: 1.65;
        }

        .summary-row.positive .summary-icon,
        .summary-row.positive h3 {
          color: var(--proto-positive);
        }

        .summary-row.warning .summary-icon,
        .summary-row.warning h3 {
          color: var(--proto-warning);
        }

        .summary-row.mixed .summary-icon,
        .summary-row.mixed h3 {
          color: var(--proto-muted);
        }

        @media (max-width: 900px) {
          .screen-inner {
            width: min(100% - 28px, 1120px);
            padding-block: 28px 48px;
          }

          .topbar {
            margin-bottom: 64px;
          }

          .neighborhood-grid,
          .comparison-grid,
          .simulation-environment {
            grid-template-columns: 1fr;
          }

          .street-scene {
            position: relative;
            top: auto;
            min-height: 460px;
          }

          .conversation-panel {
            min-height: 620px;
            max-height: none;
          }

          .dual-actions {
            flex-direction: column;
          }

          .primary-button,
          .secondary-button,
          .disabled-button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}

function ComparisonColumn({
  title,
  items,
}: {
  title: string;
  items: Array<{ month: string; text: string; points: string[] }>;
}) {
  return (
    <section className="comparison-column">
      <h3>{title}</h3>
      {items.map((item) => (
        <article className="comparison-item" key={item.month}>
          <h4>{item.month}</h4>
          <p>{item.text}</p>
          <div className="key-points">
            {item.points.map((point) => (
              <span key={point}>{point}</span>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}
