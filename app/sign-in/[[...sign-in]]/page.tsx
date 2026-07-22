import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

const clerkAppearance = {
  variables: {
    colorPrimary: "#111315",
    colorText: "#111315",
    colorTextSecondary: "#6e7474",
    colorBackground: "#fbf8f2",
    borderRadius: "8px",
    fontFamily: "Avenir Next, SF Pro Text, Segoe UI, system-ui, sans-serif",
  },
  elements: {
    cardBox: "shadow-[var(--shadow-lg)] border border-[color:var(--panel-border)]",
    headerTitle: "text-[color:var(--foreground)]",
    formButtonPrimary: "bg-[color:var(--cinema-ink)] hover:bg-[color:var(--cinema-graphite)]",
  },
};

export default function SignInPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--cinema-ink)] px-5 py-5 text-white sm:px-8">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(83,106,138,0.32),transparent_26%),radial-gradient(circle_at_38%_80%,rgba(185,95,63,0.18),transparent_26%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-6xl flex-col gap-8">
        <header className="flex min-h-13 items-center justify-between border-b border-white/14 py-2">
          <Link className="atlas-brand" href="/">
            <span className="atlas-brand-mark" />
            LivingThere
          </Link>
        </header>
        <section className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_440px]">
          <div className="max-w-2xl">
            <p className="film-caption text-white/52">Continue your story</p>
            <h1 className="film-display mt-5 text-5xl leading-[0.98] sm:text-7xl">
              Your next neighborhood is still waiting.
            </h1>
            <p className="mt-6 max-w-xl text-base font-medium leading-7 text-white/64">
              Sign in to return to saved profiles, grounded conversations, and the neighborhood years you have already lived through.
            </p>
            <div className="mt-9 grid max-w-lg grid-cols-4 gap-2">
              {[
                ["Spring", "var(--season-spring)"],
                ["Summer", "var(--season-summer)"],
                ["Autumn", "var(--season-autumn)"],
                ["Winter", "var(--season-winter)"],
              ].map(([label, color]) => (
                <div key={label} className="border-t pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/42" style={{ borderColor: color }}>
                  {label}
                </div>
              ))}
            </div>
          </div>
          <SignIn
            path="/sign-in"
            routing="path"
            signUpUrl="/sign-up"
            fallbackRedirectUrl="/sim"
            appearance={clerkAppearance}
          />
        </section>
      </div>
    </main>
  );
}
