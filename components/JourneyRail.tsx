const JOURNEY_STAGES = [
  { id: "profile", label: "Shape your life" },
  { id: "match", label: "Choose a place" },
  { id: "live", label: "Live the year" },
  { id: "decide", label: "Make the call" },
] as const;

export type JourneyStage = (typeof JOURNEY_STAGES)[number]["id"];

export function JourneyRail({
  current,
  inverse = false,
  compact = false,
  className = "",
}: {
  current: JourneyStage;
  inverse?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const currentIndex = JOURNEY_STAGES.findIndex((stage) => stage.id === current);

  return (
    <nav
      aria-label="Your LivingThere journey"
      className={`journey-rail ${inverse ? "journey-rail-inverse" : ""} ${compact ? "journey-rail-compact" : ""} ${className}`}
    >
      <ol>
        {JOURNEY_STAGES.map((stage, index) => {
          const state = index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming";
          return (
            <li key={stage.id} data-state={state} aria-current={state === "current" ? "step" : undefined}>
              <span className="journey-node" aria-hidden="true">
                {index + 1}
              </span>
              <span className="journey-label">{stage.label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
