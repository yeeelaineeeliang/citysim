export function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let result = 0
    let shift = 0
    let b: number
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1

    result = 0
    shift = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lng += result & 1 ? ~(result >> 1) : result >> 1

    coords.push([lat / 1e5, lng / 1e5])
  }

  return coords
}

export function thinPolyline(coords: [number, number][], maxPoints = 25): [number, number][] {
  if (coords.length <= maxPoints) return coords
  const step = (coords.length - 1) / (maxPoints - 1)
  return Array.from({ length: maxPoints }, (_, i) => coords[Math.round(i * step)])
}

export function straightLineCoords(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  steps = 25,
): [number, number][] {
  if (steps < 2) return [[from.lat, from.lng], [to.lat, to.lng]]
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1)
    return [from.lat + (to.lat - from.lat) * t, from.lng + (to.lng - from.lng) * t] as [number, number]
  })
}
