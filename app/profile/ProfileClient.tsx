"use client";

import { useRouter } from "next/navigation";
import { AuthActions } from "@/components/AuthActions";
import type { UserProfile } from "@/lib/tools/types";
import { OnboardingProfileForm } from "@/app/sim/OnboardingProfileForm";
import { saveStoredProfile } from "@/app/sim/profileStorage";

export function ProfileClient() {
  const router = useRouter();

  function handleComplete(profile: UserProfile) {
    saveStoredProfile(profile);
    router.push("/sim");
  }

  return (
    <main className="atlas-page min-h-screen px-5 py-5 text-[color:var(--foreground)] sm:px-8 sm:py-7">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="atlas-topbar">
          <a className="atlas-brand" href="/">
            <span className="atlas-brand-mark" />
            CityLiving Sim
          </a>
          <AuthActions />
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.78fr)_minmax(420px,1fr)] lg:items-start">
          <div className="min-h-[320px] overflow-hidden rounded-[var(--radius-xl)] border border-white/15 bg-[linear-gradient(145deg,rgba(79,111,69,0.94),rgba(199,101,69,0.7))] p-7 text-white shadow-[var(--shadow-lg)]">
            <div className="flex h-full min-h-[280px] flex-col justify-between">
              <div>
                <p className="atlas-kicker text-white/62">Living profile</p>
                <h1 className="mt-4 max-w-lg text-4xl font-semibold leading-[1.02] tracking-normal sm:text-5xl">
                  Tune the map to your daily life.
                </h1>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {["Budget", "Commute", "Lifestyle"].map((label, index) => (
                  <div key={label} className="rounded-[var(--radius-md)] border border-white/14 bg-white/10 p-4 backdrop-blur">
                    <p className="text-2xl font-semibold text-[color:var(--amber)]">0{index + 1}</p>
                    <p className="mt-1 text-sm font-semibold text-white">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <section className="atlas-surface p-4 sm:p-6">
            <OnboardingProfileForm onComplete={handleComplete} submitLabel="Save profile and explore" />
          </section>
        </section>
      </div>
    </main>
  );
}
