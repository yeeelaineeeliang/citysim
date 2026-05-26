"use client";

import { getSeasonalStreetStyle } from "@/lib/seasonalStreet";

interface SeasonalStreetOverlayProps {
  readonly month: number;
  readonly monthName: string;
  readonly neighborhood: string;
}

export function SeasonalStreetOverlay({ month }: SeasonalStreetOverlayProps) {
  const seasonal = getSeasonalStreetStyle(month);

  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="pointer-events-none absolute inset-0 z-10 transition-[background-color] duration-[600ms] ease-in-out"
        style={{ backgroundColor: seasonal.wash }}
      />
    </div>
  );
}
