interface StarRatingProps {
  value: number;
  /** When provided, stars are tappable for input. */
  onChange?: (stars: number) => void;
  max?: number;
}

/** Read-only or interactive 1..max star rating. */
export function StarRating({ value, onChange, max = 5 }: StarRatingProps) {
  const stars = Array.from({ length: max }, (_, i) => i + 1);
  return (
    <div className="stars" role={onChange ? 'radiogroup' : 'img'} aria-label={`${value} of ${max} stars`}>
      {stars.map((n) =>
        onChange ? (
          <button
            key={n}
            className={n <= value ? 'star--on' : 'star--off'}
            onClick={() => onChange(n)}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
          >
            ⭐
          </button>
        ) : (
          <span key={n} className={n <= value ? 'star--on' : 'star--off'}>
            ⭐
          </span>
        ),
      )}
    </div>
  );
}
