import { unstable_cache } from "next/cache";
import { queryMonthlyTransit, type MonthlyTransitData } from "@/lib/queryMonthlyTransit";
import { queryMonthly311, type Monthly311Data } from "@/lib/queryMonthly311";
import { queryMonthlyCrime, type MonthlyCrimeData } from "@/lib/queryMonthlyCrime";

export type MonthData = {
  monthNumber: number;
  monthLabel: string;
  transit: MonthlyTransitData;
  services311: Monthly311Data | null;
  crime: MonthlyCrimeData | null;
  narrative?: string;
};

const MONTH_LABELS = [
  "January 2024",
  "February 2024",
  "March 2024",
  "April 2024",
  "May 2024",
  "June 2024",
  "July 2024",
  "August 2024",
  "September 2024",
  "October 2024",
  "November 2024",
  "December 2024",
];

async function fetchAllMonths(): Promise<MonthData[]> {
  const [transit, services311, crime] = await Promise.all([
    queryMonthlyTransit(),
    queryMonthly311().catch(() => null as Monthly311Data[] | null),
    queryMonthlyCrime().catch(() => null as MonthlyCrimeData[] | null),
  ]);

  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return {
      monthNumber: m,
      monthLabel: MONTH_LABELS[i],
      transit: transit[i],
      services311: services311?.[i] ?? null,
      crime: crime?.[i] ?? null,
    };
  });
}

export const buildMonthlySimulation = unstable_cache(fetchAllMonths, ["v2-hyde-park-2024"], {
  revalidate: 86400,
});
