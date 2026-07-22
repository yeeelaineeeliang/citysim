import { SignUp } from "@clerk/nextjs";
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

export default function SignUpPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--cinema-ink)] px-5 py-5 text-white sm:px-8">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(111,155,139,0.28),transparent_26%),radial-gradient(circle_at_38%_80%,rgba(213,165,71,0.16),transparent_26%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-6xl flex-col gap-8">
        <header className="flex min-h-13 items-center justify-between border-b border-white/14 py-2">
          <Link className="atlas-brand" href="/">
            <span className="atlas-brand-mark" />
            LivingThere
          </Link>
        </header>
        <section className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_440px]">
          <div className="max-w-2xl">
            <p className="film-caption text-white/52">Begin your year</p>
            <h1 className="film-display mt-5 text-5xl leading-[0.98] sm:text-7xl">
              Make Chicago personal before it becomes permanent.
            </h1>
            <p className="mt-6 max-w-xl text-base font-medium leading-7 text-white/64">
              Save your living profile, run protected simulations, ask grounded follow-up questions, and compare the neighborhoods that make your shortlist.
            </p>
            <div className="mt-9 grid max-w-lg grid-cols-4 gap-2">
              {[
                ["Profile", "var(--season-spring)"],
                ["Match", "var(--season-summer)"],
                ["Live", "var(--season-autumn)"],
                ["Decide", "var(--season-winter)"],
              ].map(([label, color]) => (
                <div key={label} className="border-t pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/42" style={{ borderColor: color }}>
                  {label}
                </div>
              ))}
            </div>
          </div>
          <SignUp
            path="/sign-up"
            routing="path"
            signInUrl="/sign-in"
            fallbackRedirectUrl="/sim"
            appearance={clerkAppearance}
          />
        </section>
      </div>
    </main>
  );
}
