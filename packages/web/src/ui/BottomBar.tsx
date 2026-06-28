type ActivePage = 'my-scores' | 'my-hunts' | 'history' | 'join';

/** Persistent bottom navigation strip for the home screen. */
export function BottomBar({
  onCreate,
  onJoin,
  onMyHunts,
  onMyScores,
  onMyHistory,
  creating = false,
  activePage,
}: {
  onCreate: () => void;
  onJoin: () => void;
  onMyHunts: () => void;
  onMyScores: () => void;
  onMyHistory: () => void;
  creating?: boolean;
  activePage?: ActivePage;
}) {
  return (
    <nav className="bottombar" aria-label="Main navigation">
      <button
        type="button"
        className={`bottombar__btn${activePage === 'my-scores' ? ' bottombar__btn--active' : ''}`}
        onClick={onMyScores}
        aria-label="My scores"
        aria-current={activePage === 'my-scores' ? 'page' : undefined}
      >
        <img src="/icon-trophy.png" alt="" aria-hidden="true" />
      </button>

      <button
        type="button"
        className={`bottombar__btn${activePage === 'my-hunts' ? ' bottombar__btn--active' : ''}`}
        onClick={onMyHunts}
        aria-label="My hunts"
        aria-current={activePage === 'my-hunts' ? 'page' : undefined}
      >
        <img src="/icon-my-hunts.png" alt="" aria-hidden="true" />
      </button>

      <button
        type="button"
        className="bottombar__fab"
        onClick={onCreate}
        disabled={creating}
        aria-label={creating ? 'Creating hunt…' : 'Create new hunt'}
      >
        <img src="/icon-create-hunt.png" alt="" aria-hidden="true" />
      </button>

      <button
        type="button"
        className={`bottombar__btn${activePage === 'history' ? ' bottombar__btn--active' : ''}`}
        onClick={onMyHistory}
        aria-label="My history"
        aria-current={activePage === 'history' ? 'page' : undefined}
      >
        <img src="/icon-clock.png" alt="" aria-hidden="true" />
      </button>

      <button
        type="button"
        className={`bottombar__btn${activePage === 'join' ? ' bottombar__btn--active' : ''}`}
        onClick={onJoin}
        aria-label="Join a hunt"
        aria-current={activePage === 'join' ? 'page' : undefined}
      >
        <img src="/icon-join-hunt.png" alt="" aria-hidden="true" />
      </button>
    </nav>
  );
}
