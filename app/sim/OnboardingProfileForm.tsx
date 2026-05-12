"use client";

import { useEffect, useRef, useState } from "react";
import type { UserProfile } from "@/lib/tools/types";
import type { GeocodeSuggestion } from "@/app/api/geocode/route";

const GEOCODE_DEBOUNCE_MS = 350;
const STORAGE_KEY = "citysim:profile_form";

interface StoredFormState {
  budget: number;
  workplace: string;
  workplaceCoords: { lat: number; lng: number } | null;
  commutePref: UserProfile["commutePref"];
  priorities: Record<string, number>;
  lifestyle: string[];
  notes: string;
}

function loadSaved(): Partial<StoredFormState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredFormState) : {};
  } catch {
    return {};
  }
}

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

const DEFAULT_PRIORITIES: PrioritySliders = {
  safety: 3,
  transit: 3,
  affordability: 3,
  cityServices: 2,
  entertainment: 2,
};

function budgetToRange(value: number): string {
  if (value < 1000) return "Under $1,000";
  if (value < 1500) return "$1,000–$1,500";
  if (value < 2000) return "$1,500–$2,000";
  return "$2,000+";
}

export function OnboardingProfileForm({ onComplete }: Readonly<Props>) {
  const [budget, setBudget] = useState(1400);
  const [workplace, setWorkplace] = useState("");
  const [workplaceCoords, setWorkplaceCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const workplaceRef = useRef<HTMLInputElement>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [commutePref, setCommutePref] = useState<UserProfile["commutePref"]>("transit");
  const [priorities, setPriorities] = useState<PrioritySliders>(DEFAULT_PRIORITIES);
  const [lifestyle, setLifestyle] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const saved = loadSaved();
    setBudget(saved.budget ?? 1400);
    setWorkplace(saved.workplace ?? "");
    setWorkplaceCoords(saved.workplaceCoords ?? null);
    setCommutePref(saved.commutePref ?? "transit");
    setPriorities({ ...DEFAULT_PRIORITIES, ...(saved.priorities ?? {}) });
    setLifestyle(saved.lifestyle ?? []);
    setNotes(saved.notes ?? "");
  }, []);

  useEffect(() => {
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    if (workplace.trim().length < 2) { setSuggestions([]); return; }
    setGeocoding(true);
    geocodeTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(workplace)}`);
        const data = (await res.json()) as { suggestions: GeocodeSuggestion[] };
        setSuggestions(data.suggestions ?? []);
      } catch { setSuggestions([]); }
      finally { setGeocoding(false); }
    }, GEOCODE_DEBOUNCE_MS);
  }, [workplace]);

  function toggleLifestyle(tag: string) {
    setLifestyle((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  async function resolveWorkplaceCoords() {
    if (workplaceCoords || workplace.trim().length < 2) return workplaceCoords;
    try {
      const local = suggestions[0];
      if (local) return { lat: local.lat, lng: local.lng };
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(workplace)}`);
      const data = (await res.json()) as { suggestions?: GeocodeSuggestion[] };
      const first = data.suggestions?.[0];
      return first ? { lat: first.lat, lng: first.lng } : null;
    } catch {
      return null;
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const resolvedWorkplaceCoords = await resolveWorkplaceCoords();
    if (resolvedWorkplaceCoords) setWorkplaceCoords(resolvedWorkplaceCoords);
    try {
      const saved: StoredFormState = {
        budget,
        workplace,
        workplaceCoords: resolvedWorkplaceCoords,
        commutePref,
        priorities,
        lifestyle,
        notes,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch { /* storage full or unavailable */ }
    const total = Object.values(priorities).reduce((a, b) => a + b, 0) || 1;
    onComplete({
      budgetRange: budgetToRange(budget),
      workplace: workplace.trim() || "not specified",
      ...(resolvedWorkplaceCoords ?? {}),
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
      <div className="grid gap-2 text-sm font-semibold">
        <div className="flex items-center justify-between">
          <label htmlFor="workplace-input">Workplace or school</label>
          {workplaceCoords && (
            <span className="text-xs font-normal text-[color:var(--accent)]">✓ location pinned</span>
          )}
        </div>
        <div className="relative">
          <input
            id="workplace-input"
            ref={workplaceRef}
            name="workplace"
            type="text"
            value={workplace}
            onChange={(e) => {
              setWorkplace(e.target.value);
              setWorkplaceCoords(null);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Search any address, university, or neighborhood…"
            autoComplete="off"
            className="w-full rounded-xl border border-[color:var(--panel-border)] bg-white px-4 py-3 font-normal outline-none focus:border-[color:var(--accent)]"
          />
          {geocoding && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[color:var(--muted)]">
              searching…
            </span>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-[color:var(--panel-border)] bg-white shadow-lg">
              {suggestions.map((s) => (
                <li key={`${s.lat},${s.lng}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      // Trim to the first two segments for a cleaner label
                      const label = s.displayName.split(",").slice(0, 2).join(", ");
                      setWorkplace(label);
                      setWorkplaceCoords({ lat: s.lat, lng: s.lng });
                      setSuggestions([]);
                      setShowSuggestions(false);
                      workplaceRef.current?.blur();
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm font-normal leading-snug hover:bg-[color:var(--panel)]"
                  >
                    <span className="block">{s.displayName.split(",").slice(0, 2).join(", ")}</span>
                    <span className="block text-xs text-[color:var(--muted)]">
                      {s.displayName.split(",").slice(2, 4).join(",")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-xs font-normal text-[color:var(--muted)]">
          Select from the list to pin coordinates — or type freely and matching uses your text.
        </p>
      </div>

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
