import dotenv from "dotenv";
import { cacheStreetViewImagesForAllCommunityAreas } from "../lib/streetView";

dotenv.config({ path: ".env.local" });
dotenv.config();

async function main() {
  const result = await cacheStreetViewImagesForAllCommunityAreas();
  console.log(`Community areas in boundaries CSV: ${result.communityAreasInCsv}`);
  console.log(`Already cached: ${result.cachedBefore}`);
  console.log(`Newly cached: ${result.cachedNow}`);
  console.log(`Centroids updated: ${result.updatedCentroids}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
