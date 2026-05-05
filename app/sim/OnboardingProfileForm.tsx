"use client";

import { useState } from "react";
import type { UserProfile } from "@/lib/tools/types";

interface Props {
  onComplete: (profile: UserProfile) => void;
}

const MIN_BUDGET = 700;
const MAX_BUDGET = 3500;
const STEP = 50;

const COMMUTE_OPTIONS: { value: UserProfile["commutePref"]; label: string }[] = [
  { value: "transit", label: "Transit" },
  { value: "driving", label: "Driving" },
  { value: "walking", label: "Walking" },
  { value: "biking", label: "Biking" },
];

const PRIORITY_KEYS = ["safety", "transit", "affordability", "cityServices", "entertainment"] as const;
const PRIORITY_LABELS: Record<(typeof PRIORITY_KEYS)[number], string> = {
  safety: "Safety",
  transit: "Transit",
  affordability: "Affordability",
  cityServices: "City Services",
  entertainment: "Entertainment",
};

const LIFESTYLE_OPTIONS = [
  "Parks & outdoor space",
  "Grocery access",
  "Restaurants & dining",
  "Bars & nightlife",
  "Family-friendly",
  "Pet-friendly",
  "Public library access",
  "Farmers markets",
  "Community safety",
  "Short commute",
];

type PrioritySliders = Record<(typeof PRIORITY_KEYS)[number], number>;

function budgetToRange(value: number): string {
  if (value < 1000) return "Under $1,000";
  if (value < 1500) return "$1,000–$1,500";
  if (value < 2000) return "$1,500–$2,000";
  return "$2,000+";
}

export function OnboardingProfileForm({ onComplete }: Readonly<Props>) {
  const [budget, setBudget] = useState(1400);
  const [workplace, setWorkplace] = useState("");
  const [commutePref, setCommutePref] = useState<UserProfile["commutePref"]>("transit");
  const [priorities, setPriorities] = useState<PrioritySliders>({
    safety: 3,
    transit: 3,
    affordability: 3,
    cityServices: 2,
    entertainment: 2,
  });
  const [lifestyle, setLifestyle] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  function toggleLifestyle(tag: string) {
    setLifestyle((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const total = Object.values(priorities).reduce((a, b) => a + b, 0) || 1;
    onComplete({
      budgetRange: budgetToRange(budget),
      workplace: workplace.trim() || "not specified",
      commutePref,
      priorities: {
        safety: priorities.safety / total,
        transit: priorities.transit / total,
        affordability: priorities.affordability / total,
        cityServices: priorities.cityServices / total,
        entertainment: priorities.entertainment / total,
      },
      lifestyle,
      notes,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid gap-6">
      {/* Budget slider */}
      <fieldset className="grid gap-3">
        <div className="flex items-end justify-between gap-4">
          <legend className="text-sm font-semibold">Monthly rent budget</legend>
          <p className="text-sm font-semibold text-[color:var(--accent)]">
            Up to ${budget.toLocaleString()}
          </p>
        </div>
        <div className="grid gap-4 rounded-xl border border-[color:var(--panel-border)] bg-white px-4 py-4">
          <label className="grid gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
            Budget
            <input
              aria-label="Monthly rent budget slider"
              type="range"
              min={MIN_BUDGET}
              max={MAX_BUDGET}
              step={STEP}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="accent-[color:var(--accent)]"
            />
          </label>
          <div className="flex justify-between text-xs text-[color:var(--muted)]">
            <span>${MIN_BUDGET.toLocaleString()}</span>
            <span>${MAX_BUDGET.toLocaleString()}+</span>
          </div>
        </div>
      </fieldset>

      {/* Workplace */}
      <label className="grid gap-2 text-sm font-semibold">
        Workplace or school
        <input
          name="workplace"
          type="text"
          value={workplace}
          onChange={(e) => setWorkplace(e.target.value)}
          placeholder="UChicago — 5600 S University Ave"
          className="rounded-xl border border-[color:var(--panel-border)] bg-white px-4 py-3 font-normal outline-none"
        />
      </label>

      {/* Commute preference */}
      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">Commute preference</legend>
        <div className="flex flex-wrap gap-3">
          {COMMUTE_OPTIONS.map(({ value, label }) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-1.5 text-sm"
            >
              <input
                type="radio"
                name="commutePref"
                value={value}
                checked={commutePref === value}
                onChange={() => setCommutePref(value)}
                className="accent-[color:var(--accent)]"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Priority weights */}
      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold">
          Priority weights{" "}
          <span className="font-normal text-[color:var(--muted)]">— drag to adjust</span>
        </legend>
        <div className="grid gap-2 rounded-xl border border-[color:var(--panel-border)] bg-white px-4 py-4">
          {PRIORITY_KEYS.map((key) => (
            <div key={key} className="flex items-center gap-3">
              <span className="w-28 text-sm text-[color:var(--muted)]">
                {PRIORITY_LABELS[key]}
              </span>
              <input
                type="range"
                min={1}
                max={5}
                value={priorities[key]}
                onChange={(e) =>
                  setPriorities((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                }
                className="flex-1 accent-[color:var(--accent)]"
              />
              <span className="w-3 text-right text-xs text-[color:var(--muted)]">
                {priorities[key]}
              </span>
            </div>
          ))}
        </div>
      </fieldset>

      {/* Lifestyle */}
      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">Lifestyle preferences</legend>
        <div className="flex flex-wrap gap-2">
          {LIFESTYLE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => toggleLifestyle(opt)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                lifestyle.includes(opt)
                  ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-white"
                  : "border-[color:var(--panel-border)] bg-white text-[color:var(--muted)] hover:border-[color:var(--accent)]"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Notes */}
      <label className="grid gap-2 text-sm font-semibold">
        Anything else?{" "}
        <span className="font-normal text-[color:var(--muted)]">
          (commute lines, gym, religious institutions, pets…)
        </span>
        <textarea
          name="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Near the Red Line, need weekend parking, have a dog"
          className="resize-none rounded-xl border border-[color:var(--panel-border)] bg-white px-4 py-3 font-normal outline-none"
        />
      </label>

      <button
        type="submit"
        className="justify-self-start rounded-full bg-[color:var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)]"
      >
        Start simulation →
      </button>
    </form>
  );
}
