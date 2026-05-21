"use client"

import { useEffect, useMemo } from "react"
import { getSeasonalStreetStyle } from "@/lib/seasonalStreet"
import type { WeatherType } from "@/lib/seasonalStreet"

const KEYFRAME_CSS = `
@keyframes fall-snow {
  0%   { transform: translateY(-10px) translateX(0px); opacity: 0; }
  5%   { opacity: 1; }
  95%  { opacity: 0.7; }
  100% { transform: translateY(105vh) translateX(25px); opacity: 0; }
}
@keyframes fall-rain {
  0%   { transform: translateY(-20px) translateX(0); opacity: 0; }
  5%   { opacity: 0.75; }
  100% { transform: translateY(105vh) translateX(-50px); opacity: 0; }
}
@keyframes fall-sleet {
  0%   { transform: translateY(-15px) translateX(0); opacity: 0; }
  5%   { opacity: 0.55; }
  100% { transform: translateY(105vh) translateX(-30px); opacity: 0; }
}
@keyframes heat-shimmer {
  0%   { opacity: 0; transform: scaleY(1); }
  50%  { opacity: 1; transform: scaleY(1.015); }
  100% { opacity: 0; transform: scaleY(1); }
}
`

const PARTICLE_COUNTS: Record<WeatherType, number> = {
  'snow-heavy': 70,
  'snow-light': 45,
  'rain': 55,
  'sleet': 50,
  'clear': 0,
  'hazy': 0,
}

interface Particle {
  id: number
  left: number
  delay: number
  duration: number
  width: number
  height: number
}

function buildParticles(count: number, month: number): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const n = (i + 1) * (month + 7)
    return {
      id: i,
      left: (n * 37 + 13) % 100,
      delay: ((n * 17) % 50) / 10,
      duration: 3 + ((n * 7) % 30) / 10,
      width: 2 + (i % 3),
      height: 2 + (i % 3),
    }
  })
}

export function WeatherLayer({ month }: { month: number }) {
  const { weather } = getSeasonalStreetStyle(month)

  useEffect(() => {
    if (document.getElementById('__weather-keyframes')) return
    const el = document.createElement('style')
    el.id = '__weather-keyframes'
    el.textContent = KEYFRAME_CSS
    document.head.appendChild(el)
  }, [])

  const count = PARTICLE_COUNTS[weather]
  const particles = useMemo(() => buildParticles(count, month), [count, month])

  if (weather === 'clear') return null

  const isSnow = weather === 'snow-heavy' || weather === 'snow-light'
  const isRain = weather === 'rain'

  return (
    <div className="pointer-events-none absolute inset-0 z-[150] overflow-hidden">
      {weather === 'hazy' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to bottom, rgba(255,200,100,0.07) 0%, rgba(255,175,55,0.11) 50%, rgba(255,155,35,0.05) 100%)',
            animation: 'heat-shimmer 4.5s ease-in-out infinite',
          }}
        />
      )}
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: 0,
            width: isRain ? 1 : weather === 'sleet' ? 1.5 : p.width,
            height: isRain ? 14 : weather === 'sleet' ? 10 : p.height,
            borderRadius: isRain || weather === 'sleet' ? 1 : '50%',
            backgroundColor: isRain
              ? `rgba(180, 205, 235, 0.7)`
              : weather === 'sleet'
                ? `rgba(205, 215, 225, 0.6)`
                : `rgba(240, 250, 255, 0.8)`,
            animation: `${isRain ? 'fall-rain' : weather === 'sleet' ? 'fall-sleet' : 'fall-snow'} ${p.duration}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  )
}
