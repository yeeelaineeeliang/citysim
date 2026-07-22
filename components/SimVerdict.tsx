import Link from "next/link";
import type { DataSummary } from "@/lib/tools/types";
import type { SimAct } from "@/app/sim/types";
import type { UserProfile } from "@/lib/tools/types";
import { computeVerdict } from "@/lib/verdict";
import { JourneyRail } from "./JourneyRail";

interface SimVerdictProps {
  neighborhood: string;
  profile: UserProfile;
  actDataSummaries: Partial<Record<SimAct, DataSummary>>;
  onDebrief: () => void;
  onTryAnother: () => void;
  isDemoMode?: boolean;
  savedRunId?: string | null;
}

export function SimVerdict({
  neighborhood,
  profile,
  actDataSummaries,
  onDebrief,
  onTryAnother,
  isDemoMode = false,
  savedRunId,
}: SimVerdictProps) {
  const signals = computeVerdict(neighborhood, profile, actDataSummaries);

  return (
    <div className="absolute inset-0 z-[1100] overflow-y-auto bg-[rgba(17,19,21,0.9)] p-4 text-white backdrop-blur-md sm:p-8">
      <div className="mx-auto flex min-h-full w-full max-w-5xl items-center">
        <div className="w-full border border-white/14 bg-[rgba(17,19,21,0.76)] p-5 shadow-2xl sm:p-8">
          <JourneyRail current="decide" inverse className="mb-8 hidden sm:block" />

          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div>
              <p className="film-caption text-white/44">Final chapter · The decision</p>
              <h2 className="film-display mt-3 text-5xl leading-[0.92] sm:text-6xl">
                Your year in {neighborhood}.
              </h2>
              <p className="mt-5 max-w-md text-sm font-medium leading-6 text-white/58">
                The film is over. These are the tradeoffs that stayed visible across the year—not a universal score, but a verdict against the life you asked Chicago to support.
              </p>

              <div className="mt-8 grid gap-2">
                <button
                  type="button"
                  onClick={onDebrief}
                  className="w-full rounded-[var(--radius-md)] bg-[color:var(--cinema-ivory)] px-4 py-3 text-sm font-extrabold text-[color:var(--cinema-ink)] transition hover:bg-white"
                >
                  Investigate the year with Sam
                </button>

                {isDemoMode ? (
                  <Link
                    href="/profile"
                    className="block w-full rounded-[var(--radius-md)] border border-white/16 bg-white/8 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-white/14"
                  >
                    Build a year around my life
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={onTryAnother}
                    className="w-full rounded-[var(--radius-md)] border border-white/16 bg-white/8 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/14"
                  >
                    Live somewhere else
                  </button>
                )}

                {savedRunId && (
                  <Link
                    href={`/runs?highlight=${savedRunId}`}
                    className="block w-full rounded-[var(--radius-md)] border border-white/16 bg-white/8 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-white/14"
                  >
                    Compare saved years <span className="text-white/44">· saved</span>
                  </Link>
                )}
              </div>
            </div>

            <div className="grid gap-px overflow-hidden rounded-[var(--radius-md)] bg-white/14 sm:grid-cols-2">
              {signals.map(({ key, label, verdict, detail, caveat }, index) => (
                <article key={key} className="bg-[color:var(--cinema-graphite)] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="film-caption text-white/42">{label}</p>
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: ["var(--season-spring)", "var(--season-summer)", "var(--season-autumn)", "var(--season-winter)"][index % 4] }}
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-3 text-base font-extrabold">{verdict}</p>
                  <p className="mt-2 text-xs font-medium leading-5 text-white/64">{detail}</p>
                  {caveat && (
                    <p className="mt-2 text-[10px] italic leading-relaxed text-white/38">{caveat}</p>
                  )}
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
