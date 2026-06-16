import { UserMenu } from './UserMenu.js';

/** Persistent brand bar shown at the very top of every screen. */
export function AppBar() {
  return (
    <header className="appbar">
      <img src="/logo.jpg" alt="Find the Photos logo" className="appbar__logo" />
      <span className="appbar__title">Find the Photos</span>
      <span style={{ flex: 1 }} />
      <UserMenu />
    </header>
  );
}
