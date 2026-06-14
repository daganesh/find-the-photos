import type { Hint } from '@ftp/shared';
import { mediaUrl } from '../services/media.js';

/** Show an item's clue: a text bubble or an audio player. */
export function HintView({ hint }: { hint: Hint }) {
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
