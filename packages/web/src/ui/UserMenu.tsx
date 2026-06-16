import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.js';

const AVATAR_KEY = (id: string) => `ftp.avatar.${id}`;

const EMOJI_OPTIONS = ['😀', '🦁', '🐻', '🦊', '🐼', '🐨', '🐯', '🦝', '🐸', '🐙', '🦋', '🌟', '🚀', '🎩', '🌈'];

function getStoredAvatar(userId: string): string {
  return localStorage.getItem(AVATAR_KEY(userId)) ?? '';
}

function saveAvatar(userId: string, emoji: string) {
  localStorage.setItem(AVATAR_KEY(userId), emoji);
}

/** Small circular user button that opens a dropdown with account options. */
export function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [avatar, setAvatar] = useState(() => (user ? getStoredAvatar(user.id) : ''));
  const [pickingEmoji, setPickingEmoji] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking outside.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  if (!user) return null;

  const initials = user.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  function chooseEmoji(emoji: string) {
    saveAvatar(user!.id, emoji);
    setAvatar(emoji);
    setPickingEmoji(false);
  }

  return (
    <div className="usermenu" ref={ref}>
      <button
        className="usermenu__btn"
        onClick={() => { setOpen((o) => !o); setPickingEmoji(false); }}
        aria-label="Account menu"
        aria-expanded={open}
      >
        {avatar || initials}
      </button>

      {open && (
        <div className="usermenu__dropdown">
          <div className="usermenu__header">
            <span className="usermenu__avatar">{avatar || initials}</span>
            <div>
              <div className="usermenu__name">{user.name}</div>
              <div className="usermenu__email">{user.email}</div>
            </div>
          </div>

          {pickingEmoji ? (
            <div className="usermenu__emojis">
              {EMOJI_OPTIONS.map((e) => (
                <button key={e} className="usermenu__emoji" onClick={() => chooseEmoji(e)}>
                  {e}
                </button>
              ))}
              <button className="usermenu__emoji usermenu__emoji--clear" onClick={() => chooseEmoji('')}>
                Aa
              </button>
            </div>
          ) : (
            <button className="usermenu__item" onClick={() => setPickingEmoji(true)}>
              🎨 Choose avatar
            </button>
          )}

          <hr className="usermenu__divider" />
          <button
            className="usermenu__item usermenu__item--danger"
            onClick={() => { setOpen(false); signOut(); }}
          >
            🔄 Switch user
          </button>
        </div>
      )}
    </div>
  );
}
