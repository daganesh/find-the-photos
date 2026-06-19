import type { StepProgress } from '@ftp/shared';
import { scoreStep } from '@ftp/shared';
import { mediaUrl } from '../services/media.js';
import { Button } from './Button.js';
import { Card } from './Card.js';
import { Page } from './Page.js';

interface ItemHistoryPanelProps {
  step: StepProgress;
  itemName: string;
  stepNum: number;
  onClose: () => void;
  /** Team member info for "found by" attribution. */
  members?: { userId: string; name: string; avatarEmoji?: string }[];
}

/** Full-screen panel showing all photo attempts (bloopers + the winner) for a found item. */
export function ItemHistoryPanel({ step, itemName, stepNum, onClose, members }: ItemHistoryPanelProps) {
  const finder = members?.find((m) => m.userId === step.foundBy);
  const score = scoreStep(step);
  const attempts = [...step.photoAttempts].reverse();

  return (
    <Page onBack={onClose} title={`Step ${stepNum}`}>
      <div className="stack">
        <Card>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{itemName}</strong>
              {finder && (
                <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.85rem' }}>
                  {finder.avatarEmoji ?? '✅'} Found by {finder.name.split(' ')[0]}
                </p>
              )}
            </div>
            <span style={{
              background: 'var(--tint-happy, #dcfce7)',
              color: 'var(--color-ok, #16a34a)',
              borderRadius: 'var(--radius-full, 999px)',
              padding: '2px 12px',
              fontWeight: 700,
              fontSize: '0.9rem',
            }}>
              ⭐ {score}
            </span>
          </div>
        </Card>

        {attempts.length === 0 ? (
          <Card>
            <p className="muted center" style={{ margin: 0 }}>
              No photos — solved with a text answer.
            </p>
          </Card>
        ) : (
          <>
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem', textAlign: 'center' }}>
              {attempts.length} photo attempt{attempts.length !== 1 ? 's' : ''} · tap any to see full size
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center', paddingBottom: 8 }}>
              {attempts.map((attempt, i) => (
                <a
                  key={i}
                  href={mediaUrl(attempt.photoUrl)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ textDecoration: 'none' }}
                >
                  <div style={{
                    background: '#fff',
                    padding: '7px 7px 26px',
                    borderRadius: 4,
                    boxShadow: '0 3px 12px rgba(0,0,0,0.18)',
                    width: 140,
                    transform: `rotate(${(Math.sin(i * 1.9) * 3.5).toFixed(1)}deg)`,
                    position: 'relative',
                  }}>
                    <img
                      src={mediaUrl(attempt.photoUrl)}
                      alt=""
                      style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block', borderRadius: 2 }}
                    />
                    <span style={{
                      position: 'absolute',
                      bottom: 4,
                      left: 0,
                      right: 0,
                      textAlign: 'center',
                      fontSize: '1.1rem',
                    }}>
                      {attempt.verdict.match ? '✅' : '❌'}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </>
        )}

        <Button variant="ghost" block onClick={onClose}>← Back to hunt</Button>
      </div>
    </Page>
  );
}
