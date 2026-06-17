import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';

const AVATAR_KEY = (id: string) => `ftp.avatar.${id}`;
const AVATAR_COLOR_KEY = (id: string) => `ftp.avatar.color.${id}`;

const EMOJI_OPTIONS = ['😀', '🦁', '🐻', '🦊', '🐼', '🐨', '🐯', '🦝', '🐸', '🐙', '🦋', '🌟', '🚀', '🎩', '🌈'];

const COLOR_SWATCHES = [
  '#f9c74f', '#f4845f', '#e07a5f', '#81b29a',
  '#6b4f7f', '#577590', '#43aa8b', '#4cc9f0',
  '#ff6b6b', '#c77dff', '#3d405b', '#90be6d',
];

function getStoredAvatar(userId: string): string {
  return localStorage.getItem(AVATAR_KEY(userId)) ?? '';
}

function getStoredColor(userId: string): string {
  return localStorage.getItem(AVATAR_COLOR_KEY(userId)) ?? '';
}

function saveAvatar(userId: string, emoji: string) {
  localStorage.setItem(AVATAR_KEY(userId), emoji);
}

function saveColor(userId: string, color: string) {
  if (color) localStorage.setItem(AVATAR_COLOR_KEY(userId), color);
  else localStorage.removeItem(AVATAR_COLOR_KEY(userId));
}

/** Small circular user button that opens a dropdown with account options. */
export function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [avatar, setAvatar] = useState(() => (user ? getStoredAvatar(user.id) : ''));
  const [avatarColor, setAvatarColor] = useState(() => (user ? getStoredColor(user.id) : ''));
  const [pickingAvatar, setPickingAvatar] = useState(false);
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
    ? user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  function chooseEmoji(emoji: string) {
    saveAvatar(user!.id, emoji);
    setAvatar(emoji);
  }

  function chooseColor(color: string) {
    saveColor(user!.id, color);
    setAvatarColor(color);
  }

  const avatarStyle = avatarColor ? { background: avatarColor } : {};

  return (
    <div className="usermenu" ref={ref}>
      <button
        className="usermenu__btn"
        onClick={() => { setOpen((o) => !o); setPickingAvatar(false); }}
        aria-label="Account menu"
        aria-expanded={open}
        style={avatarStyle}
      >
        {avatar || initials}
      </button>

      {open && (
        <div className="usermenu__dropdown">
          <div className="usermenu__header">
            <span className="usermenu__avatar" style={avatarStyle}>{avatar || initials}</span>
            <div>
              <div className="usermenu__name">{user.name}</div>
              <div className="usermenu__email">{user.email}</div>
            </div>
          </div>

          {pickingAvatar ? (
            <div className="stack" style={{ padding: '8px 12px', gap: 10 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-soft)', fontWeight: 600 }}>EMOJI</span>
              <div className="usermenu__emojis">
                {EMOJI_OPTIONS.map((e) => (
                  <button key={e} className={`usermenu__emoji${avatar === e ? ' usermenu__emoji--active' : ''}`} onClick={() => chooseEmoji(e)}>
                    {e}
                  </button>
                ))}
                <button className="usermenu__emoji usermenu__emoji--clear" onClick={() => chooseEmoji('')}>
                  Aa
                </button>
              </div>

              <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-soft)', fontWeight: 600 }}>BACKGROUND</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => chooseColor(c)}
                    aria-label={c}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: c,
                      border: avatarColor === c ? '3px solid var(--color-ink)' : '2px solid transparent',
                      cursor: 'pointer',
                      outline: 'none',
                      padding: 0,
                    }}
                  />
                ))}
                <button
                  onClick={() => chooseColor('')}
                  aria-label="Default colour"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'var(--color-muted)',
                    border: !avatarColor ? '3px solid var(--color-ink)' : '2px solid transparent',
                    cursor: 'pointer',
                    outline: 'none',
                    padding: 0,
                    fontSize: '0.65rem',
                    color: 'var(--color-ink)',
                  }}
                >
                  ↺
                </button>
              </div>

              <button className="usermenu__item" onClick={() => setPickingAvatar(false)}>✓ Done</button>
            </div>
          ) : (
            <button className="usermenu__item" onClick={() => setPickingAvatar(true)}>
              🎨 Choose avatar
            </button>
          )}

          {user.isAdmin && (
            <button className="usermenu__item" onClick={() => { setOpen(false); navigate('/admin'); }}>
              ⚙️ Admin
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
