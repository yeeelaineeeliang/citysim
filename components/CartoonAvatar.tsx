import type { ActSeason } from "@/app/sim/types";

export type AvatarState = "walking" | "at_work" | "at_evening" | "at_home";

interface CartoonAvatarProps {
  season: ActSeason;
  state: AvatarState;
  size?: number;
}

const SEASON_BODY_COLOR: Record<ActSeason, string> = {
  spring: "#6B9FD4",
  summer: "#F4A226",
  autumn: "#5D4E75",
  winter: "#2E3A4E",
};

// Eyebrow paths per season (left brow, right brow as SVG d attrs)
const BROWS: Record<ActSeason, { left: string; right: string }> = {
  spring: { left: "M 34 38 Q 40 35 46 38", right: "M 54 38 Q 60 35 66 38" },
  summer: { left: "M 34 37 Q 40 35 46 38", right: "M 54 38 Q 60 35 66 37" },
  autumn: { left: "M 34 39 Q 40 37 46 40", right: "M 54 40 Q 60 37 66 39" },
  // worried: inner corners raised
  winter: { left: "M 34 40 Q 40 36 46 39", right: "M 54 39 Q 60 36 66 40" },
};

// Mouth paths per season
const MOUTHS: Record<ActSeason, string> = {
  spring: "M 42 58 Q 50 64 58 58",       // neutral smile
  summer: "M 41 57 Q 50 65 59 57",       // bigger smile
  autumn: "M 42 60 Q 50 63 58 60",       // slight flat
  winter: "M 42 61 Q 50 59 58 61",       // slight frown
};

// Arm transforms per state (applied to a standard arm group)
const ARM_TRANSFORM: Record<AvatarState, { left: string; right: string }> = {
  at_home:    { left: "rotate(10, 36, 75)",  right: "rotate(-10, 64, 75)" },
  walking:    { left: "rotate(25, 36, 75)",  right: "rotate(-25, 64, 75)" },
  at_work:    { left: "rotate(0, 36, 75)",   right: "rotate(0, 64, 75)" },
  at_evening: { left: "rotate(-15, 36, 75)", right: "rotate(15, 64, 75)" },
};

export function CartoonAvatar({ season, state, size = 64 }: CartoonAvatarProps) {
  const bodyColor = SEASON_BODY_COLOR[season];
  const brows = BROWS[season];
  const mouth = MOUTHS[season];
  const arms = ARM_TRANSFORM[state];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 120"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Body */}
      <rect x="30" y="68" width="40" height="38" rx="8" ry="8" fill={bodyColor} />

      {/* Season-specific outfit details */}
      {season === "spring" && (
        <g>
          {/* Jacket collar */}
          <path d="M 42 68 L 50 76 L 58 68" fill="none" stroke="#fff" strokeWidth="2" />
          {/* Bag strap */}
          <path d="M 70 78 Q 74 82 70 90" fill="none" stroke="#D4A96A" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}
      {season === "summer" && (
        <g>
          {/* Sunglasses */}
          <rect x="33" y="44" width="13" height="8" rx="3" fill="#333" opacity="0.85" />
          <rect x="54" y="44" width="13" height="8" rx="3" fill="#333" opacity="0.85" />
          <line x1="46" y1="48" x2="54" y2="48" stroke="#333" strokeWidth="1.5" />
        </g>
      )}
      {season === "autumn" && (
        <g>
          {/* Scarf */}
          <path d="M 32 70 Q 50 75 68 70" fill="none" stroke="#C17A3A" strokeWidth="4" strokeLinecap="round" />
        </g>
      )}
      {season === "winter" && (
        <g>
          {/* Hat brim */}
          <rect x="28" y="26" width="44" height="6" rx="3" fill="#1A2433" />
          {/* Hat top */}
          <rect x="33" y="10" width="34" height="18" rx="4" fill="#1A2433" />
        </g>
      )}

      {/* Arms */}
      <g transform={arms.left}>
        <rect x="22" y="70" width="10" height="26" rx="5" fill={bodyColor} />
      </g>
      <g transform={arms.right}>
        <rect x="68" y="70" width="10" height="26" rx="5" fill={bodyColor} />
      </g>

      {/* Head */}
      <circle cx="50" cy="38" r="22" fill="#F5CBA7" />

      {/* Eyes */}
      <circle cx="43" cy="43" r="3" fill="#2C3E50" />
      <circle cx="57" cy="43" r="3" fill="#2C3E50" />
      <circle cx="44" cy="42" r="1" fill="#fff" />
      <circle cx="58" cy="42" r="1" fill="#fff" />

      {/* Eyebrows */}
      <path d={brows.left} fill="none" stroke="#5D4037" strokeWidth="2.5" strokeLinecap="round" />
      <path d={brows.right} fill="none" stroke="#5D4037" strokeWidth="2.5" strokeLinecap="round" />

      {/* Mouth */}
      <path d={mouth} fill="none" stroke="#C0696B" strokeWidth="2.5" strokeLinecap="round" />

      {/* Legs */}
      <rect x="34" y="104" width="12" height="16" rx="4" fill="#3D4E6A" />
      <rect x="54" y="104" width="12" height="16" rx="4" fill="#3D4E6A" />
    </svg>
  );
}
