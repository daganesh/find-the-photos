import { useEffect, useMemo, useState } from 'react';
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
  /** Called when the player taps "Continue to results" on the prize screen. */
  onPrizeContinue?: () => void;
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
  onPrizeContinue,
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

  // Pre-fill collected characters for code kind.
  useEffect(() => {
    if (finalItem.kind !== 'code') return;
    if (revealedPositions.size === 0) return;
    setAnswer(
      finalItem.answer.split('').map((char, i) =>
        char === ' ' ? ' ' : (revealedPositions.has(i) ? char.toUpperCase() : '_')
      ).join(''),
    );
  }, [finalItem, revealedPositions]);

  async function handleSubmit() {
    setError('');
    try {
      await onSolve(answer.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not quite — try again!');
    }
  }

  // ── Code kind: solved — open chest with prize ──────────────────────────────
  if (solved && finalItem.kind === 'code') {
    const hasPrize = finalItem.prizeImageUrl || finalItem.revealAnswer;
    return (
      <div className="stack center" style={{ alignItems: 'center' }}>
        <div style={{ position: 'relative', display: 'inline-block', maxWidth: 280, width: '100%' }}>
          <img
            src="/chest-open.png"
            alt="Open treasure chest"
            style={{ width: '100%', display: 'block' }}
          />
          {hasPrize && (
            <div
              style={{
                position: 'absolute',
                top: '36%',
                left: '50%',
                transform: 'translate(-50%, 0)',
                width: '54%',
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              {finalItem.prizeImageUrl ? (
                <img
                  src={mediaUrl(finalItem.prizeImageUrl)}
                  alt="Prize"
                  style={{
                    maxWidth: '100%',
                    maxHeight: 90,
                    objectFit: 'contain',
                    borderRadius: 6,
                    filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))',
                  }}
                />
              ) : (
                <p
                  style={{
                    margin: 0,
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    color: '#fff',
                    textShadow: '0 1px 4px rgba(0,0,0,0.7)',
                    lineHeight: 1.3,
                    wordBreak: 'break-word',
                  }}
                >
                  {finalItem.revealAnswer}
                </p>
              )}
            </div>
          )}
        </div>
        {onPrizeContinue && (
          <Button variant="happy" block onClick={onPrizeContinue}>
            ✨ Continue to results
          </Button>
        )}
      </div>
    );
  }

  // ── Non-code solved (shouldn't normally render, but keep a fallback) ───────
  if (solved) {
    return (
      <Card>
        <div className="stack center">
          <div style={{ fontSize: '2.5rem' }}>🏆</div>
          <strong>Final challenge solved!</strong>
        </div>
      </Card>
    );
  }

  // ── Code kind: not solved — locked chest UI ────────────────────────────────
  if (finalItem.kind === 'code') {
    const cluesLabel = !finalItem.answer
      ? 'collecting clues…'
      : `${revealedPositions.size}/${totalPositions} characters collected`;

    return (
      <div className="stack">
        {/* Locked chest — tap to open code entry */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => setExpanded((e) => !e)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'inline-block',
            }}
            aria-label={expanded ? 'Hide code entry' : 'Tap to enter the code'}
          >
            <img
              src="/chest-locked.png"
              alt="Locked treasure chest"
              style={{ width: 200, maxWidth: '70vw', display: 'block', margin: '0 auto' }}
            />
          </button>
          <p style={{ margin: '8px 0 0', fontSize: '0.9rem', fontWeight: 600 }}>
            {expanded ? '▲ Hide code entry' : '🔒 Tap to enter the code'}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--color-ink-soft)' }}>
            {cluesLabel}
          </p>
        </div>

        {expanded && (
          <>
            <CodeAssemblyDisplay answer={finalItem.answer} revealed={revealedPositions} />

            <ItemBreakdown
              finalItem={finalItem}
              items={items}
              solvedItemIds={solvedItemIds}
              skippedItemIds={skippedItemIds}
              onRetry={onRetry}
              totalPositions={totalPositions}
            />

            {error && <Banner tone="no">{error}</Banner>}

            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Fill in the blanks and enter the full code…"
              disabled={busy}
              onKeyDown={(e) => { if (e.key === 'Enter' && answer.trim()) handleSubmit(); }}
              style={{ fontFamily: 'monospace', letterSpacing: '0.15em', textTransform: 'uppercase' }}
            />
            <Button variant="happy" block disabled={busy || !answer.trim()} onClick={handleSubmit}>
              {busy ? 'Checking…' : '🔓 Unlock'}
            </Button>
          </>
        )}
      </div>
    );
  }

  // ── Riddle / jigsaw (legacy) ───────────────────────────────────────────────
  const cluesLabel = finalItem.kind === 'jigsaw'
    ? `${revealedPositions.size}/${totalPositions} pieces`
    : !finalItem.answer
    ? 'clues collecting…'
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
                mode="scrambled"
                seed={finalItem.answer}
                difficulty={finalItem.difficulty ?? 1}
              />
            ) : (
              <AnswerMask answer={finalItem.answer} revealed={revealedPositions} />
            )}

            <ItemBreakdown
              finalItem={finalItem}
              items={items}
              solvedItemIds={solvedItemIds}
              skippedItemIds={skippedItemIds}
              onRetry={onRetry}
              totalPositions={totalPositions}
            />

            {error && <Banner tone="no">{error}</Banner>}

            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={
                finalItem.kind === 'riddle' && revealedPositions.size > 0 ? 'Fill in the blanks…' :
                'Your answer…'
              }
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
          const count = positions.filter((pos) => finalItem.answer[pos] && finalItem.answer[pos] !== ' ').length;
          contributionLabel = isSolved
            ? `+${count} char${count !== 1 ? 's' : ''}`
            : '?'.repeat(Math.max(1, count));
        }

        const icon = isSolved ? '✅' : isSkipped ? '⏭' : '🔒';
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
              {icon} {isSolved ? item.name : `Step ${i + 1}`} → {contributionLabel}
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

/** Code assembly display: collected chars in solid accent boxes, missing chars as dashed blanks. */
function CodeAssemblyDisplay({ answer, revealed }: { answer: string; revealed: Set<number> }) {
  const allRevealed = answer.split('').every((c, i) => c === ' ' || revealed.has(i));
  return (
    <div className="stack" style={{ alignItems: 'center' }}>
      {!allRevealed && (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem', textAlign: 'center' }}>
          Collected pieces are highlighted — fill in the blanks below
        </p>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', padding: '8px 0' }}>
        {answer.split('').map((char, i) => {
          if (char === ' ') return <span key={i} style={{ width: 12 }} />;
          const isRevealed = revealed.has(i);
          return (
            <span
              key={i}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 44,
                borderRadius: 6,
                border: isRevealed
                  ? '2px solid var(--color-accent)'
                  : '2px dashed var(--color-ink-soft, #9ca3af)',
                background: isRevealed ? 'var(--tint-happy)' : 'transparent',
                fontSize: '1.4rem',
                fontWeight: 700,
                fontFamily: 'monospace',
                color: isRevealed ? 'var(--color-accent)' : 'var(--color-ink-soft, #9ca3af)',
              }}
            >
              {isRevealed ? char.toUpperCase() : '_'}
            </span>
          );
        })}
      </div>
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
