"use client"

interface SeasonTransitionCardProps {
  month: number
  neighborhood: string
  visible: boolean
}

const SEASON_CONFIG: Record<number, {
  label: string
  season: string
  mood: string
  bg: string
  border: string
  textAccent: string
}> = {
  1: {
    label: 'January',
    season: 'Winter',
    mood: '28°F · Layer up — it\'s real Chicago winter',
    bg: 'rgba(12, 22, 44, 0.88)',
    border: 'rgba(120, 160, 210, 0.35)',
    textAccent: '#90b8e8',
  },
  4: {
    label: 'April',
    season: 'Spring',
    mood: '55°F · The city waking up',
    bg: 'rgba(18, 36, 22, 0.88)',
    border: 'rgba(100, 180, 110, 0.35)',
    textAccent: '#7ec98a',
  },
  7: {
    label: 'July',
    season: 'Summer',
    mood: '84°F · Summer in full swing',
    bg: 'rgba(38, 26, 8, 0.88)',
    border: 'rgba(220, 160, 60, 0.35)',
    textAccent: '#f0b840',
  },
  10: {
    label: 'October',
    season: 'Fall',
    mood: '52°F · Peak Chicago fall',
    bg: 'rgba(32, 18, 10, 0.88)',
    border: 'rgba(200, 110, 50, 0.35)',
    textAccent: '#e07840',
  },
}

export function SeasonTransitionCard({ month, neighborhood, visible }: SeasonTransitionCardProps) {
  const config = SEASON_CONFIG[month]
  if (!config) return null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        style={{
          background: config.bg,
          border: `1px solid ${config.border}`,
          borderRadius: 16,
          padding: '32px 40px',
          width: 380,
          maxWidth: 'calc(100vw - 48px)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 48px rgba(0,0,0,0.6)',
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(64px) scale(0.97)',
          opacity: visible ? 1 : 0,
          transition: visible
            ? 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease'
            : 'transform 0.3s cubic-bezier(0.55, 0, 0.45, 1), opacity 0.25s ease',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: config.textAccent,
            marginBottom: 12,
          }}
        >
          {config.season}
        </p>
        <p
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.1,
            letterSpacing: '-0.01em',
            marginBottom: 4,
          }}
        >
          {config.label}
        </p>
        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.55)',
            marginBottom: 16,
          }}
        >
          {neighborhood}
        </p>
        <p
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: '0.04em',
          }}
        >
          {config.mood}
        </p>
      </div>
    </div>
  )
}
