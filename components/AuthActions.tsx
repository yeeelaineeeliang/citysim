"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

const secondaryButton =
  "inline-flex h-8 items-center justify-center rounded-[var(--radius-sm)] border border-white/35 bg-white/86 px-3 text-xs font-bold text-[color:var(--foreground)] transition hover:border-white hover:bg-white";

const primaryButton =
  "inline-flex h-8 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--sage)] px-3 text-xs font-bold text-white transition hover:bg-[color:var(--sage-strong)]";

interface AuthActionsProps {
  className?: string;
}

export function AuthActions({ className = "" }: AuthActionsProps) {
  return (
    <div
      className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-[var(--radius-md)] border border-white/25 bg-white/20 px-1.5 py-1 shadow-sm backdrop-blur-md ${className}`}
    >
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button type="button" className={secondaryButton}>
            Sign in
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button type="button" className={primaryButton}>
            Create account
          </button>
        </SignUpButton>
      </Show>

      <Show when="signed-in">
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
