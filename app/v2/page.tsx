import { buildMonthlySimulation, type MonthData } from "@/lib/buildMonthlySimulation";
import { generateMonthlyNarratives } from "@/lib/generateMonthlyNarratives";
import { Skybox } from "@/components/Skybox";

const MONTH_SHORT = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function transitCallout(signal: -1 | 0 | 1): { label: string; color: string } {
  if (signal === 1) return { label: "Easy commute", color: "var(--rail)" };
  if (signal === -1) return { label: "Packed mornings", color: "var(--accent)" };
  return { label: "Typical crowds", color: "var(--muted)" };
}

function serviceLabel(signal: 1 | -1 | null): { label: string; color: string } | null {
  if (signal === null) return null;
  return signal === 1
    ? { label: "City responsive", color: "var(--rail)" }
    : { label: "Slow city response", color: "var(--accent)" };
}

function crimeLabel(signal: 2 | 0 | -2 | null): { label: string; color: string } | null {
  if (signal === null) return null;
  if (signal === 2) return { label: "Quiet month", color: "var(--rail)" };
  if (signal === -2) return { label: "Rough stretch", color: "var(--accent)" };
  return { label: "Routine", color: "var(--muted)" };
}

function Callout({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-block rounded-full px-3 py-1 text-xs font-semibold"
      style={{ backgroundColor: "rgba(22,33,40,0.06)", color }}
    >
      {label}
    </span>
  );
}

function MonthCard({ month, narrative }: { month: MonthData; narrative: string }) {
  const transit = transitCallout(month.transit.crowdingSignal);
  const service = serviceLabel(month.services311?.serviceSignal ?? null);
  const crime = crimeLabel(month.crime?.crimeSignal ?? null);

  return (
    <article className="overflow-hidden rounded-2xl border border-[color:var(--panel-border)] shadow-[var(--shadow)]">
      <Skybox
        month={month.monthNumber}
        crimeSignal={month.crime?.crimeSignal ?? null}
        serviceSignal={month.services311?.serviceSignal ?? null}
        transitSignal={month.transit.crowdingSignal}
      />
      <div className="bg-[color:var(--panel)] px-8 py-7">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--muted)]">
          {MONTH_SHORT[month.monthNumber - 1]}
        </p>
        <p
          className="text-lg leading-[1.8] text-[color:var(--foreground)]"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          {narrative}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Callout label={transit.label} color={transit.color} />
          {service && <Callout label={service.label} color={service.color} />}
          {crime && <Callout label={crime.label} color={crime.color} />}
        </div>
      </div>
    </article>
  );
}

function VerdictCard({ verdict }: { verdict: string }) {
  return (
    <div
      className="rounded-2xl border border-[color:var(--panel-border)] px-10 py-10 shadow-[var(--shadow)]"
      style={{ backgroundColor: "rgba(163,63,47,0.06)" }}
    >
      <p className="mb-5 text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--accent)]">
        The verdict
      </p>
      <p
        className="text-xl leading-[1.8] text-[color:var(--foreground)]"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        {verdict}
      </p>
    </div>
  );
}

export default async function SimulationV2Page() {
  const months = await buildMonthlySimulation();
  const { narratives, verdict } = await generateMonthlyNarratives(months);

  const populated: MonthData[] = months.map((m, i) => ({ ...m, narrative: narratives[i] }));

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="mb-8 text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--muted)]">
        Hyde Park · 2024 · UChicago student commuter
      </p>

      <div className="flex flex-col gap-6">
        {populated.map((month) => (
          <MonthCard key={month.monthNumber} month={month} narrative={month.narrative ?? ""} />
        ))}
      </div>

      <div className="mt-8">
        <VerdictCard verdict={verdict} />
      </div>
    </main>
  );
}
