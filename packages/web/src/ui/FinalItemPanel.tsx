import { useMemo, useState } from 'react';
import type { FinalItem, Item } from '@ftp/shared';
import { getFinalItemPositions, getJigsawGridSize } from '@ftp/shared';
import { mediaUrl } from '../services/media.js';
import { Banner } from './Banner.js';
import { Button } from './Button.js';
import { Card } from './Card.js';
import { JigsawView } from './JigsawView.js';

interface FinalItemPanelProps {
  finalItem: FinalItem;
  /** All items in the route, in order. */
  items: Item[];
  /** IDs of items that the player has already solved. */
  solvedItemIds: Set<string>;
  onSolve: (answer: string) => Promise<void>;
  solved: boolean;
  busy: boolean;
  /** Start expanded (e.g. for the completion screen). Defaults to false. */
  defaultExpanded?: boolean;
  /** Show a per-item contribution list below the mask/jigsaw. */
  showBreakdown?: boolean;
  /** Item IDs that are currently skipped. */
  skippedItemIds?: Set<string>;
  /** Called when the player retries a skipped item. */
  onRetry?: (itemId: string) => void;
}

/** Reveals final-item clues progressively as hunt items are solved. */
export function FinalItemPanel({
  finalItem,
  items,
  solvedItemIds,
  onSolve,
  solved,
  busy,
  defaultExpanded,
  showBreakdown,
  skippedItemIds,
  onRetry,
}: FinalItemPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');

  const totalPositions = useMemo(() => {
    if (finalItem.kind === 'jigsaw') return getJigsawGridSize(finalItem.difficulty ?? 1) ** 2;
    return finalItem.answer.length;
  }, [finalItem]);

  const revealedPositions = useMemo(() => {
    const revealed = new Set<number>();
    items.forEach((item, i) => {
      if (solvedItemIds.has(item.id)) {
        for (const pos of getFinalItemPositions(i, items.length, totalPositions)) {
          revealed.add(pos);
        }
      }
    });
    return revealed;
  }, [items, solvedItemIds, totalPositions]);

  async function handleSubmit() {
    setError('');
    try {
      await onSolve(answer.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not quite — try again!');
    }
  }

  if (solved) {
    return (
      <Card>
        <div className="stack center">
          <div style={{ fontSize: '2.5rem' }}>🏆</div>
          <strong>Final item solved!</strong>
        </div>
      </Card>
    );
  }

  const cluesLabel = finalItem.kind === 'jigsaw'
    ? `${revealedPositions.size}/${totalPositions} pieces`
    : `${revealedPositions.size}/${totalPositions} letters`;

  return (
    <Card>
      <div className="stack">
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            font: 'inherit',
            color: 'inherit',
            width: '100%',
            fontWeight: 700,
          }}
        >
          <span>🏆 Final item — {cluesLabel}</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-ink-soft)' }}>{expanded ? '▲ Hide' : '▼ Show'}</span>
        </button>

        {expanded && (
          <>
            {finalItem.kind === 'riddle' && finalItem.riddleQuestion && (
              <p style={{ margin: 0, fontWeight: 600 }}>{finalItem.riddleQuestion}</p>
            )}

            {finalItem.kind === 'jigsaw' && finalItem.photoUrl ? (
              <JigsawView
                imageUrl={mediaUrl(finalItem.photoUrl)}
                gridSize={getJigsawGridSize(finalItem.difficulty ?? 1)}
                mode="assembling"
                revealedPieces={revealedPositions}
              />
            ) : (
              <AnswerMask answer={finalItem.answer} revealed={revealedPositions} />
            )}

            {showBreakdown && (
              <ItemBreakdown
                finalItem={finalItem}
                items={items}
                solvedItemIds={solvedItemIds}
                skippedItemIds={skippedItemIds}
                onRetry={onRetry}
                totalPositions={totalPositions}
              />
            )}

            {error && <Banner tone="no">{error}</Banner>}

            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={finalItem.kind === 'code' ? 'Enter the code…' : 'Your answer…'}
              disabled={busy}
              onKeyDown={(e) => { if (e.key === 'Enter' && answer.trim()) handleSubmit(); }}
            />
            <Button variant="happy" block disabled={busy || !answer.trim()} onClick={handleSubmit}>
              {busy ? 'Checking…' : '✅ Submit'}
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

interface ItemBreakdownProps {
  finalItem: FinalItem;
  items: Item[];
  solvedItemIds: Set<string>;
  skippedItemIds?: Set<string>;
  onRetry?: (itemId: string) => void;
  totalPositions: number;
}

function ItemBreakdown({
  finalItem,
  items,
  solvedItemIds,
  skippedItemIds,
  onRetry,
  totalPositions,
}: ItemBreakdownProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4 }}>
      {items.map((item, i) => {
        const positions = getFinalItemPositions(i, items.length, totalPositions);
        const isSolved = solvedItemIds.has(item.id);
        const isSkipped = skippedItemIds?.has(item.id) ?? false;
        const showRetry = isSkipped && onRetry != null;

        let contributionLabel: string;
        if (finalItem.kind === 'jigsaw') {
          const count = positions.length;
          contributionLabel = isSolved ? `+${count} pieces` : `${count} pieces`;
        } else {
          const chars = positions
            .map((pos) => finalItem.answer[pos] ?? '')
            .filter(Boolean)
            .join('');
          contributionLabel = isSolved ? `+${chars}` : chars;
        }

        const icon = isSolved ? '✅' : '⏭';
        const textColor = isSolved ? 'var(--color-ok, #22c55e)' : 'var(--color-ink-soft, #9ca3af)';

        return (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.875rem',
              gap: 8,
            }}
          >
            <span style={{ color: textColor, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {icon} {item.name} → {contributionLabel}
            </span>
            {showRetry && (
              <button
                onClick={() => onRetry(item.id)}
                style={{
                  background: 'none',
                  border: '1px solid var(--color-ink-soft, #9ca3af)',
                  borderRadius: 4,
                  padding: '1px 6px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  color: 'var(--color-ink-soft, #9ca3af)',
                  flexShrink: 0,
                  lineHeight: 1.5,
                }}
              >
                ↩ Retry
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AnswerMask({ answer, revealed }: { answer: string; revealed: Set<number> }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', padding: '8px 0' }}>
      {answer.split('').map((char, i) => (
        <span
          key={i}
          style={{
            display: 'inline-flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            width: char === ' ' ? 18 : 34,
            height: 42,
            borderBottom: char !== ' ' ? '2px solid var(--color-accent)' : undefined,
            fontSize: '1.6rem',
            fontWeight: 700,
            fontFamily: 'Caveat, cursive',
            color: 'var(--color-ink)',
            lineHeight: 1,
            paddingBottom: 2,
          }}
        >
          {char !== ' ' && revealed.has(i) ? char.toUpperCase() : ''}
        </span>
      ))}
    </div>
  );
}
