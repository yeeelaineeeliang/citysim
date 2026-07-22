"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

const secondaryButton =
  "inline-flex h-8 items-center justify-center rounded-[var(--radius-sm)] border border-white/30 bg-[color:var(--cinema-paper)] px-2 text-[11px] font-bold text-[color:var(--cinema-ink)] transition hover:bg-white sm:px-3 sm:text-xs";

const primaryButton =
  "inline-flex h-8 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--cinema-ink)] px-2 text-[11px] font-bold text-white transition hover:bg-[color:var(--cinema-graphite)] sm:px-3 sm:text-xs";

interface AuthActionsProps {
  className?: string;
}

export function AuthActions({ className = "" }: AuthActionsProps) {
  return (
    <div
      className={`inline-flex min-h-10 shrink-0 items-center gap-1 rounded-[var(--radius-md)] border border-white/25 bg-white/20 px-1 py-1 shadow-sm backdrop-blur-md sm:gap-2 sm:px-1.5 ${className}`}
    >
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button type="button" className={secondaryButton}>
            Sign in
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button type="button" className={primaryButton}>
            <span className="sm:hidden">Create</span>
            <span className="hidden sm:inline">Create account</span>
          </button>
        </SignUpButton>
      </Show>

      <Show when="signed-in">
        <a href="/runs" className={secondaryButton}>
          My seasons
        </a>
        <UserButton
          appearance={{
            elements: {
              userButtonAvatarBox: "h-8 w-8",
            },
          }}
        />
      </Show>
    </div>
  );
}
