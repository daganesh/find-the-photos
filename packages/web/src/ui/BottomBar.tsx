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
        style={{ color: '#9b7ede' }}
      >
        <StarIcon />
      </button>

      <button
        type="button"
        className="bottombar__btn"
        onClick={onMyHunts}
        aria-label="My hunts"
        style={{ color: '#5bb6f0' }}
      >
        <CameraIcon />
      </button>

      <button
        type="button"
        className="bottombar__fab"
        onClick={onCreate}
        disabled={creating}
        aria-label={creating ? 'Creating hunt…' : 'Create new hunt'}
      >
        <PlusIcon />
      </button>

      <button
        type="button"
        className="bottombar__btn"
        onClick={onMyHistory}
        aria-label="My history"
        style={{ color: '#f78fb3' }}
      >
        <ClockIcon />
      </button>

      <button
        type="button"
        className="bottombar__btn"
        onClick={onJoin}
        aria-label="Join a hunt"
        style={{ color: '#4ec5c1' }}
      >
        <PeopleIcon />
      </button>
    </nav>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
