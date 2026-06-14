interface ScorePillProps {
  score: number;
  max?: number;
}

/** A sunny pill that shows points earned. */
export function ScorePill({ score, max }: ScorePillProps) {
  return (
    <span className="score-pill">
      ⭐ {score}
      {max !== undefined && <span className="muted">/ {max}</span>}
    </span>
  );
}
