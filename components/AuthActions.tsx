"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

const secondaryButton =
  "inline-flex h-8 items-center justify-center rounded-full border border-white/35 bg-white/80 px-3 text-xs font-semibold text-[color:var(--foreground)] transition hover:border-white hover:bg-white";

const primaryButton =
  "inline-flex h-8 items-center justify-center rounded-full bg-[color:var(--accent)] px-3 text-xs font-semibold text-white transition hover:bg-[color:var(--accent-strong)]";

interface AuthActionsProps {
  className?: string;
}

export function AuthActions({ className = "" }: AuthActionsProps) {
  return (
    <div
      className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-white/25 bg-white/20 px-1.5 py-1 shadow-sm backdrop-blur-md ${className}`}
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
