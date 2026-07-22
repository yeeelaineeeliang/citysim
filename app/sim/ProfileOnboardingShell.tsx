"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { Bike, CarFront, Footprints, MapPin, TrainFront } from "lucide-react";
import { AuthActions } from "@/components/AuthActions";
import { JourneyRail } from "@/components/JourneyRail";
import type { UserProfile } from "@/lib/tools/types";
import {
  OnboardingProfileForm,
  type OnboardingProfileDraft,
} from "./OnboardingProfileForm";

interface ProfileOnboardingShellProps {
  onComplete: (profile: UserProfile) => void;
  submitLabel?: string;
}

const ProfileOnboardingPreviewMap = dynamic(
  () => import("./ProfileOnboardingPreviewMap").then((mod) => mod.ProfileOnboardingPreviewMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full min-h-[160px] animate-pulse rounded-[var(--radius-md)] bg-white/18" />
    ),
  },
);

const DEFAULT_DRAFT: OnboardingProfileDraft = {
  activeStep: 0,
  stepId: "basics",
  hasInteracted: false,
  budget: 1400,
  budgetRange: "$1,000–$1,500",
  workplace: "",
  workplaceCoords: null,
  previewWorkplaceCoords: null,
  commutePref: "transit",
  rawPriorities: {
    safety: 3,
    transit: 3,
    affordability: 3,
    cityServices: 2,
    entertainment: 2,
  },
  priorities: {
    safety: 3 / 13,
    transit: 3 / 13,
    affordability: 3 / 13,
    cityServices: 2 / 13,
    entertainment: 2 / 13,
  },
  lifestyle: [],
  notes: "",
  profile: {
    budgetRange: "$1,000–$1,500",
    monthlyBudget: 1400,
    workplace: "not specified",
    commutePref: "transit",
    priorities: {
      safety: 3 / 13,
      transit: 3 / 13,
      affordability: 3 / 13,
      cityServices: 2 / 13,
      entertainment: 2 / 13,
    },
    lifestyle: [],
    notes: "",
  },
};

const STEP_COPY: Record<OnboardingProfileDraft["stepId"], string> = {
  basics: "Set a budget and workplace so the preview can start narrowing Chicago neighborhoods.",
  priorities: "Priority weights are filtering the same map before you choose where to simulate.",
  requests: "The preview holds your current match set while you add extra context.",
  review: "Your strongest neighborhood matches are highlighted before you explore.",
};

const MODE_ICON = {
  transit: TrainFront,
  driving: CarFront,
  walking: Footprints,
  biking: Bike,
};

export function ProfileOnboardingShell({ onComplete, submitLabel }: ProfileOnboardingShellProps) {
  const [draft, setDraft] = useState<OnboardingProfileDraft>(DEFAULT_DRAFT);
  const handleDraftChange = useCallback((nextDraft: OnboardingProfileDraft) => {
    setDraft(nextDraft);
  }, []);
  const ModeIcon = MODE_ICON[draft.commutePref];
  const anchorLabel = draft.workplace.trim() || "Not set";

  return (
    <main className="atlas-page-neighborhood min-h-screen px-4 py-4 text-[color:var(--foreground)] sm:px-7 sm:py-6">
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-5">
        <header className="atlas-topbar !bg-[rgba(251,248,242,0.9)]">
          <a className="atlas-brand !text-[color:var(--foreground)] ![text-shadow:none]" href="/">
            <span className="atlas-brand-mark" />
            LivingThere
          </a>
          <AuthActions />
        </header>

        <section className="atlas-surface px-4 py-3 sm:px-5">
          <JourneyRail current="profile" />
        </section>

        <section className="grid items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-[var(--radius-lg)] bg-[color:var(--cinema-ink)] text-white shadow-[var(--shadow-lg)] lg:sticky lg:top-6">
            <div className="p-5 sm:p-6">
              <p className="film-caption text-white/48">Chapter one · Your life</p>
              <h1 className="film-display mt-3 text-4xl leading-[0.98] sm:text-5xl">
                Give the city your point of view.
              </h1>
              <p className="mt-4 text-sm font-medium leading-6 text-white/62">
                {STEP_COPY[draft.stepId]}
              </p>

              <dl className="mt-6 grid gap-px overflow-hidden rounded-[var(--radius-md)] bg-white/12">
                <div className="flex items-center justify-between gap-3 bg-white/6 px-3 py-3">
                  <dt className="text-xs font-bold text-white/48">Monthly budget</dt>
                  <dd className="text-sm font-extrabold">${draft.budget.toLocaleString()}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 bg-white/6 px-3 py-3">
                  <dt className="text-xs font-bold text-white/48">Daily anchor</dt>
                  <dd className="flex min-w-0 items-center gap-1.5 text-sm font-extrabold">
                    <MapPin size={14} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">{anchorLabel}</span>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 bg-white/6 px-3 py-3">
                  <dt className="text-xs font-bold text-white/48">How you move</dt>
                  <dd className="flex items-center gap-1.5 text-sm font-extrabold capitalize">
                    <ModeIcon size={14} aria-hidden="true" />
                    {draft.commutePref}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="h-[210px] border-t border-white/12 bg-white/8 sm:h-[260px] lg:h-[330px]">
              <ProfileOnboardingPreviewMap draft={draft} variant={draft.hasInteracted ? "compact" : "expanded"} />
            </div>
            <div className="season-strip rounded-none" aria-hidden="true">
              <span /><span /><span /><span />
            </div>
          </aside>

          <section className="atlas-surface p-4 sm:p-6">
            <div className="mb-5 border-b border-[color:var(--panel-border)] pb-5">
              <p className="film-caption text-[color:var(--muted)]">Living profile · Step {draft.activeStep + 1} of 4</p>
              <h2 className="film-display mt-2 text-3xl text-[color:var(--foreground)] sm:text-4xl">
                {draft.stepId === "basics" && "Start with the shape of an ordinary day."}
                {draft.stepId === "priorities" && "Decide what should win when tradeoffs appear."}
                {draft.stepId === "requests" && "Add the details a dataset cannot guess."}
                {draft.stepId === "review" && "This is the life we will take into Chicago."}
              </h2>
            </div>
            <OnboardingProfileForm onComplete={onComplete} submitLabel={submitLabel} onDraftChange={handleDraftChange} />
          </section>
        </section>
      </div>
    </main>
  );
}
