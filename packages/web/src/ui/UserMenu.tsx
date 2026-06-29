import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { api, ApiError } from '../services/apiClient.js';

const AVATAR_KEY = (id: string) => `ftp.avatar.${id}`;
const AVATAR_COLOR_KEY = (id: string) => `ftp.avatar.color.${id}`;
const AVATAR_CARTOON_KEY = (id: string) => `ftp.avatar.cartoon.${id}`;

const EMOJI_OPTIONS = ['😀', '🦁', '🐻', '🦊', '🐼', '🐨', '🐯', '🦝', '🐸', '🐙', '🦋', '🌟', '🚀', '🎩', '🌈'];

const COLOR_SWATCHES = [
  '#f9c74f', '#f4845f', '#e07a5f', '#81b29a',
  '#6b4f7f', '#577590', '#43aa8b', '#4cc9f0',
  '#ff6b6b', '#c77dff', '#3d405b', '#90be6d',
];

const MAX_INPUT_DIM = 600;
const INPUT_QUALITY = 0.85;

function getStoredAvatar(userId: string): string {
  return localStorage.getItem(AVATAR_KEY(userId)) ?? '';
}

function getStoredColor(userId: string): string {
  return localStorage.getItem(AVATAR_COLOR_KEY(userId)) ?? '';
}

function getStoredCartoon(userId: string): string {
  return localStorage.getItem(AVATAR_CARTOON_KEY(userId)) ?? '';
}

function saveAvatar(userId: string, emoji: string) {
  localStorage.setItem(AVATAR_KEY(userId), emoji);
}

function saveColor(userId: string, color: string) {
  if (color) localStorage.setItem(AVATAR_COLOR_KEY(userId), color);
  else localStorage.removeItem(AVATAR_COLOR_KEY(userId));
}

function saveCartoon(userId: string, dataUrl: string) {
  if (dataUrl) localStorage.setItem(AVATAR_CARTOON_KEY(userId), dataUrl);
  else localStorage.removeItem(AVATAR_CARTOON_KEY(userId));
}

/** Downscale file to MAX_INPUT_DIM on the client before upload. */
function resizeForAvatar(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: w, naturalHeight: h } = img;
      const scale = w > MAX_INPUT_DIM || h > MAX_INPUT_DIM
        ? MAX_INPUT_DIM / Math.max(w, h)
        : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(blob ?? file),
        'image/jpeg',
        INPUT_QUALITY,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

