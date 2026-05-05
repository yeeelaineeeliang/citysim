import * as fs from "node:fs";
import * as path from "node:path";

export type CommunityAreaCentroid = {
  communityAreaNumber: number;
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
};

const BOUNDARIES_CSV = path.join(process.cwd(), "CityData", "Boundaries_-_Community_Areas_20260502.csv");

let cachedCentroids: CommunityAreaCentroid[] | null = null;

export function slugifyCommunityAreaName(name: string) {
  return name
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function computeCoordinateAverage(wkt: string) {
  const matches = wkt.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g);
  let longitudeTotal = 0;
  let latitudeTotal = 0;
  let count = 0;

  for (const match of matches) {
    const longitude = Number(match[1]);
    const latitude = Number(match[2]);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;

    longitudeTotal += longitude;
    latitudeTotal += latitude;
    count += 1;
  }

  if (count === 0) return null;

  return {
    latitude: Number((latitudeTotal / count).toFixed(6)),
    longitude: Number((longitudeTotal / count).toFixed(6)),
  };
}

export function getCommunityAreaCentroids() {
  if (cachedCentroids) return cachedCentroids;

  const csv = fs.readFileSync(BOUNDARIES_CSV, "utf-8");
  const [, ...rows] = csv.split(/\r?\n/).filter(Boolean);

  cachedCentroids = rows.flatMap((row) => {
    const [wkt, areaNumber, name] = parseCsvLine(row);
    const communityAreaNumber = Number(areaNumber);
    const centroid = computeCoordinateAverage(wkt);

    if (!Number.isInteger(communityAreaNumber) || !name || !centroid) return [];

    return [
      {
        communityAreaNumber,
        name,
        slug: slugifyCommunityAreaName(name),
        latitude: centroid.latitude,
        longitude: centroid.longitude,
      },
    ];
  });

  return cachedCentroids;
}

export function getCommunityAreaCentroidBySlug(slug: string) {
  return getCommunityAreaCentroids().find((area) => area.slug === slug) ?? null;
}
