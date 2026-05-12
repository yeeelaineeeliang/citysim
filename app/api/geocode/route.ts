import { NextRequest, NextResponse } from "next/server";

export interface GeocodeSuggestion {
  displayName: string;
  lat: number;
  lng: number;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    state?: string;
    country?: string;
    type?: string;
  };
}

interface PhotonResponse {
  features: PhotonFeature[];
}

function formatDisplayName(p: PhotonFeature["properties"]): string {
  const parts: string[] = [];
  if (p.name) parts.push(p.name);
  else if (p.street) parts.push(`${p.housenumber ?? ""} ${p.street}`.trim());
  if (p.city && p.city !== p.name) parts.push(p.city);
  if (p.state) parts.push(p.state);
  return parts.join(", ");
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ suggestions: [] });

  // Photon: OSM-based autocomplete, much better for POIs than plain Nominatim search
  // Location-biased toward Chicago (lat/lon) — still returns global results beyond the bbox
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "8");
  url.searchParams.set("lang", "en");
  // Bias toward Chicago so local POIs rank higher
  url.searchParams.set("lat", "41.8781");
  url.searchParams.set("lon", "-87.6298");

  const res = await fetch(url.toString(), {
    headers: { "Accept-Language": "en" },
    next: { revalidate: 3600 },
  });

  if (!res.ok) return NextResponse.json({ suggestions: [] });

  const data = (await res.json()) as PhotonResponse;
  const suggestions: GeocodeSuggestion[] = data.features
    .map((f) => ({
      displayName: formatDisplayName(f.properties),
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    }))
    .filter((s) => s.displayName.length > 0);

  return NextResponse.json({ suggestions });
}
