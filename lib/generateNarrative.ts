import type { StructuredSimulationData } from "@/lib/querySimulationData";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function formatSignedPercent(percent: number) {
  if (percent > 0) {
    return `up ${percent}%`;
  }

  if (percent < 0) {
    return `down ${Math.abs(percent)}%`;
  }

  return "flat week over week";
}

export async function generateNarrative(structuredData: StructuredSimulationData) {
  const { highlightedRoute, peakRidershipDay, totalRidesAcrossRoutes, weekOverWeekDelta } = structuredData;

  return [
    `Across Hyde Park's bus routes, October 2024 logged ${totalRidesAcrossRoutes.toLocaleString()} rides in total.`,
    `For a UChicago student commuter, the busiest line in this slice was the #${highlightedRoute.route}, with ${highlightedRoute.totalRides.toLocaleString()} rides across the month and an average of ${highlightedRoute.averageDailyRides.toLocaleString()} riders per service day.`,
    `That route peaked at ${highlightedRoute.peakRides.toLocaleString()} rides on ${formatDate(highlightedRoute.peakDate)}, while the overall route set hit its highest single-day volume on ${formatDate(peakRidershipDay.date)} at ${peakRidershipDay.totalRides.toLocaleString()} rides.`,
    `From ${weekOverWeekDelta.previousWindow} to ${weekOverWeekDelta.currentWindow}, ridership was ${formatSignedPercent(weekOverWeekDelta.percentChange)}, a change of ${weekOverWeekDelta.absoluteChange.toLocaleString()} rides.`,
  ].join(" ");
}

