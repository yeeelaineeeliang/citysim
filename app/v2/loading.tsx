export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="mb-8 text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--muted)]">
        Hyde Park · 2024 · UChicago student commuter
      </p>

      <div className="flex flex-col gap-6">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="animate-pulse overflow-hidden rounded-2xl border border-[color:var(--panel-border)]"
          >
            <div className="h-[140px] w-full" style={{ backgroundColor: "rgba(22,33,40,0.07)" }} />
            <div className="bg-[color:var(--panel)] px-8 py-7">
              <div className="mb-4 h-3 w-16 rounded" style={{ backgroundColor: "rgba(22,33,40,0.1)" }} />
              <div className="space-y-2">
                <div className="h-4 rounded" style={{ backgroundColor: "rgba(22,33,40,0.08)" }} />
                <div className="h-4 w-5/6 rounded" style={{ backgroundColor: "rgba(22,33,40,0.08)" }} />
                <div className="h-4 w-4/6 rounded" style={{ backgroundColor: "rgba(22,33,40,0.08)" }} />
              </div>
              <div className="mt-5 flex gap-2">
                <div className="h-6 w-24 rounded-full" style={{ backgroundColor: "rgba(22,33,40,0.08)" }} />
                <div className="h-6 w-28 rounded-full" style={{ backgroundColor: "rgba(22,33,40,0.08)" }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-[color:var(--muted)]">
        Pulling 12 months of data and writing your year…
      </p>
    </main>
  );
}
