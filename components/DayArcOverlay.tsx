"use client"

interface Props {
  progress: number // 0–1 representing 6 AM → 11 PM
}

function progressToColor(p: number): string {
  if (p <= 0.10) return 'rgba(255, 165, 40, 0.38)'   // dawn
  if (p <= 0.40) return 'rgba(220, 240, 255, 0.05)'  // morning — nearly clear
  if (p <= 0.60) return 'rgba(255, 245, 200, 0.12)'  // afternoon — warm bright
  if (p <= 0.78) return 'rgba(240, 100, 50, 0.35)'   // dusk — amber/red
  return 'rgba(8, 15, 50, 0.62)'                      // night — deep navy
}

function progressToTimeLabel(p: number): string {
  const totalMinutes = Math.floor(p * 17 * 60) // 0 → 1020 minutes (6am → 11pm)
  const hour24 = 6 + Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  const hour12 = hour24 > 12 ? hour24 - 12 : hour24 === 0 ? 12 : hour24
  const ampm = hour24 >= 12 ? 'PM' : 'AM'
  return `Tuesday  ${hour12}:${String(minute).padStart(2, '0')} ${ampm}`
}

export function DayArcOverlay({ progress }: Props) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[50]"
      style={{
        backgroundColor: progressToColor(progress),
        transition: 'background-color 2000ms ease-in-out',
      }}
    >
      <p
        className="absolute left-4 top-4 text-xs font-medium text-white/70 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {progressToTimeLabel(progress)}
      </p>
    </div>
  )
}
