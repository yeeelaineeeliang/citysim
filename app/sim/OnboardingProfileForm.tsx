"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  MapPin,
  PencilLine,
  ShieldCheck,
  Sparkles,
  TrainFront,
} from "lucide-react";
import type { UserProfile } from "@/lib/tools/types";
import type { GeocodeSuggestion } from "@/app/api/geocode/route";

const GEOCODE_DEBOUNCE_MS = 350;
const REVIEW_SUBMIT_ARM_DELAY_MS = 500;
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
  onDraftChange?: (draft: OnboardingProfileDraft) => void;
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
  cityServices: "City services",
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
  { id: "basics", label: "Profile", title: "Budget, workplace, commute" },
  { id: "priorities", label: "Priorities", title: "What should win" },
  { id: "requests", label: "Requests", title: "Anything extra" },
  { id: "review", label: "Review", title: "Ready to simulate" },
] as const;

type PrioritySliders = Record<(typeof PRIORITY_KEYS)[number], number>;
export type OnboardingStepId = (typeof FORM_STEPS)[number]["id"];

export interface OnboardingProfileDraft {
  activeStep: number;
  stepId: OnboardingStepId;
  hasInteracted: boolean;
  budget: number;
  budgetRange: string;
  workplace: string;
  workplaceCoords: { lat: number; lng: number } | null;
  previewWorkplaceCoords: { lat: number; lng: number } | null;
  commutePref: UserProfile["commutePref"];
  rawPriorities: PrioritySliders;
  priorities: UserProfile["priorities"];
  lifestyle: string[];
  notes: string;
  profile: UserProfile;
}

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
  return "Low";
}

function normalizedPriorities(priorities: PrioritySliders): UserProfile["priorities"] {
  const total = Object.values(priorities).reduce((a, b) => a + b, 0) || 1;
  return {
    safety: priorities.safety / total,
    transit: priorities.transit / total,
    affordability: priorities.affordability / total,
    cityServices: priorities.cityServices / total,
    entertainment: priorities.entertainment / total,
  };
}

function topPriorityKey(priorities: PrioritySliders) {
  return PRIORITY_KEYS.reduce((best, key) => (priorities[key] > priorities[best] ? key : best), PRIORITY_KEYS[0]);
}

function normalizeRequestText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function savedPrioritiesAreDefault(saved?: Record<string, number>) {
  if (!saved) return true;
  return PRIORITY_KEYS.every((key) => saved[key] === DEFAULT_PRIORITIES[key]);
}

function hasMeaningfulSavedState(saved: Partial<StoredFormState>) {
  return Boolean(
    (typeof saved.budget === "number" && saved.budget !== 1400) ||
      saved.workplace?.trim() ||
      saved.workplaceCoords ||
      (saved.commutePref && saved.commutePref !== "transit") ||
      !savedPrioritiesAreDefault(saved.priorities) ||
      saved.lifestyle?.length ||
      saved.notes?.trim(),
  );
}

const REQUEST_SUGGESTIONS = [
  "Walking distance to a gym",
  "Near a train line",
  "Quiet at night",
  "Easy grocery trips",
];

