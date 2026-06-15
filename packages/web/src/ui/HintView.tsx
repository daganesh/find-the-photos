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

/** Show one or more clues for an item. */
export function HintView({ hint, extraHints }: { hint: Hint; extraHints?: Hint[] }) {
  return (
    <div className="stack">
      <SingleHint hint={hint} />
      {extraHints?.map((h, i) => <SingleHint key={i} hint={h} />)}
    </div>
  );
}
