type Mood = "best" | "good" | "neutral" | "tense" | "stress";
type Season = "winter" | "spring" | "summer" | "fall";

interface SkyboxProps {
  month: number;
  crimeSignal: 2 | 0 | -2 | null;
  serviceSignal: 1 | -1 | null;
  transitSignal: 1 | 0 | -1;
  fullBleed?: boolean;
}

const GRADIENTS: Record<Mood, string> = {
  best: "linear-gradient(180deg, #2d7dd2 0%, #4a9ae0 40%, #78bcf0 80%, #a8d8f8 100%)",
  good: "linear-gradient(180deg, #e8935a 0%, #f0b070 40%, #f5cc85 80%, #f8dda0 100%)",
  neutral: "linear-gradient(180deg, #6a8faf 0%, #8fb0cc 50%, #b8d0e0 100%)",
  tense: "linear-gradient(180deg, #3d5a7a 0%, #6b7f9a 50%, #8a9aaa 100%)",
  stress: "linear-gradient(180deg, #1a2744 0%, #2d3f6b 40%, #4a5a8a 100%)",
};

const SEASONAL_OVERLAYS: Record<Season, string> = {
  winter: "rgba(200, 230, 248, 0.15)",
  spring: "rgba(168, 216, 160, 0.12)",
  summer: "rgba(245, 208, 112, 0.15)",
  fall: "rgba(200, 120, 64, 0.18)",
};

const STARS = [
  { top: "20%", left: "15%", size: 2, opacity: 0.9 },
  { top: "35%", left: "42%", size: 1, opacity: 0.7 },
  { top: "15%", left: "68%", size: 2, opacity: 0.8 },
  { top: "50%", left: "78%", size: 1, opacity: 0.5 },
  { top: "25%", left: "28%", size: 1, opacity: 0.6 },
  { top: "60%", left: "55%", size: 2, opacity: 0.7 },
  { top: "10%", left: "88%", size: 1, opacity: 0.9 },
  { top: "45%", left: "12%", size: 1, opacity: 0.5 },
];

function computeMood(
  c: SkyboxProps["crimeSignal"],
  s: SkyboxProps["serviceSignal"],
  t: SkyboxProps["transitSignal"],
): Mood {
  if (c === null && s === null) {
    if (t >= 1) return "good";
    if (t >= -1) return "neutral";
    return "tense";
  }
  const score = (c ?? 0) + (s ?? 0) + t;
  if (score >= 3) return "best";
  if (score >= 1) return "good";
  if (score >= -1) return "neutral";
  if (score >= -3) return "tense";
  return "stress";
}

function getSeason(month: number): Season {
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "spring";
  if (month <= 8) return "summer";
  return "fall";
}

function SkyElements({ mood }: { mood: Mood }) {
  if (mood === "best") {
    return (
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 20,
          width: 40,
          height: 40,
          borderRadius: "50%",
          backgroundColor: "rgba(255,240,160,0.9)",
          boxShadow:
            "0 0 20px 8px rgba(255,240,160,0.4), 0 0 40px 16px rgba(255,240,160,0.2)",
        }}
      />
    );
  }

  if (mood === "good") {
    return (
      <>
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 20,
            width: 36,
            height: 36,
            borderRadius: "50%",
            backgroundColor: "rgba(255,200,80,0.85)",
          }}
        />
        <div
          className="sky-cloud"
          style={{
            position: "absolute",
            top: 35,
            right: 60,
            width: 80,
            height: 20,
            borderRadius: 50,
            backgroundColor: "rgba(250,220,170,0.6)",
          }}
        />
        <div
          className="sky-cloud"
          style={{
            position: "absolute",
            top: 55,
            right: 30,
            width: 60,
            height: 16,
            borderRadius: 50,
            backgroundColor: "rgba(250,220,170,0.6)",
          }}
        />
      </>
    );
  }

  if (mood === "neutral") {
    return (
      <>
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 16,
            width: 28,
            height: 28,
            borderRadius: "50%",
            backgroundColor: "rgba(255,220,150,0.5)",
          }}
        />
        <div
          className="sky-cloud"
          style={{
            position: "absolute",
            top: 38,
            left: "30%",
            width: 90,
            height: 22,
            borderRadius: 50,
            backgroundColor: "rgba(200,215,228,0.75)",
          }}
        />
        <div
          className="sky-cloud"
          style={{
            position: "absolute",
            top: 62,
            left: "50%",
            width: 70,
            height: 18,
            borderRadius: 50,
            backgroundColor: "rgba(200,215,228,0.75)",
          }}
        />
      </>
    );
  }

  if (mood === "tense") {
    return (
      <>
        <div
          style={{
            position: "absolute",
            top: 20,
            left: "8%",
            width: 110,
            height: 26,
            borderRadius: 50,
            backgroundColor: "rgba(100,115,130,0.7)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 50,
            left: "35%",
            width: 90,
            height: 22,
            borderRadius: 50,
            backgroundColor: "rgba(100,115,130,0.7)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 30,
            right: "10%",
            width: 80,
            height: 20,
            borderRadius: 50,
            backgroundColor: "rgba(100,115,130,0.7)",
          }}
        />
      </>
    );
  }

  // stress — stars, no sun
  return (
    <>
      {STARS.map((star, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
            borderRadius: "50%",
            backgroundColor: "white",
            opacity: star.opacity,
          }}
        />
      ))}
    </>
  );
}

export function Skybox({ month, crimeSignal, serviceSignal, transitSignal, fullBleed = false }: SkyboxProps) {
  const mood = computeMood(crimeSignal, serviceSignal, transitSignal);
  const season = getSeason(month);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: fullBleed ? "100%" : 140,
        background: GRADIENTS[mood],
        borderRadius: fullBleed ? 0 : "16px 16px 0 0",
        overflow: "hidden",
      }}
    >
      <SkyElements mood={mood} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: SEASONAL_OVERLAYS[season],
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