/** Small circular user button that opens a dropdown with account options. */
export function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [avatar, setAvatar] = useState(() => (user ? getStoredAvatar(user.id) : ''));
  const [avatarColor, setAvatarColor] = useState(() => (user ? getStoredColor(user.id) : ''));
  const [cartoonUrl, setCartoonUrl] = useState(() => (user ? getStoredCartoon(user.id) : ''));
  const [pickingAvatar, setPickingAvatar] = useState(false);

  // Cartoon avatar flow state
  const [cartoonPreview, setCartoonPreview] = useState('');
  const [cartoonLoading, setCartoonLoading] = useState(false);
  const [cartoonError, setCartoonError] = useState('');
  const [retriesLeft, setRetriesLeft] = useState(3);

  const ref = useRef<HTMLDivElement>(null);

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
    // Switching to emoji clears cartoon
    saveCartoon(user!.id, '');
    setCartoonUrl('');
  }

  function chooseColor(color: string) {
    saveColor(user!.id, color);
    setAvatarColor(color);
  }

  async function handleCartoonFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setCartoonError('');
    setCartoonPreview('');
    setCartoonLoading(true);

    try {
      const resized = await resizeForAvatar(file);
      const result = await api.cartoonifyAvatar(resized);
      setCartoonPreview(result.imageDataUrl);
      setRetriesLeft(result.retriesLeft);
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message
        : err instanceof Error ? err.message : 'Something went wrong';
      setCartoonError(msg);
      if (err instanceof ApiError && err.status === 429) setRetriesLeft(0);
    } finally {
      setCartoonLoading(false);
    }
  }

  function applyCartoon() {
    if (!cartoonPreview) return;
    saveCartoon(user!.id, cartoonPreview);
    setCartoonUrl(cartoonPreview);
    // Clear emoji when a cartoon is applied
    saveAvatar(user!.id, '');
    setAvatar('');
  }

  function clearCartoon() {
    saveCartoon(user!.id, '');
    setCartoonUrl('');
    setCartoonPreview('');
  }

  const avatarStyle = avatarColor && !cartoonUrl ? { background: avatarColor } : {};

  return (
    <div className="usermenu" ref={ref}>
      <button
        className="usermenu__btn"
        onClick={() => { setOpen((o) => !o); setPickingAvatar(false); }}
        aria-label="Account menu"
        aria-expanded={open}
        style={cartoonUrl ? {} : avatarStyle}
      >
        {cartoonUrl
          ? <img src={cartoonUrl} alt="Your cartoon avatar" className="usermenu__cartoon-img" />
          : (avatar || initials)}
      </button>

      {open && (
        <div className="usermenu__dropdown">
          <div className="usermenu__header">
            <span className="usermenu__avatar" style={cartoonUrl ? {} : avatarStyle}>
              {cartoonUrl
                ? <img src={cartoonUrl} alt="Your cartoon avatar" className="usermenu__cartoon-img" />
                : (avatar || initials)}
            </span>
            <div>
              <div className="usermenu__name">{user.name}</div>
              <div className="usermenu__email">{user.email}</div>
            </div>
          </div>

          <button className="usermenu__item" onClick={() => { setOpen(false); navigate('/report'); }}>
            🐛 Report a bug / feature
          </button>

          {pickingAvatar ? (
            <div className="stack" style={{ padding: '8px 12px', gap: 10 }}>

              {/* ── Emoji ── */}
              <span className="usermenu__section-label">EMOJI</span>
              <div className="usermenu__emojis">
                {EMOJI_OPTIONS.map((e) => (
                  <button key={e} className={`usermenu__emoji${avatar === e && !cartoonUrl ? ' usermenu__emoji--active' : ''}`} onClick={() => chooseEmoji(e)}>
                    {e}
                  </button>
                ))}
                <button className="usermenu__emoji usermenu__emoji--clear" onClick={() => chooseEmoji('')}>
                  Aa
                </button>
              </div>

              {/* ── Background colour ── */}
              <span className="usermenu__section-label">BACKGROUND</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => chooseColor(c)}
                    aria-label={c}
                    style={{
                      width: 28, height: 28, borderRadius: '50%', background: c,
                      border: avatarColor === c ? '3px solid var(--color-ink)' : '2px solid transparent',
                      cursor: 'pointer', outline: 'none', padding: 0,
                    }}
                  />
                ))}
                <button
                  onClick={() => chooseColor('')}
                  aria-label="Default colour"
                  style={{
                    width: 28, height: 28, borderRadius: '50%', background: 'var(--color-muted)',
                    border: !avatarColor ? '3px solid var(--color-ink)' : '2px solid transparent',
                    cursor: 'pointer', outline: 'none', padding: 0,
                    fontSize: '0.65rem', color: 'var(--color-ink)',
                  }}
                >↺</button>
              </div>

              {/* ── Cartoon avatar ── */}
              <span className="usermenu__section-label">CARTOON AVATAR</span>

              {cartoonUrl && !cartoonPreview && (
                <div className="usermenu__cartoon-frame">
                  <img src={cartoonUrl} alt="Current cartoon avatar" />
                  <button className="usermenu__cartoon-clear" onClick={clearCartoon} aria-label="Remove cartoon avatar">✕</button>
                </div>
              )}

              {cartoonPreview && (
                <div className="usermenu__cartoon-frame">
                  <img src={cartoonPreview} alt="Cartoon preview" />
                </div>
              )}

              {cartoonLoading && (
                <div className="usermenu__cartoon-loading">
                  <span className="usermenu__cartoon-spinner" /> Generating cartoon…
                </div>
              )}

              {cartoonError && (
                <p className="usermenu__cartoon-error">{cartoonError}</p>
              )}

              {cartoonPreview && !cartoonLoading && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn--happy" style={{ flex: 1, padding: '6px 0' }} onClick={applyCartoon}>
                    Set as avatar
                  </button>
                  {retriesLeft > 0 && (
                    <label className="btn btn--ghost" style={{ flex: 1, padding: '6px 0', cursor: 'pointer', textAlign: 'center' }}>
                      Try again ({retriesLeft})
                      <input type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={handleCartoonFile} />
                    </label>
                  )}
                </div>
              )}

              {!cartoonPreview && !cartoonLoading && retriesLeft > 0 && (
                <label className={`btn btn--ghost usermenu__cartoon-upload${cartoonLoading ? ' disabled' : ''}`}>
                  📸 Upload a selfie ({retriesLeft} {retriesLeft === 1 ? 'try' : 'tries'} left)
                  <input type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={handleCartoonFile} />
                </label>
              )}

              {!cartoonLoading && retriesLeft === 0 && !cartoonPreview && (
                <p className="usermenu__cartoon-error">No more tries left for this session.</p>
              )}

              <button className="usermenu__item" onClick={() => { setPickingAvatar(false); setCartoonPreview(''); setCartoonError(''); }}>✓ Done</button>
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
