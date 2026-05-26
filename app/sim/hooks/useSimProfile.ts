"use client";

import { useEffect, useState } from "react";
import type { UserProfile } from "@/lib/tools/types";
import { loadStoredProfile, saveStoredProfile } from "../profileStorage";
import type { NeighborhoodMatch, Step } from "../types";

interface UseSimProfileParams {
  demoMode: boolean;
  setStep: (s: Step) => void;
}

export function useSimProfile({ demoMode, setStep }: UseSimProfileParams) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [neighborhood, setNeighborhood] = useState("Hyde Park");
  const [matchMode, setMatchMode] = useState<"known" | "match" | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matches, setMatches] = useState<NeighborhoodMatch[]>([]);
  const [matchError, setMatchError] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) return;
    const storedProfile = loadStoredProfile();
    if (!storedProfile) return;
    setProfile(storedProfile);
    setStep("neighborhood");
    void loadMatches(storedProfile);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  function handleProfileComplete(p: UserProfile) {
    saveStoredProfile(p);
    setProfile(p);
    setStep("neighborhood");
    setMatches([]);
    setMatchError(null);
    void loadMatches(p);
  }

  async function loadMatches(nextProfile: UserProfile) {
    setMatchMode("match");
    setMatchLoading(true);
    setMatchError(null);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: nextProfile, topN: 5 }),
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

  async function runMatching() {
    if (!profile) return;
    await loadMatches(profile);
  }

  return {
    profile, setProfile,
    neighborhood, setNeighborhood,
    matchMode, setMatchMode,
    matchLoading, matches, matchError,
    handleProfileComplete,
    runMatching,
  };
}
