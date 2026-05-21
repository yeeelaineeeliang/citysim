import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

const clerkAppearance = {
  variables: {
    colorPrimary: "#6f8d5f",
    colorText: "#263126",
    colorTextSecondary: "#69735f",
    colorBackground: "#fff9ee",
    borderRadius: "8px",
    fontFamily: "Avenir Next, Segoe UI Rounded, SF Pro Rounded, system-ui, sans-serif",
  },
  elements: {
    cardBox: "shadow-[var(--shadow-lg)] border border-[color:var(--panel-border)]",
    headerTitle: "text-[color:var(--foreground)]",
    formButtonPrimary: "bg-[color:var(--sage)] hover:bg-[color:var(--sage-strong)]",
  },
};

export default function SignUpPage() {
  return (
    <main className="atlas-page min-h-screen px-5 py-5 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-6xl flex-col gap-8">
        <header className="atlas-topbar">
          <Link className="atlas-brand" href="/">
            <span className="atlas-brand-mark" />
            CityLiving Sim
          </Link>
        </header>
        <section className="grid flex-1 items-center gap-8 lg:grid-cols-[1fr_440px]">
          <div className="max-w-2xl text-white">
            <p className="atlas-kicker text-white/64">Start here</p>
            <h1 className="mt-4 text-5xl font-semibold leading-none tracking-normal">
              Build a profile for your next neighborhood.
            </h1>
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
