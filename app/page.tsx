"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, Database, MapPinned, Play } from "lucide-react";
import { AuthActions } from "@/components/AuthActions";

const AtlasHeroMap = dynamic(
  () => import("@/components/AtlasHeroMap").then((mod) => mod.AtlasHeroMap),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-[linear-gradient(145deg,#111315,#242a2e_58%,#536a8a)]" />,
  },
);

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[color:var(--cinema-ink)] text-white">
      <section className="relative min-h-screen overflow-hidden">
        <AtlasHeroMap />
        <div
          aria-hidden="true"
          className="absolute inset-0 z-[1] bg-[linear-gradient(90deg,rgba(10,12,13,0.94)_0%,rgba(10,12,13,0.76)_45%,rgba(10,12,13,0.3)_72%,rgba(10,12,13,0.56)_100%)]"
        />
        <div aria-hidden="true" className="absolute inset-0 z-[2] bg-[radial-gradient(circle_at_78%_20%,rgba(213,165,71,0.15),transparent_25%),linear-gradient(180deg,transparent_65%,rgba(17,19,21,0.72))]" />
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1680px] flex-col px-5 py-5 sm:px-8 lg:px-14 xl:px-20">
          <header className="flex w-full items-center justify-between gap-3">
            <Link
              className="inline-flex min-h-11 shrink-0 items-center gap-3 rounded-[var(--radius-md)] border border-white/18 bg-black/42 px-3.5 text-sm font-bold !text-white shadow-[0_14px_32px_rgba(0,0,0,0.28)] backdrop-blur-md"
              href="/"
            >
              <span className="atlas-brand-mark" />
              <span>LivingThere</span>
            </Link>
            <AuthActions className="!border-white/18 !bg-black/42 !shadow-[0_10px_28px_rgba(0,0,0,0.22)]" />
          </header>

          <div className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.58fr)] lg:py-16">
            <div className="w-full max-w-[780px]">
              <div className="mb-5 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/64">
                <MapPinned size={14} aria-hidden="true" />
                Chicago neighborhood simulator
              </div>
              <h1 className="film-display text-[clamp(3.2rem,7vw,7.6rem)] leading-[0.88] text-white [text-wrap:balance]">
                Don&apos;t tour a block. Live the year.
              </h1>
              <p className="mt-6 max-w-2xl text-base font-medium leading-7 text-white/76 [text-wrap:balance] sm:text-xl sm:leading-8">
                Preview how rent, commutes, safety, city services, and ordinary routines change across four seasons—before a Chicago neighborhood becomes your address.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/sim?demo=1&autorun=1"
                  className="inline-flex min-h-13 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[color:var(--accent)] px-5 text-sm font-extrabold text-white shadow-[0_18px_38px_rgba(0,0,0,0.28)] transition hover:bg-[color:var(--accent-strong)]"
                >
                  <Play size={16} fill="currentColor" aria-hidden="true" />
                  Watch a year in 90 seconds
                </Link>
                <Link
                  href="/profile"
                  className="inline-flex min-h-13 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-white/34 bg-white/8 px-5 text-sm font-extrabold text-white backdrop-blur-sm transition hover:bg-white/14"
                >
                  Build my year <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-white/52">
                <span className="inline-flex items-center gap-2"><Database size={13} /> Grounded in Chicago civic data</span>
                <span>No lease advice. No generic neighborhood scores.</span>
              </div>
            </div>

            <aside className="film-frame overflow-hidden p-4 sm:p-5 lg:justify-self-end">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="film-caption text-white/48">The year ahead</p>
                  <h2 className="film-display mt-2 text-3xl text-white">Four acts. One decision.</h2>
                </div>
                <span className="shrink-0 text-xs font-bold text-white/48">Chicago · 2024</span>
              </div>
              <div className="mt-5 grid gap-px overflow-hidden rounded-[var(--radius-md)] bg-white/12">
                {[
                  ["01", "Spring", "Settle into the commute", "var(--season-spring)"],
                  ["02", "Summer", "Learn the daily rhythm", "var(--season-summer)"],
                  ["03", "Autumn", "See the tradeoffs", "var(--season-autumn)"],
                  ["04", "Winter", "Make the call", "var(--season-winter)"],
                ].map(([number, season, line, color]) => (
                  <div key={season} className="grid grid-cols-[34px_84px_1fr] items-center gap-3 bg-black/32 px-3 py-3.5">
                    <span className="text-[10px] font-bold tracking-[0.14em] text-white/36">{number}</span>
                    <span className="text-sm font-extrabold" style={{ color }}>{season}</span>
                    <span className="text-xs font-medium text-white/62">{line}</span>
                  </div>
                ))}
              </div>
              <div className="season-strip mt-5" aria-hidden="true">
                <span /><span /><span /><span />
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
