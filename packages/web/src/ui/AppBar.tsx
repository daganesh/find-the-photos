import { useNavigate } from 'react-router-dom';
import { UserMenu } from './UserMenu.js';

/** Persistent brand bar shown at the very top of every screen. */
export function AppBar() {
  const navigate = useNavigate();
  return (
    <header className="appbar">
      <button
        onClick={() => navigate('/')}
        aria-label="Home"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
      >
        <img src="/logo.jpg" alt="Find the Photos logo" className="appbar__logo" />
        <span className="appbar__title">Find the Photos</span>
      </button>
      <span style={{ flex: 1 }} />
      <UserMenu />
    </header>
  );
}
