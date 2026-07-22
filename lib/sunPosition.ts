import SunCalc from "suncalc"

export function sunLight(timeProgress: number, month: number, lat: number, lng: number) {
  const hour = 6 + timeProgress * 18
  const date = new Date(2024, month - 1, 15, Math.floor(hour), Math.round((hour % 1) * 60))
  const { azimuth, altitude } = SunCalc.getPosition(date, lat, lng)
  // suncalc: azimuth 0=south +west −east; Mapbox: 0=north clockwise degrees
  const azimuthDeg = ((azimuth * 180 / Math.PI) + 180) % 360
  // suncalc: altitude 0=horizon π/2=overhead; Mapbox polar: 0=overhead 90=horizon
  const polarDeg = Math.max(0, 90 - altitude * 180 / Math.PI)
  return {
    altitude,
    azimuthDeg,
    light: {
      anchor: "map" as const,
      color: altitude > 0.3 ? "#ffffff" : altitude > 0.05 ? "#ffcc88" : altitude > 0 ? "#ff8844" : "#2a3a50",
      intensity: altitude > 0 ? Math.min(0.6, altitude * 1.2) : 0.05,
      position: [1.5, azimuthDeg, polarDeg] as [number, number, number],
    },
  }
}

export function compassLabel(azimuthDeg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
  return dirs[Math.round(azimuthDeg / 45) % 8]
}

export function timeLabel(tp: number): string {
  const h = Math.floor(6 + tp * 18)
  const ampm = h < 12 ? "AM" : "PM"
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display} ${ampm}`
}
