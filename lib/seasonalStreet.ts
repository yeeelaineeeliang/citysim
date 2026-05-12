const SEASONAL_WASHES = [
  "rgba(140, 170, 210, 0.40)",
  "rgba(100, 130, 180, 0.35)",
  "rgba(160, 200, 160, 0.25)",
  "rgba(140, 195, 140, 0.20)",
  "rgba(190, 220, 130, 0.18)",
  "rgba(255, 215, 90, 0.20)",
  "rgba(255, 190, 60, 0.25)",
  "rgba(240, 175, 70, 0.22)",
  "rgba(210, 155, 80, 0.25)",
  "rgba(190, 110, 45, 0.32)",
  "rgba(120, 110, 100, 0.35)",
  "rgba(160, 190, 230, 0.38)",
] as const;

const SEASON_DESCRIPTORS = [
  "Deep winter",
  "Deep winter",
  "Late winter",
  "Early spring",
  "Late spring",
  "Early summer",
  "Midsummer",
  "Midsummer",
  "Early fall",
  "Peak fall",
  "Late fall",
  "Deep winter",
] as const;

export interface SeasonalStreetStyle {
  wash: string;
  descriptor: string;
}

export function getSeasonalStreetStyle(month: number): SeasonalStreetStyle {
  const index = Number.isInteger(month) && month >= 1 && month <= 12 ? month - 1 : 0;

  return {
    wash: SEASONAL_WASHES[index],
    descriptor: SEASON_DESCRIPTORS[index],
  };
}
