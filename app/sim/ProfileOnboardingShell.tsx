"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { Bike, CarFront, Footprints, MapPin, TrainFront } from "lucide-react";
import { AuthActions } from "@/components/AuthActions";
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
  const compactHero = draft.hasInteracted || draft.activeStep > 0;
  const anchorLabel = draft.workplace.trim() || "Not set";

  return (
    <main className="atlas-page min-h-screen px-5 py-4 text-[color:var(--foreground)] sm:px-8 sm:py-5">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4">
        <header className="atlas-topbar">
          <a className="atlas-brand" href="/">
            <span className="atlas-brand-mark" />
            CityLiving Sim
          </a>
          <AuthActions />
        </header>

        {compactHero ? (
          <section className="relative overflow-hidden rounded-[var(--radius-lg)] border border-white/18 bg-[linear-gradient(135deg,rgba(79,111,69,0.94),rgba(101,151,184,0.64),rgba(247,240,227,0.2))] p-2 text-white shadow-[var(--shadow-lg)]">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,0.82fr)_minmax(340px,0.9fr)] lg:items-stretch">
              <div className="flex min-w-0 flex-col justify-center gap-3 px-1 py-1">
                <p className="text-sm font-semibold text-white/76">Living profile</p>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="rounded-[var(--radius-sm)] border border-white/18 bg-white/12 px-3 py-2 text-sm font-semibold text-white/92">
                    ${draft.budget.toLocaleString()}
                  </span>
                  <span className="flex min-w-0 max-w-full items-center gap-1.5 rounded-[var(--radius-sm)] border border-white/18 bg-white/12 px-3 py-2 text-sm font-semibold text-white/92 sm:max-w-[360px]">
                    <MapPin size={14} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">{anchorLabel}</span>
                  </span>
                  <span className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-white/18 bg-white/12 px-3 py-2 text-sm font-semibold capitalize text-white/92">
                    <ModeIcon size={14} aria-hidden="true" />
                    {draft.commutePref}
                  </span>
                </div>
              </div>

              <div className="h-[160px] overflow-hidden rounded-[var(--radius-md)] border border-white/20 bg-white/12 shadow-[0_18px_44px_rgba(38,49,38,0.2)] sm:h-[180px] lg:h-[200px]">
                <ProfileOnboardingPreviewMap draft={draft} variant="compact" />
              </div>
            </div>
          </section>
        ) : (
          <section className="relative overflow-hidden rounded-[var(--radius-lg)] border border-white/18 bg-[linear-gradient(135deg,rgba(79,111,69,0.94),rgba(101,151,184,0.64),rgba(247,240,227,0.22))] p-2 text-white shadow-[var(--shadow-lg)] sm:p-3">
            <div className="grid gap-3 lg:h-[176px] lg:grid-cols-[minmax(0,0.82fr)_minmax(360px,1.18fr)] lg:items-stretch">
              <div className="flex min-w-0 flex-col justify-between gap-2 px-1 py-1 sm:px-2">
                <div>
                  <p className="text-sm font-semibold text-white/72">Living profile</p>
                  <h1 className="mt-1.5 max-w-3xl text-3xl font-medium leading-[1.05] tracking-normal sm:text-[2rem]">
                    Tune the map to your daily life.
                  </h1>
                  <p className="mt-1.5 max-w-2xl text-sm font-normal leading-5 text-white/80">
                    {STEP_COPY[draft.stepId]}
                  </p>
                </div>

                <div className="grid gap-2 text-sm font-semibold text-white/90 sm:grid-cols-3">
                  <div className="rounded-[var(--radius-md)] border border-white/18 bg-white/12 px-3 py-1.5 backdrop-blur">
                    <span className="block text-white/64">Budget</span>
                    <span className="mt-1 block text-base text-white">${draft.budget.toLocaleString()}</span>
                  </div>
                  <div className="rounded-[var(--radius-md)] border border-white/18 bg-white/12 px-3 py-1.5 backdrop-blur">
                    <span className="block text-white/64">Workplace</span>
                    <span className="mt-1 flex min-w-0 items-center gap-1.5 text-base text-white">
                      <MapPin size={15} className="shrink-0" aria-hidden="true" />
                      <span className="truncate">{anchorLabel}</span>
                    </span>
                  </div>
                  <div className="rounded-[var(--radius-md)] border border-white/18 bg-white/12 px-3 py-1.5 backdrop-blur">
                    <span className="block text-white/64">Commute</span>
                    <span className="mt-1 flex items-center gap-1.5 text-base capitalize text-white">
                      <ModeIcon size={16} aria-hidden="true" />
                      {draft.commutePref}
                    </span>
                  </div>
                </div>
              </div>

              <div className="h-[150px] overflow-hidden rounded-[var(--radius-md)] border border-white/20 bg-white/12 shadow-[0_18px_44px_rgba(38,49,38,0.2)] lg:h-full">
                <ProfileOnboardingPreviewMap draft={draft} variant="expanded" />
              </div>
            </div>
          </section>
        )}

        <section className="atlas-surface p-4 sm:p-5">
          <OnboardingProfileForm onComplete={onComplete} submitLabel={submitLabel} onDraftChange={handleDraftChange} />
        </section>
      </div>
    </main>
  );
}
