import { useState } from 'react';
import type { HuntSession, Item, Route } from '@ftp/shared';
import { getItemClueLetters, scoreStep } from '@ftp/shared';
import { mediaUrl } from '../services/media.js';
import { Button } from './Button.js';
import { Card } from './Card.js';
import { HintView } from './HintView.js';
import { HuntTrail } from './HuntTrail.js';
import type { HuntTrailItem } from './HuntTrail.js';
import { Page } from './Page.js';
import { ScorePill } from './ScorePill.js';

export interface MemoryLaneMember {
  userId: string;
  name: string;
  avatarEmoji?: string;
}

interface MemoryLaneProps {
  route: Route;
  session: HuntSession;
  /** Team member roster for "found by" and blooper attribution. Omit for solo hunts. */
  members?: MemoryLaneMember[];
  onClose: () => void;
}

interface Blooper {
  photoUrl: string;
  reason: string;
  senderName?: string;
  itemName: string;
}

/** Polaroid-style photo card shared by the item detail and bloopers sections. */
function Polaroid({ photoUrl, verdict, index }: { photoUrl: string; verdict: boolean; index: number }) {
  return (
    <a
      href={mediaUrl(photoUrl)}
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
        transform: `rotate(${(Math.sin(index * 1.9) * 3.5).toFixed(1)}deg)`,
        position: 'relative',
      }}>
        <img
          src={mediaUrl(photoUrl)}
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
          {verdict ? '✅' : '❌'}
        </span>
      </div>
    </a>
  );
}

/** Full-screen detail view for one item in Memory Lane. */
function ItemDetailPanel({
  item,
  stepNum,
  session,
  members,
  onBack,
}: {
  item: Item;
  stepNum: number;
  session: HuntSession;
  members?: MemoryLaneMember[];
  onBack: () => void;
}) {
  const step = session.steps.find((s) => s.itemId === item.id);
  const score = step ? scoreStep(step) : 0;
  const finder = step?.foundBy ? members?.find((m) => m.userId === step.foundBy) : undefined;
  const attempts = step ? [...step.photoAttempts].reverse() : [];

  return (
    <Page onBack={onBack} title={`Step ${stepNum}`}>
      <div className="stack">
        <Card>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{item.name}</strong>
              {step?.status === 'skipped' && (
                <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.85rem' }}>⏭ Skipped</p>
              )}
              {step?.status === 'found' && finder && (
                <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.85rem' }}>
                  {finder.avatarEmoji ?? '✅'} Found by {finder.name.split(' ')[0]}
                </p>
              )}
              {step?.disputed && (
                <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.85rem' }}>🙋 You overruled the AI</p>
              )}
            </div>
            <ScorePill score={score} />
          </div>
        </Card>

        <h3 style={{ margin: '4px 0 -4px' }}>Clue</h3>
        <Card>
          <HintView hint={item.hint} extraHints={item.extraHints} />
          {item.taskInstruction && (
            <p style={{ margin: '8px 0 0', fontStyle: 'italic' }}>{item.taskInstruction}</p>
          )}
        </Card>

        {attempts.length > 0 && (
          <>
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem', textAlign: 'center' }}>
              {attempts.length} photo attempt{attempts.length !== 1 ? 's' : ''} · tap any to see full size
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center', paddingBottom: 8 }}>
              {attempts.map((attempt, i) => (
                <Polaroid key={i} photoUrl={attempt.photoUrl} verdict={attempt.verdict.match} index={i} />
              ))}
            </div>
          </>
        )}

        {attempts.length === 0 && step?.status === 'found' && (
          <Card>
            <p className="muted center" style={{ margin: 0 }}>No photos — solved with a text answer.</p>
          </Card>
        )}

        <Button variant="ghost" block onClick={onBack}>← Back to Memory Lane</Button>
      </div>
    </Page>
  );
}

/**
 * Post-hunt review: browse all items in order via the trail, tap any to see the
 * clue, score, and photo attempts. Bloopers (failed attempts) are listed below.
 */
export function MemoryLane({ route, session, members, onClose }: MemoryLaneProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const items = route.items;
  const stepByItemId = new Map(session.steps.map((s) => [s.itemId, s]));

  const trailItems: HuntTrailItem[] = items.map((item, i) => {
    const step = stepByItemId.get(item.id);
    const winningPhoto = step?.photoAttempts.find((a) => a.verdict.match);
    return {
      id: item.id,
      name: item.name,
      completed: step?.status === 'found' || step?.status === 'skipped',
      thumbnail: winningPhoto ? mediaUrl(winningPhoto.photoUrl) : undefined,
      clueLetters: step?.status === 'found' ? getItemClueLetters(i, items.length, route.finalItem) : undefined,
    };
  });

  const bloopers: Blooper[] = [];
  for (const step of session.steps) {
    const item = items.find((i) => i.id === step.itemId);
    for (const attempt of step.photoAttempts) {
      if (!attempt.verdict.match) {
        const member = members?.find((m) => m.userId === attempt.submittedBy);
        bloopers.push({
          photoUrl: attempt.photoUrl,
          reason: attempt.verdict.reason,
          senderName: member?.name ?? (attempt.submittedBy ? attempt.submittedBy.split('@')[0] : undefined),
          itemName: item?.name ?? 'Item',
        });
      }
    }
  }

  if (selectedIndex !== null) {
    const item = items[selectedIndex];
    if (item) {
      return (
        <ItemDetailPanel
          item={item}
          stepNum={selectedIndex + 1}
          session={session}
          members={members}
          onBack={() => setSelectedIndex(null)}
        />
      );
    }
  }

  return (
    <Page onBack={onClose} title="Memory Lane">
      <div className="stack">
        <HuntTrail
          items={trailItems}
          currentIndex={trailItems.length - 1}
          onSelectItem={(index) => setSelectedIndex(index)}
        />

        {bloopers.length > 0 && (
          <>
            <h2>🎬 Bloopers</h2>
            <Card>
              <p className="muted" style={{ margin: '0 0 14px', fontSize: '0.85rem', textAlign: 'center' }}>
                The funniest fails from your hunt
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
                {bloopers.map((blooper, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <a
                      href={mediaUrl(blooper.photoUrl)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ textDecoration: 'none' }}
                    >
                      <div style={{
                        background: '#fff',
                        padding: '7px 7px 30px',
                        borderRadius: 4,
                        boxShadow: '0 3px 12px rgba(0,0,0,0.18)',
                        width: 140,
                        transform: `rotate(${(Math.sin(i * 2.1) * 4).toFixed(1)}deg)`,
                        position: 'relative',
                      }}>
                        <img
                          src={mediaUrl(blooper.photoUrl)}
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
                          ❌
                        </span>
                      </div>
                    </a>
                    <p style={{ margin: '6px 0 0', fontSize: '0.72rem', color: 'var(--color-ink-soft)', maxWidth: 140 }}>
                      {blooper.senderName ? `${blooper.senderName} · ` : ''}{blooper.itemName}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {bloopers.length === 0 && (
          <Card>
            <p className="muted center" style={{ margin: 0 }}>No bloopers — flawless hunt! 🎯</p>
          </Card>
        )}

        <Button variant="ghost" block onClick={onClose}>← Back to results</Button>
      </div>
    </Page>
  );
}
