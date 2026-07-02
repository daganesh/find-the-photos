import { useNavigate } from 'react-router-dom';
import { UserMenu } from './UserMenu.js';
import { usePageHeader } from './PageHeaderContext.js';
import { useTryExitGuard } from './ExitGuardContext.js';

/** Persistent brand bar shown at the very top of every screen. */
export function AppBar() {
  const navigate = useNavigate();
  const header = usePageHeader();
  const tryExitGuard = useTryExitGuard();

  // Any in-app "leave" tap goes through the active hunt's guard first, if one
  // is registered — same protection the browser back button gets.
  function goHome() {
    if (tryExitGuard()) return;
    navigate('/');
  }

  return (
    <header className="appbar">
      {header ? (
        <>
          <button
            className="btn btn--ghost"
            onClick={() => { if (header.onBack) { if (!tryExitGuard()) header.onBack(); } else { goHome(); } }}
            aria-label="Go back"
            style={{ minWidth: 48, padding: 0, width: 48, fontSize: '1.5rem', lineHeight: 1 }}
          >
            ‹
          </button>
          <span className="appbar__title">{header.title}</span>
        </>
      ) : (
        <button
          onClick={goHome}
          aria-label="Home"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <img src="/logo.jpg" alt="Crumb Trail logo" className="appbar__logo" style={{ mixBlendMode: 'multiply' }} />
          <span className="appbar__title">Crumb Trail</span>
        </button>
      )}
      <span style={{ flex: 1 }} />
      <UserMenu />
    </header>
  );
}
