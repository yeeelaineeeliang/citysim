"use client"

import { useMemo } from "react"
import type { ActSeason } from "@/app/sim/types"
import { usePrefersReducedMotion } from "@/app/sim/hooks/usePrefersReducedMotion"

interface Particle {
  left: number
  delay: number
  duration: number
  size: number
  drift: number
  spin: number
  opacity: number
}

// Deterministic pseudo-random so re-renders never reshuffle particles mid-fall.
function makeParticles(count: number, seed: number): Particle[] {
  let s = seed
  const rand = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  return Array.from({ length: count }, () => ({
    left: rand() * 100,
    delay: rand() * 14,
    duration: 7 + rand() * 9,
    size: 0.5 + rand(),
    drift: (rand() - 0.5) * 140,
    spin: 180 + rand() * 540,
    opacity: 0.3 + rand() * 0.5,
  }))
}

const LEAF_COLORS = ["#c8642d", "#a94e1f", "#d98f3c", "#8f3f1a"]
const PETAL_COLORS = ["#f6d7e0", "#fdeef2", "#e8c3d4"]

/**
 * Ambient weather layer for the cinematic 4-act mode. Pure CSS animation —
 * keyframes live in globals.css (sim-fall, sim-glow). Pointer-transparent.
 */
export function SeasonalAtmosphere({ season }: { readonly season: ActSeason }) {
  const reducedMotion = usePrefersReducedMotion()
  const particles = useMemo(() => {
    if (season === "winter") return makeParticles(36, 7)
    if (season === "autumn") return makeParticles(16, 13)
    if (season === "spring") return makeParticles(10, 29)
    return []
  }, [season])

  if (season === "summer") {
    return (
      <div className="pointer-events-none absolute inset-0 z-[1050]" aria-hidden="true">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 75% 8%, rgba(255,225,150,0.30), transparent 65%)",
            ...(reducedMotion ? {} : { animation: "sim-glow 9s ease-in-out infinite" }),
          }}
        />
      </div>
    )
  }

  // Reduced motion: skip falling particles entirely — the tint layer still
  // conveys the season without movement.
  if (reducedMotion) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-[1050] overflow-hidden" aria-hidden="true">
      {particles.map((p, i) => {
        const style: React.CSSProperties = {
          position: "absolute",
          top: 0,
          left: `${p.left}%`,
          opacity: p.opacity,
          animation: `sim-fall ${p.duration}s linear ${-p.delay}s infinite`,
          ["--sim-drift" as string]: `${p.drift}px`,
          ["--sim-spin" as string]: season === "autumn" ? `${p.spin}deg` : "0deg",
        }
        if (season === "winter") {
          return (
            <span
              key={i}
              style={{
                ...style,
                width: `${3 + p.size * 3}px`,
                height: `${3 + p.size * 3}px`,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.9)",
                filter: "blur(0.5px)",
              }}
            />
          )
        }
        if (season === "autumn") {
          return (
            <span
              key={i}
              style={{
                ...style,
                width: `${7 + p.size * 6}px`,
                height: `${5 + p.size * 4}px`,
                borderRadius: "70% 10% 70% 10%",
                background: LEAF_COLORS[i % LEAF_COLORS.length],
              }}
            />
          )
        }
        // spring — drifting petals
        return (
          <span
            key={i}
            style={{
              ...style,
              width: `${5 + p.size * 4}px`,
              height: `${4 + p.size * 3}px`,
              borderRadius: "60% 40% 60% 40%",
              background: PETAL_COLORS[i % PETAL_COLORS.length],
            }}
          />
        )
      })}
    </div>
  )
}
