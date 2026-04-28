import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-12">
      <section className="rounded-[2rem] border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-8 shadow-[var(--shadow)] backdrop-blur sm:p-10">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--muted)]">
          CityLiving Sim v1
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-[color:var(--foreground)] sm:text-5xl">
          Enter the grounded conversational prototype.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-[color:var(--muted)] sm:text-lg">
          V1 proves the core loop: ask a question about living in Hyde Park, pass structured neighborhood data to the
          agent, and receive a second-person answer grounded in that data.
        </p>
        <Link
          href="/prototype"
          className="mt-8 inline-flex rounded-full bg-[color:var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)]"
        >
          Open prototype →
        </Link>
      </section>
    </main>
  );
}
