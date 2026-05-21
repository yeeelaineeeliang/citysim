"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { AuthActions } from "@/components/AuthActions";

const AtlasHeroMap = dynamic(
  () => import("@/components/AtlasHeroMap").then((mod) => mod.AtlasHeroMap),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-[linear-gradient(120deg,#4f6f45,#6f8d5f_48%,#f7f0e3)]" />,
  },
);

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <section className="relative min-h-[88vh] overflow-hidden">
        <AtlasHeroMap />
        <div className="relative z-10 mx-auto flex min-h-[88vh] w-full max-w-7xl flex-col px-5 py-5 sm:px-8">
          <header className="atlas-topbar">
            <Link className="atlas-brand" href="/">
              <span className="atlas-brand-mark" />
              CityLiving Sim
            </Link>
            <AuthActions />
          </header>

          <div className="flex flex-1 items-center py-14">
            <div className="max-w-3xl text-white">
              <p className="atlas-kicker text-white/68">Chicago neighborhood atlas</p>
              <h1 className="mt-5 text-5xl font-semibold leading-[0.98] tracking-normal sm:text-6xl lg:text-7xl">
                Feel the neighborhood before you sign.
              </h1>
              <p className="mt-6 max-w-xl text-lg font-medium leading-8 text-white/78">
                Build a living profile, map your commute, and preview daily life across Chicago.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/profile" className="atlas-button-primary bg-[color:var(--amber)] text-[color:var(--foreground)] hover:bg-[#f0bd4a]">
                  Create living profile
                </Link>
                <Link href="/sim?demo=1" className="atlas-button-ghost">
                  Try Hyde Park demo
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="-mt-10 pb-16">
        <div className="relative z-20 mx-auto grid w-full max-w-7xl gap-3 px-5 sm:px-8 lg:grid-cols-3">
          {[
            ["01", "Profile", "Budget, commute, and lifestyle shape the map."],
            ["02", "Match", "Compare neighborhood fit with workplace context."],
            ["03", "Simulate", "Move month by month, then ask local questions."],
          ].map(([number, title, body]) => (
            <article key={title} className="atlas-card p-5 shadow-[var(--shadow)]">
              <p className="text-sm font-extrabold text-[color:var(--accent)]">{number}</p>
              <h2 className="mt-3 text-xl font-extrabold">{title}</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--muted)]">{body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
