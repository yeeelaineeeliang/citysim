import Link from "next/link";
import { AuthActions } from "@/components/AuthActions";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-12">
      <section className="rounded-[2rem] border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-8 shadow-[var(--shadow)] backdrop-blur sm:p-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--muted)]">
            CityLiving Sim
          </p>
          <AuthActions className="border-[color:var(--panel-border)] bg-white/45" />
        </div>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-[color:var(--foreground)] sm:text-5xl">
          What would your year in a Chicago neighborhood actually feel like?
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-[color:var(--muted)] sm:text-lg">
          Not a score — a simulation. Set your profile, pick a neighborhood, and ask anything.
          Every answer is grounded in real CTA ridership, 311 service requests, and crime data.
        </p>
        <Link
          href="/sim"
          className="mt-8 inline-flex rounded-full bg-[color:var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)]"
        >
          Start your simulation →
        </Link>
      </section>
    </main>
  );
}
