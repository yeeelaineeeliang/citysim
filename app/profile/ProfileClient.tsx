"use client";

import { useRouter } from "next/navigation";
import type { UserProfile } from "@/lib/tools/types";
import { ProfileOnboardingShell } from "@/app/sim/ProfileOnboardingShell";
import { saveStoredProfile } from "@/app/sim/profileStorage";

export function ProfileClient() {
  const router = useRouter();

  function handleComplete(profile: UserProfile) {
    saveStoredProfile(profile);
    router.push("/sim");
  }

  return <ProfileOnboardingShell onComplete={handleComplete} />;
}
