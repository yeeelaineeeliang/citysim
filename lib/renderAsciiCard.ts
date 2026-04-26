import type { StructuredSimulationData } from "@/lib/querySimulationData";

function buildCrowdingMeter(averageDailyRides: number) {
  const filledSlots = Math.max(1, Math.min(5, Math.ceil(averageDailyRides / 1800)));
  return `${"#".repeat(filledSlots)}${".".repeat(5 - filledSlots)}`;
}

export function renderAsciiCard(structuredData: StructuredSimulationData) {
  const routeLabel = structuredData.highlightedRoute.route.padEnd(3, " ");
  const meter = buildCrowdingMeter(structuredData.highlightedRoute.averageDailyRides);

  return String.raw`+----------------------+
| CTA STOP :: ROUTE ${routeLabel}|
| crowding  [${meter}]    |
|        __              |
|   ____|__|____         |
|  | _ CTA BUS _ |       |
|==||_|_|_|_|_||==      |
|    O        O          |
|        ||              |
|      __||__            |
|     /______\           |
+----------------------+`;
}

