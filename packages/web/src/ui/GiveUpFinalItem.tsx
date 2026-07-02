import { useState } from 'react';
import { Button } from './Button.js';

interface GiveUpFinalItemProps {
  onGiveUp: () => void;
  label?: string;
}

/**
 * Low-prominence "give up on the final item" affordance with an inline
 * confirm step, so a stray tap near the bottom of the screen can't forfeit
 * the bonus prize by accident.
 */
export function GiveUpFinalItem({ onGiveUp, label = 'Give up on the final item' }: GiveUpFinalItemProps) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="stack center" style={{ gap: 6 }}>
        <p className="muted" style={{ margin: 0, fontSize: '0.8rem', textAlign: 'center' }}>
          You'll miss out on the bonus prize. Are you sure?
        </p>
        <div className="row" style={{ gap: 8 }}>
          <Button variant="ghost" style={{ color: 'var(--color-danger, #ef4444)' }} onClick={onGiveUp}>
            Yes, give up
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Keep trying
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--color-ink-soft)',
        fontSize: '0.8rem',
        textDecoration: 'underline',
        padding: '8px 0',
        alignSelf: 'center',
      }}
    >
      {label}
    </button>
  );
}
