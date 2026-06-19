import { useState } from 'react';
import type { Hint } from '@ftp/shared';
import { mediaUrl } from '../services/media.js';

function SingleHint({ hint }: { hint: Hint }) {
  if (hint.kind === 'audio' && hint.audioUrl) {
    return (
      <div className="hint">
        <span className="hint__bubble">🔊</span>
        <audio controls src={mediaUrl(hint.audioUrl)} style={{ width: '100%' }} />
      </div>
    );
  }
  return (
    <div className="hint">
      <span className="hint__bubble">💬</span>
      <p style={{ margin: 0, fontSize: '1.15rem' }}>{hint.text || 'Look around carefully…'}</p>
    </div>
  );
}

/** Show one or more clues for an item.
 *  When `revealedCount` is given, only that many extraHints are shown (progressive reveal).
 *  When omitted, all extraHints are shown (backwards-compatible for non-player UIs).
 *  When `collapsible` is true, the main hint starts hidden behind a "Show clue" button. */
export function HintView({ hint, extraHints, revealedCount, collapsible }: { hint: Hint; extraHints?: Hint[]; revealedCount?: number; collapsible?: boolean }) {
  const [mainRevealed, setMainRevealed] = useState(!collapsible);
  const visible = revealedCount !== undefined
    ? (extraHints?.slice(0, revealedCount) ?? [])
    : (extraHints ?? []);
  return (
    <div className="stack">
      {collapsible && !mainRevealed ? (
        <button
          type="button"
          onClick={() => setMainRevealed(true)}
          style={{ background: 'none', border: '1px dashed var(--color-ink-soft)', borderRadius: 'var(--radius)', padding: 'var(--space-2)', cursor: 'pointer', color: 'var(--color-ink-soft)', fontSize: '0.95rem', width: '100%', textAlign: 'center' }}
        >
          👁 Show clue
        </button>
      ) : (
        <SingleHint hint={hint} />
      )}
      {visible.map((h, i) => <SingleHint key={i} hint={h} />)}
    </div>
  );
}
