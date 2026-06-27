/** Persistent bottom navigation strip for the home screen. */
export function BottomBar({
  onCreate,
  onJoin,
  onMyHunts,
  onMyScores,
  onMyHistory,
  creating = false,
}: {
  onCreate: () => void;
  onJoin: () => void;
  onMyHunts: () => void;
  onMyScores: () => void;
  onMyHistory: () => void;
  creating?: boolean;
}) {
  return (
    <nav className="bottombar" aria-label="Main navigation">
      <button
        type="button"
        className="bottombar__btn"
        onClick={onMyScores}
        aria-label="My scores"
      >
        <img src="/icon-trophy.png" alt="" aria-hidden="true" />
      </button>

      <button
        type="button"
        className="bottombar__btn"
        onClick={onMyHunts}
        aria-label="My hunts"
      >
        <img src="/icon-my-hunts.svg" alt="" aria-hidden="true" />
      </button>

      <button
        type="button"
        className="bottombar__fab"
        onClick={onCreate}
        disabled={creating}
        aria-label={creating ? 'Creating hunt…' : 'Create new hunt'}
      >
        <img src="/icon-create-hunt.svg" alt="" aria-hidden="true" />
      </button>

      <button
        type="button"
        className="bottombar__btn"
        onClick={onMyHistory}
        aria-label="My history"
      >
        <img src="/icon-clock.png" alt="" aria-hidden="true" />
      </button>

      <button
        type="button"
        className="bottombar__btn"
        onClick={onJoin}
        aria-label="Join a hunt"
      >
        <img src="/icon-ladder.png" alt="" aria-hidden="true" />
      </button>
    </nav>
  );
}