export function OnboardingProfileForm({ onComplete, submitLabel = "Start simulation", onDraftChange }: Readonly<Props>) {
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
  const [hasInteracted, setHasInteracted] = useState(false);
  const [reviewSubmitReady, setReviewSubmitReady] = useState(false);

  useEffect(() => {
    const saved = loadSaved();
    setBudget(saved.budget ?? 1400);
    setWorkplace(saved.workplace ?? "");
    setWorkplaceCoords(saved.workplaceCoords ?? null);
    setCommutePref(saved.commutePref ?? "transit");
    setPriorities({ ...DEFAULT_PRIORITIES, ...(saved.priorities ?? {}) });
    setLifestyle(saved.lifestyle ?? []);
    setNotes(saved.notes ?? "");
    setHasInteracted(hasMeaningfulSavedState(saved));
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

  useEffect(() => {
    if (activeStep !== FORM_STEPS.length - 1) {
      setReviewSubmitReady(false);
      return;
    }

    setReviewSubmitReady(false);
    const timer = window.setTimeout(() => setReviewSubmitReady(true), REVIEW_SUBMIT_ARM_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeStep]);

  function markInteracted() {
    setHasInteracted(true);
  }

  function toggleLifestyle(tag: string) {
    markInteracted();
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
    markInteracted();
    if (activeStep < FORM_STEPS.length - 1) {
      setActiveStep((step) => Math.min(FORM_STEPS.length - 1, step + 1));
      return;
    }
    if (!reviewSubmitReady) return;

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
    const normalized = normalizedPriorities(priorities);
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
      priorities: normalized,
      lifestyle,
      notes,
    });
  }

  const topPriority = topPriorityKey(priorities);
  const stepId = FORM_STEPS[activeStep]?.id ?? "basics";
  const isFirstStep = activeStep === 0;
  const isLastStep = activeStep === FORM_STEPS.length - 1;
  const previewSuggestion = workplace.trim().length >= 2 ? suggestions[0] ?? null : null;
  const previewWorkplaceCoords = useMemo(() => {
    const coords = workplaceCoords ?? previewSuggestion;
    return coords ? { lat: coords.lat, lng: coords.lng } : null;
  }, [previewSuggestion, workplaceCoords]);
  const draft = useMemo<OnboardingProfileDraft>(() => {
    const normalized = normalizedPriorities(priorities);
    const workplaceLocation = previewWorkplaceCoords
      ? {
          workplaceLat: previewWorkplaceCoords.lat,
          workplaceLng: previewWorkplaceCoords.lng,
        }
      : {};

    return {
      activeStep,
      stepId,
      hasInteracted,
      budget,
      budgetRange: budgetToRange(budget),
      workplace,
      workplaceCoords,
      previewWorkplaceCoords,
      commutePref,
      rawPriorities: priorities,
      priorities: normalized,
      lifestyle,
      notes,
      profile: {
        budgetRange: budgetToRange(budget),
        monthlyBudget: budget,
        workplace: workplace.trim() || "not specified",
        ...workplaceLocation,
        commutePref,
        priorities: normalized,
        lifestyle,
        notes,
      },
    };
  }, [activeStep, budget, commutePref, hasInteracted, lifestyle, notes, previewWorkplaceCoords, priorities, stepId, workplace, workplaceCoords]);

  useEffect(() => {
    onDraftChange?.(draft);
  }, [draft, onDraftChange]);
  const normalizedNotes = normalizeRequestText(notes);
  const visibleRequestSuggestions = REQUEST_SUGGESTIONS.filter(
    (request) => !normalizedNotes.includes(normalizeRequestText(request)),
  );
  const contentClassName = `grid gap-4 rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-white/82 p-4 ${
    stepId === "priorities" ? "lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.86fr)] lg:items-start" : ""
  }`;

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <div className="rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-white/72 p-2">
        <div className="grid gap-2 md:grid-cols-4">
          {FORM_STEPS.map((item, index) => {
            const active = index === activeStep;
            const complete = index < activeStep;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  markInteracted();
                  setActiveStep(index);
                }}
                className={`flex min-h-12 items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left transition ${
                  active
                    ? "bg-[color:var(--foreground)] text-white shadow-sm"
                    : complete
                      ? "bg-[color:var(--sage-100)] text-[color:var(--sage-strong)]"
                      : "text-[color:var(--muted-strong)] hover:bg-white"
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/82 text-sm font-semibold text-[color:var(--foreground)]">
                  {complete ? <CheckCircle2 size={17} /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="mt-0.5 block text-xs font-normal leading-4 opacity-78">{item.title}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <section className={contentClassName}>
        {stepId === "basics" && (
          <>
            <fieldset className="grid gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <legend className="flex items-center gap-2 text-lg font-semibold text-[color:var(--foreground)]">
                  <DollarSign size={21} /> Monthly rent budget
                </legend>
                <p className="text-3xl font-medium leading-none text-[color:var(--sage-strong)]">
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
                onChange={(e) => {
                  markInteracted();
                  setBudget(Number(e.target.value));
                }}
                className="w-full"
              />
              <div className="flex justify-between text-base font-semibold text-[color:var(--muted)]">
                <span>${MIN_BUDGET.toLocaleString()}</span>
                <span>${MAX_BUDGET.toLocaleString()}+</span>
              </div>
            </fieldset>

            <div className="grid gap-3 border-t border-[color:var(--panel-border)] pt-4 text-base font-normal">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label htmlFor="workplace-input" className="flex items-center gap-2 text-lg font-semibold">
                  <MapPin size={21} /> Workplace or school
                </label>
                {workplaceCoords && (
                  <span
                    aria-label="Workplace location pinned from the selected search result"
                    title="Workplace location pinned from the selected search result"
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[rgba(44,122,82,0.12)] px-3 py-1.5 text-sm font-semibold text-[color:var(--park)]"
                  >
                    <MapPin size={14} aria-hidden="true" /> Pinned location
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
                    markInteracted();
                    setWorkplace(e.target.value);
                    setWorkplaceCoords(null);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="Search any address, school, or workplace"
                  autoComplete="off"
                  className="atlas-input min-h-14 w-full px-4 py-3 text-base font-normal"
                />
                {geocoding && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[color:var(--muted)]">
                    searching
                  </span>
                )}
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="atlas-scrollbar absolute z-20 mt-2 max-h-60 w-full overflow-y-auto rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-white shadow-lg">
                    {suggestions.map((s) => (
                      <li key={`${s.lat},${s.lng}`}>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            markInteracted();
                            const label = s.displayName.split(",").slice(0, 2).join(", ");
                            setWorkplace(label);
                            setWorkplaceCoords({ lat: s.lat, lng: s.lng });
                            setSuggestions([]);
                            setShowSuggestions(false);
                            workplaceRef.current?.blur();
                          }}
                          className="w-full px-4 py-3 text-left text-base font-normal leading-snug hover:bg-[color:var(--panel-solid)]"
                        >
                          <span className="block font-semibold">{s.displayName.split(",").slice(0, 2).join(", ")}</span>
                          <span className="block text-sm text-[color:var(--muted)]">
                            {s.displayName.split(",").slice(2, 4).join(",")}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <fieldset className="grid gap-3 border-t border-[color:var(--panel-border)] pt-4">
              <legend className="flex items-center gap-2 text-lg font-semibold">
                <TrainFront size={21} /> Commute preference
              </legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {COMMUTE_OPTIONS.map(({ value, label }) => (
                  <label
                    key={value}
                    className={`flex min-h-12 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border px-3 py-2.5 text-center text-base font-semibold transition ${
                      commutePref === value
                        ? "border-[color:var(--lake-strong)] bg-[rgba(101,151,184,0.16)] text-[color:var(--lake-strong)] shadow-[0_0_0_3px_rgba(101,151,184,0.12)]"
                        : "border-[color:var(--panel-border)] bg-white text-[color:var(--muted-strong)] hover:border-[color:var(--lake)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="commutePref"
                      value={value}
                      checked={commutePref === value}
                      onChange={() => {
                        markInteracted();
                        setCommutePref(value);
                      }}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {stepId === "priorities" && (
          <>
            <fieldset className="grid gap-3">
              <legend className="flex items-center gap-2 text-lg font-semibold">
                <ShieldCheck size={21} /> Priority weights
              </legend>
              <div className="grid gap-3">
                {PRIORITY_KEYS.map((key) => (
                  <label key={key} className="grid gap-1">
                    <span className="flex items-center justify-between gap-3 text-base">
                      <span className="font-semibold text-[color:var(--muted-strong)]">{PRIORITY_LABELS[key]}</span>
                      <span className="text-sm font-semibold text-[color:var(--muted)]">{priorityLabel(priorities[key])}</span>
                    </span>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={priorities[key]}
                      onChange={(e) => {
                        markInteracted();
                        setPriorities((prev) => ({ ...prev, [key]: Number(e.target.value) }));
                      }}
                      className="w-full"
                    />
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="grid gap-2 border-t border-[color:var(--panel-border)] pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
              <legend className="flex items-center gap-2 text-lg font-semibold">
                <Sparkles size={21} /> Lifestyle preferences
              </legend>
              <div className="flex flex-wrap gap-2">
                {LIFESTYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleLifestyle(opt)}
                    className={`min-h-9 rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm font-semibold transition-colors ${
                      lifestyle.includes(opt)
                        ? "border-[color:var(--sage)] bg-[color:var(--sage)] text-white"
                        : "border-[color:var(--panel-border)] bg-white text-[color:var(--muted-strong)] hover:border-[color:var(--sage)]"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {stepId === "requests" && (
          <>
            <div className="grid gap-1.5">
              <p className="flex items-center gap-2 text-lg font-semibold text-[color:var(--foreground)]">
                <PencilLine size={22} /> Special requests
              </p>
              <p className="max-w-2xl text-sm font-normal leading-6 text-[color:var(--muted)]">
                Add anything that should influence recommendations but did not fit the sliders. This can be practical, personal, or as specific as a street corner.
              </p>
            </div>

            <label className="grid gap-3">
              <span className="text-base font-semibold text-[color:var(--muted-strong)]">
                What else should CityLiving Sim consider?
              </span>
              <textarea
                name="notes"
                rows={3}
                value={notes}
                onChange={(e) => {
                  markInteracted();
                  setNotes(e.target.value);
                }}
                placeholder="Example: walking distance to a gym, near the Red Line, quieter block, weekend parking, dog-friendly area"
                className="atlas-input min-h-[88px] resize-none border-[color:var(--lake)] bg-white px-4 py-3 text-base font-normal leading-6 shadow-[0_0_0_4px_rgba(101,151,184,0.1)]"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {visibleRequestSuggestions.map((request) => (
                <button
                  key={request}
                  type="button"
                  onClick={() => {
                    markInteracted();
                    setNotes((current) => (current.trim() ? `${current.trim()}, ${request.toLowerCase()}` : request));
                  }}
                  className="rounded-[var(--radius-sm)] border border-[rgba(101,151,184,0.34)] bg-[rgba(101,151,184,0.1)] px-3 py-2 text-sm font-medium text-[color:var(--lake-strong)] transition hover:bg-[rgba(101,151,184,0.18)]"
                >
                  {request}
                </button>
              ))}
            </div>
          </>
        )}

        {stepId === "review" && (
          <>
            <div className="grid gap-3">
              <p className="text-lg font-semibold">Review and run the simulation</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-white/70 p-3">
                  <p className="text-sm font-medium text-[color:var(--muted)]">Budget</p>
                  <p className="mt-1 text-xl font-semibold">${budget.toLocaleString()}</p>
                </div>
                <div className="rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-white/70 p-3">
                  <p className="text-sm font-medium text-[color:var(--muted)]">Workplace</p>
                  <p className="mt-1 line-clamp-2 text-xl font-semibold">{workplace.trim() || "Not specified"}</p>
                </div>
                <div className="rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-white/70 p-3">
                  <p className="text-sm font-medium text-[color:var(--muted)]">Commute</p>
                  <p className="mt-1 text-xl font-semibold capitalize">{commutePref}</p>
                </div>
                <div className="rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-white/70 p-3">
                  <p className="text-sm font-medium text-[color:var(--muted)]">Top priority</p>
                  <p className="mt-1 text-xl font-semibold">{PRIORITY_LABELS[topPriority]}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-2 border-t border-[color:var(--panel-border)] pt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-base font-medium text-[color:var(--muted)]">Special requests</p>
                <button
                  type="button"
                  onClick={() => {
                    markInteracted();
                    setActiveStep(2);
                  }}
                  className="text-sm font-semibold text-[color:var(--sage-strong)] hover:text-[color:var(--foreground)]"
                >
                  Edit
                </button>
              </div>
              <p className="text-base font-normal leading-7 text-[color:var(--foreground)]">
                {notes.trim() || "No extra requests added."}
              </p>
            </div>
          </>
        )}
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          disabled={isFirstStep}
          onClick={() => {
            markInteracted();
            setActiveStep((step) => Math.max(0, step - 1));
          }}
          className="atlas-button-secondary min-h-12 gap-2 text-base disabled:opacity-40"
        >
          <ArrowLeft size={18} /> Back
        </button>
        {isLastStep ? (
          <button
            type="submit"
            disabled={!reviewSubmitReady}
            className="atlas-button-primary min-h-12 gap-2 text-base disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitLabel} <ArrowRight size={18} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              markInteracted();
              setActiveStep((step) => Math.min(FORM_STEPS.length - 1, step + 1));
            }}
            className="atlas-button-primary min-h-12 gap-2 text-base"
          >
            Continue <ArrowRight size={18} />
          </button>
        )}
      </div>
    </form>
  );
}
