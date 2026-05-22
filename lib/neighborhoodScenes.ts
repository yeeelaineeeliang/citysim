interface SceneCoords { lat: number; lng: number }
interface NeighborhoodScenes {
  residential: SceneCoords
  commercial:  SceneCoords
  park:        SceneCoords
}

const SCENES: Record<string, NeighborhoodScenes> = {
  "McKinley Park":  { residential: { lat: 41.8272, lng: -87.6820 }, commercial: { lat: 41.8288, lng: -87.6971 }, park: { lat: 41.8303, lng: -87.6968 } },
  "Hyde Park":      { residential: { lat: 41.7945, lng: -87.5956 }, commercial: { lat: 41.7998, lng: -87.5878 }, park: { lat: 41.7931, lng: -87.5833 } },
  "Logan Square":   { residential: { lat: 41.9225, lng: -87.7015 }, commercial: { lat: 41.9219, lng: -87.7038 }, park: { lat: 41.9232, lng: -87.7060 } },
  "Lincoln Park":   { residential: { lat: 41.9205, lng: -87.6360 }, commercial: { lat: 41.9265, lng: -87.6345 }, park: { lat: 41.9225, lng: -87.6351 } },
  "Lake View":      { residential: { lat: 41.9396, lng: -87.6533 }, commercial: { lat: 41.9440, lng: -87.6550 }, park: { lat: 41.9380, lng: -87.6490 } },
  "Wicker Park":    { residential: { lat: 41.9085, lng: -87.6772 }, commercial: { lat: 41.9095, lng: -87.6780 }, park: { lat: 41.9110, lng: -87.6760 } },
  "Pilsen":         { residential: { lat: 41.8553, lng: -87.6700 }, commercial: { lat: 41.8570, lng: -87.6650 }, park: { lat: 41.8600, lng: -87.6550 } },
  "Bronzeville":    { residential: { lat: 41.8304, lng: -87.6150 }, commercial: { lat: 41.8320, lng: -87.6140 }, park: { lat: 41.8290, lng: -87.6100 } },
  "Woodlawn":       { residential: { lat: 41.7734, lng: -87.6051 }, commercial: { lat: 41.7750, lng: -87.6040 }, park: { lat: 41.7720, lng: -87.5980 } },
  "South Shore":    { residential: { lat: 41.7620, lng: -87.5757 }, commercial: { lat: 41.7640, lng: -87.5770 }, park: { lat: 41.7600, lng: -87.5720 } },
  "Uptown":         { residential: { lat: 41.9664, lng: -87.6544 }, commercial: { lat: 41.9680, lng: -87.6550 }, park: { lat: 41.9650, lng: -87.6510 } },
  "Oakland":        { residential: { lat: 41.8214, lng: -87.6099 }, commercial: { lat: 41.8230, lng: -87.6090 }, park: { lat: 41.8200, lng: -87.6050 } },
}

export function getScenesForNeighborhood(name: string, centerLat?: number, centerLng?: number): NeighborhoodScenes {
  const curated = SCENES[name]
  if (curated) return curated

  // Fallback: offset center coord toward typical residential/commercial/park patterns
  const lat = centerLat ?? 41.85
  const lng = centerLng ?? -87.65
  return {
    residential: { lat: lat - 0.003, lng },
    commercial:  { lat, lng: lng + 0.002 },
    park:        { lat: lat - 0.005, lng: lng - 0.003 },
  }
}
