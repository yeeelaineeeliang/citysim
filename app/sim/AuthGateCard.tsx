"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { LockKeyhole } from "lucide-react";
import type { AuthPromptReason } from "./types";

export function AuthGateCard({
  reason,
  onDismiss,
}: {
  reason: AuthPromptReason;
  onDismiss: () => void;
}) {
  const title = reason === "year" ? "Keep this year connected to you" : "Keep this conversation connected to you";
  const body =
    reason === "year"
      ? "Sign in to run the protected simulation and keep this living profile available when you return."
      : "Sign in so Sam can use protected civic-data tools and keep your neighborhood conversation together.";

  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--panel-border)] bg-[color:var(--cinema-paper)] p-4 text-[color:var(--foreground)] shadow-[var(--shadow)]">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(83,106,138,0.12)] text-[color:var(--season-winter)]">
          <LockKeyhole size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-[color:var(--foreground)]">{title}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-[color:var(--muted)]">{body}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <SignInButton mode="modal">
              <button type="button" className="atlas-button-secondary">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button type="button" className="atlas-button-primary">
                Create account
              </button>
            </SignUpButton>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-[var(--radius-md)] px-3 text-xs font-extrabold text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            >
              Keep previewing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
