"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  MapPin,
  ShieldCheck,
  Sparkles,
  TrainFront,
} from "lucide-react";
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
  submitLabel?: string;
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

const FORM_STEPS = [
  { id: "basics", label: "Profile", title: "Budget, anchor, commute" },
  { id: "priorities", label: "Priorities", title: "What should win" },
  { id: "review", label: "Preview", title: "Review your fit signals" },
] as const;

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

function priorityLabel(value: number): string {
  if (value >= 5) return "High";
  if (value >= 3) return "Medium";
  return "Light";
}

export function OnboardingProfileForm({ onComplete, submitLabel = "Start simulation" }: Readonly<Props>) {
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
  const [activeStep, setActiveStep] = useState(0);

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
    if (activeStep < FORM_STEPS.length - 1) {
      setActiveStep((step) => Math.min(FORM_STEPS.length - 1, step + 1));
      return;
    }
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
    const workplaceLocation = resolvedWorkplaceCoords
      ? {
          workplaceLat: resolvedWorkplaceCoords.lat,
          workplaceLng: resolvedWorkplaceCoords.lng,
        }
      : {};
    onComplete({
      budgetRange: budgetToRange(budget),
      monthlyBudget: budget,
      workplace: workplace.trim() || "not specified",
      ...workplaceLocation,
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

  const sortedPriorities = [...PRIORITY_KEYS].sort((a, b) => priorities[b] - priorities[a]);
  const topPriority = sortedPriorities[0];
  const selectedLifestyle = lifestyle.slice(0, 4);
  const stepId = FORM_STEPS[activeStep]?.id ?? "basics";
  const isFirstStep = activeStep === 0;
  const isLastStep = activeStep === FORM_STEPS.length - 1;

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
      <div className="grid gap-5">
        <div className="rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-white/62 p-2">
          <div className="grid gap-2 sm:grid-cols-3">
            {FORM_STEPS.map((item, index) => {
              const active = index === activeStep;
              const complete = index < activeStep;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveStep(index)}
                  className={`flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-3 text-left transition ${
                    active
                      ? "bg-[color:var(--foreground)] text-white shadow-sm"
                      : complete
                        ? "bg-[color:var(--sage-100)] text-[color:var(--sage-strong)]"
                        : "text-[color:var(--muted-strong)] hover:bg-white"
                  }`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/72 text-xs font-extrabold text-[color:var(--foreground)]">
                    {complete ? <CheckCircle2 size={15} /> : index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-extrabold">{item.label}</span>
                    <span className="block truncate text-[11px] font-semibold opacity-75">{item.title}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {stepId === "basics" && (
          <section className="grid gap-4">
            <fieldset className="grid gap-4 rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-white/72 p-4">
              <div className="flex items-center justify-between gap-4">
                <legend className="flex items-center gap-2 text-sm font-extrabold text-[color:var(--foreground)]">
                  <DollarSign size={17} /> Monthly rent budget
                </legend>
                <p className="rounded-[var(--radius-sm)] bg-[color:var(--sage-100)] px-2.5 py-1 text-sm font-bold text-[color:var(--sage-strong)]">
                  ${budget.toLocaleString()}
                </p>
              </div>
              <input
                aria-label="Monthly rent budget slider"
                type="range"
                min={MIN_BUDGET}
                max={MAX_BUDGET}
                step={STEP}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs font-semibold text-[color:var(--muted)]">
                <span>${MIN_BUDGET.toLocaleString()}</span>
                <span>${MAX_BUDGET.toLocaleString()}+</span>
              </div>
            </fieldset>

            <div className="grid gap-2 rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-white/72 p-4 text-sm font-bold">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="workplace-input" className="flex items-center gap-2">
                  <MapPin size={17} /> Workplace or school
                </label>
                {workplaceCoords && (
                  <span className="rounded-[var(--radius-sm)] bg-[rgba(44,122,82,0.12)] px-2 py-1 text-xs font-bold text-[color:var(--park)]">
                    pinned
                  </span>
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
                  placeholder="Search any address, school, or workplace"
                  autoComplete="off"
                  className="atlas-input w-full px-4 py-3 font-normal"
                />
                {geocoding && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[color:var(--muted)]">
                    searching
                  </span>
                )}
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="atlas-scrollbar absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-white shadow-lg">
                    {suggestions.map((s) => (
                      <li key={`${s.lat},${s.lng}`}>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            const label = s.displayName.split(",").slice(0, 2).join(", ");
                            setWorkplace(label);
                            setWorkplaceCoords({ lat: s.lat, lng: s.lng });
                            setSuggestions([]);
                            setShowSuggestions(false);
                            workplaceRef.current?.blur();
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm font-normal leading-snug hover:bg-[color:var(--panel-solid)]"
                        >
                          <span className="block font-semibold">{s.displayName.split(",").slice(0, 2).join(", ")}</span>
                          <span className="block text-xs text-[color:var(--muted)]">
                            {s.displayName.split(",").slice(2, 4).join(",")}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <fieldset className="grid gap-3 rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-white/72 p-4">
              <legend className="flex items-center gap-2 text-sm font-extrabold">
                <TrainFront size={17} /> Commute preference
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {COMMUTE_OPTIONS.map(({ value, label }) => (
                  <label
                    key={value}
                    className={`cursor-pointer rounded-[var(--radius-md)] border px-3 py-2 text-center text-sm font-bold transition ${
                      commutePref === value
                        ? "border-[color:var(--lake-strong)] bg-[color:var(--lake-strong)] text-white shadow-sm"
                        : "border-[color:var(--panel-border)] bg-white/72 text-[color:var(--muted-strong)] hover:border-[color:var(--lake)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="commutePref"
                      value={value}
                      checked={commutePref === value}
                      onChange={() => setCommutePref(value)}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          </section>
        )}

        {stepId === "priorities" && (
          <section className="grid gap-4">
            <fieldset className="grid gap-3 rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-white/72 p-4">
              <legend className="flex items-center gap-2 text-sm font-extrabold">
                <ShieldCheck size={17} /> Priority weights
              </legend>
              <div className="grid gap-3">
                {PRIORITY_KEYS.map((key) => (
                  <label key={key} className="grid gap-1.5">
                    <span className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-bold text-[color:var(--muted-strong)]">{PRIORITY_LABELS[key]}</span>
                      <span className="text-xs font-bold uppercase text-[color:var(--muted)]">{priorityLabel(priorities[key])}</span>
                    </span>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={priorities[key]}
                      onChange={(e) =>
                        setPriorities((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                      }
                      className="w-full"
                    />
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="grid gap-3 rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-white/72 p-4">
              <legend className="flex items-center gap-2 text-sm font-extrabold">
                <Sparkles size={17} /> Lifestyle preferences
              </legend>
              <div className="flex flex-wrap gap-2">
                {LIFESTYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleLifestyle(opt)}
                    className={`rounded-[var(--radius-sm)] border px-3 py-2 text-xs font-bold transition-colors ${
                      lifestyle.includes(opt)
                        ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-white"
                        : "border-[color:var(--panel-border)] bg-white text-[color:var(--muted-strong)] hover:border-[color:var(--accent)]"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </fieldset>
          </section>
        )}

        {stepId === "review" && (
          <section className="grid gap-4">
            <div className="grid gap-3 rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-white/72 p-4">
              <p className="text-sm font-extrabold">Journey preview</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[var(--radius-sm)] bg-[color:var(--sage-100)] p-3">
                  <p className="text-xs font-bold text-[color:var(--muted)]">Budget</p>
                  <p className="mt-1 text-lg font-extrabold">${budget.toLocaleString()}</p>
                </div>
                <div className="rounded-[var(--radius-sm)] bg-[rgba(101,151,184,0.14)] p-3">
                  <p className="text-xs font-bold text-[color:var(--muted)]">Commute</p>
                  <p className="mt-1 text-lg font-extrabold capitalize">{commutePref}</p>
                </div>
                <div className="rounded-[var(--radius-sm)] bg-[rgba(199,101,69,0.12)] p-3">
                  <p className="text-xs font-bold text-[color:var(--muted)]">Top priority</p>
                  <p className="mt-1 text-lg font-extrabold">{PRIORITY_LABELS[topPriority]}</p>
                </div>
              </div>
            </div>

            <label className="grid gap-2 rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-white/72 p-4 text-sm font-bold">
              Anything else?
              <textarea
                name="notes"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Near the Red Line, weekend parking, a dog-friendly block"
                className="atlas-input resize-none px-4 py-3 font-normal"
              />
            </label>
          </section>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            disabled={isFirstStep}
            onClick={() => setActiveStep((step) => Math.max(0, step - 1))}
            className="atlas-button-secondary gap-2 disabled:opacity-40"
          >
            <ArrowLeft size={16} /> Back
          </button>
          {isLastStep ? (
            <button type="submit" className="atlas-button-primary gap-2">
              {submitLabel} <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveStep((step) => Math.min(FORM_STEPS.length - 1, step + 1))}
              className="atlas-button-primary gap-2"
            >
              Continue <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>

      <aside className="grid content-between gap-6 rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-[rgba(255,252,246,0.9)] p-5">
        <div className="grid gap-5">
          <div>
            <p className="atlas-kicker text-[color:var(--muted)]">Fit preview</p>
            <p className="mt-2 text-3xl font-semibold text-[color:var(--foreground)]">
              ${budget.toLocaleString()}
            </p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--muted)]">
              {budgetToRange(budget)} · {commutePref[0].toUpperCase() + commutePref.slice(1)} commute
            </p>
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--muted)]">Top signal</p>
            <div className="rounded-[var(--radius-md)] bg-[color:var(--sage-100)] p-4">
              <p className="text-lg font-bold text-[color:var(--sage-strong)]">
                {PRIORITY_LABELS[topPriority]}
              </p>
              <div className="mt-3 h-2 rounded-full bg-white">
                <div
                  className="h-2 rounded-full bg-[color:var(--sage)]"
                  style={{ width: `${(priorities[topPriority] / 5) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--muted)]">Anchor</p>
            <p className="min-h-12 rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-white/72 px-3 py-2 text-sm font-semibold text-[color:var(--muted-strong)]">
              {workplace.trim() || "Workplace not set yet"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(selectedLifestyle.length ? selectedLifestyle : ["Parks", "Transit", "Grocery"]).map((tag) => (
              <span key={tag} className="rounded-[var(--radius-sm)] bg-[rgba(199,101,69,0.1)] px-2.5 py-1.5 text-xs font-bold text-[color:var(--accent-strong)]">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <p className="rounded-[var(--radius-md)] bg-[rgba(101,151,184,0.13)] px-3 py-2 text-xs font-bold leading-5 text-[color:var(--lake-strong)]">
          You can compare neighborhoods before creating an account.
        </p>
      </aside>
    </form>
  );
}
