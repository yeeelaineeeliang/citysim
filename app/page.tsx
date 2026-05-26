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
      <section className="relative min-h-screen overflow-hidden">
        <AtlasHeroMap />
        <div
          aria-hidden="true"
          className="absolute inset-0 z-[1] bg-[linear-gradient(to_right,rgba(0,0,0,0.70)_0%,rgba(0,0,0,0.35)_45%,transparent_70%)]"
        />
        <div className="relative z-10 flex min-h-screen w-full flex-col px-5 py-5 sm:px-8 lg:px-14 xl:px-20">
          <header className="flex w-full items-center justify-between gap-3">
            <Link
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[var(--radius-md)] border border-white/36 bg-[rgba(8,17,11,0.86)] px-3 text-sm font-bold !text-white shadow-[0_14px_32px_rgba(0,0,0,0.3)]"
              href="/"
            >
              <span className="atlas-brand-mark" />
              <span className="hidden sm:inline">CityLiving Sim</span>
            </Link>
            <AuthActions className="!border-white/36 !bg-[rgba(10,20,13,0.66)] !shadow-[0_10px_28px_rgba(0,0,0,0.28)] ![backdrop-filter:none]" />
          </header>

          <div className="flex flex-1 items-center py-14">
            <div className="w-full max-w-[660px] text-white">
              <h1 className="text-4xl font-bold leading-[1.04] tracking-normal text-white [text-wrap:balance] sm:text-6xl lg:text-7xl">
                Feel the neighborhood before you sign.
              </h1>
              <p className="mt-5 max-w-xl text-lg font-semibold leading-8 text-white [text-wrap:balance]">
                Chicago neighborhood atlas for renters. Build a living profile, map your commute, and preview daily life across the city.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/profile"
                  className="atlas-button-primary !min-h-12 !px-5"
                  style={{ background: '#4f6f45', color: 'white', border: 'none', boxShadow: '0 18px 34px rgba(18,43,24,0.34)' }}
                >
                  Create living profile
                </Link>
                <Link
                  href="/sim?demo=1"
                  className="atlas-button-ghost !min-h-12 !px-5"
                  style={{ background: 'transparent', color: 'white', border: '1.5px solid rgba(255,255,255,0.70)' }}
                >
                  Try Hyde Park demo
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
