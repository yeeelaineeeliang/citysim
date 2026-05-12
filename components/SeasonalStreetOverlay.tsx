"use client";

import { getSeasonalStreetStyle } from "@/lib/seasonalStreet";

interface SeasonalStreetOverlayProps {
  readonly month: number;
  readonly monthName: string;
  readonly neighborhood: string;
}

export function SeasonalStreetOverlay({ month, monthName, neighborhood }: SeasonalStreetOverlayProps) {
  const seasonal = getSeasonalStreetStyle(month);

  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="pointer-events-none absolute inset-0 z-10 transition-[background-color] duration-[600ms] ease-in-out"
        style={{ backgroundColor: seasonal.wash }}
      />
      <p className="pointer-events-none absolute bottom-3 right-4 z-40 text-[10px] font-semibold uppercase leading-none tracking-[0.16em] text-white/75 [font-variant:small-caps] [text-shadow:0_1px_3px_rgba(0,0,0,0.4)]">
        {monthName} · {neighborhood} · {seasonal.descriptor}
      </p>
    </div>
  );
}
