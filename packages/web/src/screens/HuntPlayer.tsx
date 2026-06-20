import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Item } from '@ftp/shared';
import { canSkip, getJigsawGridSize, isHuntComplete, scoreStep } from '@ftp/shared';
import { api } from '../services/apiClient.js';
import { playSuccessSound } from '../services/sounds.js';
import { useAsync } from '../hooks/useAsync.js';
import { useHunt } from '../hooks/useHunt.js';
import {
  Banner,
  Button,
  Card,
  FinalItemPanel,
  Fireworks,
  HintView,
  HuntTrail,
  ItemHistoryPanel,
  JigsawView,
  Page,
  PhotoCapture,
  ScorePill,
  Spinner,
  Timer,
} from '../ui/index.js';
import { mediaUrl } from '../services/media.js';
import { googleMapsLink } from '../services/maps.js';

/** The hunter flow: lobby → play → celebrate → results. */
export function HuntPlayer() {
  const { routeId = '', sessionId: resumeSessionId } = useParams();
  const navigate = useNavigate();
  const route = useAsync(() => api.getRoute(routeId), [routeId]);
  const hunt = useHunt(routeId, resumeSessionId);

  const [celebrateId, setCelebrateId] = useState<string | null>(null);
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);
  const [reversed, setReversed] = useState(false);
  const prevFound = useRef(0);
  const [finalItemSkipped, setFinalItemSkipped] = useState(false);
  const [disputeConfirm, setDisputeConfirm] = useState(false);
  const [disputeDesc, setDisputeDesc] = useState('');
  const [disputeError, setDisputeError] = useState('');
  const [riddleAnswer, setRiddleAnswer] = useState('');
  const [riddleError, setRiddleError] = useState('');

  // Countdown: 3 → 2 → 1 → null (hunt becomes visible after)
  const [countdown, setCountdown] = useState<number | null>(null);
  const [timerStartedAt, setTimerStartedAt] = useState<string>();
  const sessionCreatedRef = useRef(false);

  // Start countdown the moment a fresh session arrives (not when resuming).
  useEffect(() => {
    if (!sessionCreatedRef.current && hunt.session && !hunt.notStarted && !hunt.wasResumed) {
      sessionCreatedRef.current = true;
      setCountdown(3);
    }
  }, [hunt.session, hunt.notStarted, hunt.wasResumed]);

  // Tick the countdown down
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setTimerStartedAt(new Date().toISOString());
      setCountdown(null);
      return;
    }
    const id = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  // Celebrate + play sound whenever a new item gets solved.
  useEffect(() => {
    if (!hunt.session) return;
    const found = hunt.session.steps.filter((s) => s.status === 'found');
    if (found.length > prevFound.current) {
      const latest = [...found].sort((a, b) => (a.finishedAt ?? '').localeCompare(b.finishedAt ?? '')).at(-1);
      setCelebrateId(latest?.itemId ?? null);
      playSuccessSound();
    }
    prevFound.current = found.length;
  }, [hunt.session]);

  // Reset dispute confirm when verdict changes.
  useEffect(() => { setDisputeConfirm(false); setDisputeDesc(''); setDisputeError(''); }, [hunt.lastVerdict]);

  // Reset riddle input when the active step changes.
  useEffect(() => { setRiddleAnswer(''); setRiddleError(''); }, [hunt.activeStep?.itemId]);

  async function handleRiddleSubmit() {
    setRiddleError('');
    try {
      await hunt.submitRiddleAnswer(riddleAnswer.trim());
    } catch (e) {
      setRiddleError(e instanceof Error ? e.message : 'Not quite — try again!');
    }
  }

  async function handleDispute() {
    setDisputeError('');
    try {
      await hunt.dispute(disputeDesc.trim());
      setDisputeConfirm(false);
      setDisputeDesc('');
    } catch (e) {
      setDisputeError(e instanceof Error ? e.message : 'Could not verify — please try again.');
    }
  }

  if (route.loading) return <Page onBack title="Play"><Spinner label="Loading route…" /></Page>;
  if (route.error || !route.data) return <Page onBack title="Play"><p style={{ color: 'var(--color-danger)' }}>{route.error ?? 'Route not found'}</p></Page>;

  const { data: routeData } = route;

  // ── Lobby: let the player start when ready ──────────────────────────────
  if (hunt.notStarted) {
    const startItem = reversed ? routeData.items.at(-1) : routeData.items[0];
    const endItem   = reversed ? routeData.items[0]     : routeData.items.at(-1);
    const showEnd   = endItem && endItem.id !== startItem?.id;
    return (
      <Page onBack title="Ready?">
        <div className="stack">
          {routeData.coverPhotoUrl && (
            <img
              src={routeData.coverPhotoUrl}
              alt=""
              style={{ width: '100%', borderRadius: 'var(--radius-lg)', objectFit: 'cover', maxHeight: 220 }}
            />
          )}
          <Card>
            <div className="stack center">
              <div style={{ fontSize: '3rem' }}>🗺️</div>
              <h2>{routeData.title}</h2>
              {routeData.description && <p className="muted">{routeData.description}</p>}
              <p className="muted">{routeData.items.length} item{routeData.items.length !== 1 ? 's' : ''} to find</p>
              {(startItem?.location || endItem?.location) && (
                <div className="row" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {startItem?.location && (
                    <a href={googleMapsLink(startItem.location.lat, startItem.location.lng)} target="_blank" rel="noreferrer" className="btn btn--ghost" style={{ fontSize: '0.85rem' }}>
                      📍 Starting point
                    </a>
                  )}
                  {showEnd && endItem?.location && (
                    <a href={googleMapsLink(endItem.location.lat, endItem.location.lng)} target="_blank" rel="noreferrer" className="btn btn--ghost" style={{ fontSize: '0.85rem' }}>
                      🏁 End point
                    </a>
                  )}
                </div>
              )}
              {hunt.error && <Banner tone="no">{hunt.error}</Banner>}
              {routeData.items.length > 1 && (
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span className="muted" style={{ fontSize: '0.9rem' }}>
                    {reversed ? '🔄 Playing reversed order' : '▶ Playing original order'}
                  </span>
                  <Button variant="ghost" onClick={() => setReversed((r) => !r)}>
                    {reversed ? 'Play original' : 'Play reversed'}
                  </Button>
                </div>
              )}
              <Button size="lg" block variant="happy" onClick={() => hunt.start(reversed)} disabled={hunt.loading}>
                {hunt.loading ? 'Starting…' : '▶ Start Hunt'}
              </Button>
            </div>
          </Card>
        </div>
      </Page>
    );
  }

  if (!hunt.session) {
    return (
      <Page onBack title="Play">
        <div className="stack">
          <Banner tone="no">{hunt.error ?? 'Could not start the hunt — please try again.'}</Banner>
          <Button block onClick={() => navigate('/')}>Back to home</Button>
        </div>
      </Page>
    );
  }

  // ── Countdown before hunt begins ────────────────────────────────────────
  if (countdown !== null && countdown > 0) {
    return (
      <Page title="">
        <div className="countdown-wrap">
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-ink-soft)', margin: 0 }}>
            Get ready!
          </p>
          {/* key forces remount on each tick, restarting the CSS animation */}
          <div className="countdown-digit" key={countdown}>{countdown}</div>
          <p className="muted" style={{ margin: 0 }}>Hunt starts in…</p>
        </div>
      </Page>
    );
  }

  const items = routeData.items;
  const session = hunt.session;
  const skippedSteps = session.steps.filter((s) => s.status === 'skipped');
  const complete = isHuntComplete(session.steps);

  // ── Hunt finished ───────────────────────────────────────────────────────
  if (complete && !celebrateId) {
    const solvedIds = new Set(session.steps.filter((s) => s.status === 'found').map((s) => s.itemId));
    const skippedIds = new Set(session.steps.filter((s) => s.status === 'skipped').map((s) => s.itemId));
    const goToResults = () => navigate(`/results/${routeId}/${session.id}`, { state: { session } });
    const hasFinalItem = Boolean(routeData.finalItem);
    const finalDone = !hasFinalItem || !!session.finalItemSolved || finalItemSkipped;

    // ── 1. Final item gate — shown BEFORE fireworks/score ─────────────
    if (hasFinalItem && !finalDone) {
      return (
        <Page title="🏆 Final challenge!">
          <div className="stack">
            <Card>
              <p className="muted center" style={{ margin: 0 }}>
                You found {solvedIds.size} of {items.length} items. Now for the grand finale!
              </p>
            </Card>
            <FinalItemPanel
              finalItem={routeData.finalItem!}
              items={items}
              solvedItemIds={solvedIds}
              onSolve={hunt.solveFinalItem}
              solved={false}
              busy={hunt.busy}
              defaultExpanded
              showBreakdown
              skippedItemIds={skippedIds}
              onRetry={(itemId) => hunt.returnToSkipped(itemId)}
            />
            <Button variant="ghost" block onClick={() => setFinalItemSkipped(true)}>
              ⏭ Give up on the final item
            </Button>
          </div>
        </Page>
      );
    }

    // ── 2. Celebration — shown after final item or when there is none ──
    return (
      <Page title={session.finalItemSolved ? 'All done! 🏆' : 'Hunt complete!'}>
        <Fireworks />
        <div className="stack">
          {session.finalItemSolved && (
            <Card>
              <div className="stack center">
                <div style={{ fontSize: '2.5rem' }}>🏆</div>
                <strong>Final item solved! +100 bonus points!</strong>
              </div>
            </Card>
          )}
          <FinishedCard
            total={session.totalScore}
            onSeeResults={goToResults}
          />
        </div>
      </Page>
    );
  }

  // ── Celebration screen after finding an item ───────────────────────────
  if (celebrateId) {
    const item = items.find((i) => i.id === celebrateId);
    const step = session.steps.find((s) => s.itemId === celebrateId);
    return (
      <Page title="Great find!">
        <Card>
          <div className="stack center pop-in">
            <div style={{ fontSize: '3.5rem' }}>🎉</div>
            <h2>You found {item?.name}!</h2>
            {step && <ScorePill score={scoreStep(step)} max={100} />}
            <Button size="lg" block variant="happy" onClick={() => setCelebrateId(null)}>
              {complete
                ? routeData.finalItem ? '🏆 Go to final challenge' : '🏁 See your results'
                : '➡️ Next clue'}
            </Button>
          </div>
        </Card>
      </Page>
    );
  }

  // ── Pause screen ────────────────────────────────────────────────────────
  if (hunt.paused) {
    return (
      <Page title="Paused ⏸">
        <Card>
          <div className="stack center">
            <div style={{ fontSize: '3rem' }}>⏸️</div>
            <h2>Hunt paused</h2>
            <p className="muted">Your progress is saved — resume any time from the home screen.</p>
            <Button size="lg" block variant="happy" onClick={hunt.resume}>
              ▶ Continue now
            </Button>
            <Button block variant="ghost" onClick={() => navigate('/')}>
              🏠 Go home
            </Button>
          </div>
        </Card>
      </Page>
    );
  }

  // ── Item history view (tap a found item in the trail) ────────────────────
  if (historyItemId) {
    const histStep = session.steps.find((s) => s.itemId === historyItemId);
    const histItem = items.find((i) => i.id === historyItemId);
    const histIdx = session.steps.findIndex((s) => s.itemId === historyItemId);
    if (histStep && histItem) {
      return (
        <ItemHistoryPanel
          step={histStep}
          itemName={histItem.name}
          stepNum={histIdx + 1}
          onClose={() => setHistoryItemId(null)}
        />
      );
    }
  }

  const step = hunt.activeStep;
  const item = items.find((i) => i.id === step?.itemId);
  if (!step || !item) return <Page onBack title="Play"><Spinner /></Page>;

  const stepNumber = session.steps.findIndex((s) => s.itemId === item.id) + 1;

  // Trail map data — follows session.steps order (respects reversed hunts).
  const trailItems = session.steps.map((st) => {
    const it = items.find((i) => i.id === st.itemId);
    const foundPhoto = st.photoAttempts.filter((a) => a.verdict.match).at(-1)?.photoUrl;
    return { id: st.itemId, name: it?.name ?? 'Item', completed: st.status === 'found', thumbnail: foundPhoto };
  });
  const trailCurrentIndex = Math.max(0, session.steps.findIndex((s) => s.status === 'active'));

  function handleTrailSelect(idx: number) {
    const st = session.steps[idx];
    if (!st) return;
    if (st.status === 'skipped') hunt.returnToSkipped(st.itemId);
    if (st.status === 'found') setHistoryItemId(st.itemId);
  }

  return (
    <Page
      onBack
      title={`Clue ${stepNumber} / ${items.length}`}
      right={
        <div className="row" style={{ gap: 8 }}>
          <Timer startedAt={timerStartedAt ?? session.startedAt} paused={hunt.paused} />
          <button
            className="btn btn--ghost"
            style={{ minWidth: 40, padding: '0 10px', fontSize: '1.1rem' }}
            onClick={hunt.pause}
            aria-label="Pause hunt"
          >
            ⏸
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
      <div className="stack" style={{ flex: 1, minWidth: 0 }}>
        {/* ── Clue / instruction / riddle / jigsaw card ──────────────────── */}
        {item.kind === 'riddle' ? (
          <Card>
            <div className="stack">
              <span className="field-label">🧩 Riddle</span>
              <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{item.hint.text}</p>
              {(item.extraHints ?? []).slice(0, step.cluesUsed).filter((h) => h.text).map((h, i) => (
                <p key={i} style={{ margin: 0, color: 'var(--color-ink-soft)' }}>• {h.text}</p>
              ))}
            </div>
          </Card>
        ) : item.kind === 'jigsaw' ? (
          <div className="stack">
            {item.photos[0] && (
              <JigsawView
                imageUrl={mediaUrl(item.photos[0].url)}
                gridSize={getJigsawGridSize(item.jigsawDifficulty ?? 1)}
                mode="scrambled"
                difficulty={item.jigsawDifficulty ?? 1}
                seed={item.id}
              />
            )}
            <HintView hint={item.hint} extraHints={item.extraHints} revealedCount={step.cluesUsed} collapsible hideIfEmpty />
          </div>
        ) : item.kind === 'task' ? (
          <Card>
            <div className="stack">
              <span className="field-label">🎯 Your task</span>
              <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{item.taskInstruction ?? item.name}</p>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="stack">
              <span className="field-label">Your clue</span>
              <HintView hint={item.hint} extraHints={item.extraHints} revealedCount={step.cluesUsed} collapsible />
            </div>
          </Card>
        )}

        {/* Error banners */}
        {hunt.lastVerdict && !hunt.lastVerdict.match && item.kind !== 'riddle' && item.kind !== 'jigsaw' && (
          <Banner tone="no">🤔 {hunt.lastVerdict.reason} Try another angle, or get help!</Banner>
        )}
        {riddleError && <Banner tone="no">{riddleError}</Banner>}
        {hunt.error && <Banner tone="no">{hunt.error}</Banner>}

        {/* ── Riddle: text answer ─────────────────────────────────────────── */}
        {item.kind === 'riddle' && (
          <>
            <div className="row" style={{ gap: 4 }}>
              <input
                value={riddleAnswer}
                onChange={(e) => setRiddleAnswer(e.target.value)}
                placeholder="Your answer…"
                disabled={hunt.busy}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && riddleAnswer.trim()) { e.preventDefault(); handleRiddleSubmit(); } }}
                style={{ flex: 1 }}
              />
              <Button variant="happy" disabled={hunt.busy || !riddleAnswer.trim()} onClick={handleRiddleSubmit}>
                {hunt.busy ? '…' : '›'}
              </Button>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <Button variant="accent" onClick={hunt.useHelp}
                disabled={hunt.busy || !item.extraHints?.length || step.cluesUsed >= (item.extraHints?.length ?? 0)}>
                💡
              </Button>
              {canSkip(step) && (
                <Button variant="ghost" onClick={(e) => { e.stopPropagation(); hunt.skip(); }} disabled={hunt.busy}>
                  ⏭
                </Button>
              )}
            </div>
          </>
        )}

        {/* ── Jigsaw: text guess + camera + help + dispute ────────────────── */}
        {item.kind === 'jigsaw' && (
          <>
            {riddleError && <Banner tone="no">{riddleError}</Banner>}
            {hunt.lastVerdict && !hunt.lastVerdict.match && (
              <Banner tone="no">🤔 {hunt.lastVerdict.reason}</Banner>
            )}
            <div className="row" style={{ gap: 4 }}>
              <input
                value={riddleAnswer}
                onChange={(e) => setRiddleAnswer(e.target.value)}
                placeholder="What do you think this shows?"
                disabled={hunt.busy}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && riddleAnswer.trim()) { e.preventDefault(); handleRiddleSubmit(); } }}
                style={{ flex: 1 }}
              />
              <Button variant="happy" disabled={hunt.busy || !riddleAnswer.trim()} onClick={handleRiddleSubmit}>
                {hunt.busy ? '…' : '›'}
              </Button>
            </div>
            <PhotoCapture onCapture={(f) => hunt.submitPhoto(f)} variant="accent" disabled={hunt.busy}>
              📸
            </PhotoCapture>
            {disputeConfirm && (
              <Card>
                <div className="stack">
                  <strong>Describe what you found</strong>
                  <input value={disputeDesc} onChange={(e) => setDisputeDesc(e.target.value)} placeholder="e.g. the old fountain…" />
                  {disputeError && <Banner tone="no">{disputeError}</Banner>}
                  <div className="row">
                    <Button variant="happy" disabled={hunt.busy || !disputeDesc.trim()} onClick={handleDispute}>✅ That's it!</Button>
                    <Button variant="ghost" onClick={() => { setDisputeConfirm(false); setDisputeDesc(''); setDisputeError(''); }}>Cancel</Button>
                  </div>
                </div>
              </Card>
            )}
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <Button variant="accent" onClick={hunt.useHelp}
                disabled={hunt.busy || !item.extraHints?.length || step.cluesUsed >= (item.extraHints?.length ?? 0)}>
                💡
              </Button>
              {item.location && (
                <a href={googleMapsLink(item.location.lat, item.location.lng)} target="_blank" rel="noreferrer" className="btn btn--accent">
                  📍
                </a>
              )}
              {hunt.lastVerdict && !hunt.lastVerdict.match && (
                <Button variant="ghost" disabled={hunt.busy} onClick={() => setDisputeConfirm(true)}>
                  🙋
                </Button>
              )}
              {canSkip(step) && (
                <Button variant="ghost" onClick={hunt.skip} disabled={hunt.busy}>⏭</Button>
              )}
            </div>
          </>
        )}

        {/* ── Task: camera only, no help or dispute ───────────────────────── */}
        {item.kind === 'task' && (
          <>
            <PhotoCapture onCapture={(f) => hunt.submitPhoto(f)} variant="happy" disabled={hunt.busy}>
              {hunt.busy ? '🔎 Checking…' : '📸 Take a photo'}
            </PhotoCapture>
            {canSkip(step) && (
              <Button variant="ghost" onClick={hunt.skip} disabled={hunt.busy}>
                ⏭ Skip
              </Button>
            )}
          </>
        )}

        {/* ── Photo: full UI with help, camera, and dispute ───────────────── */}
        {item.kind !== 'task' && item.kind !== 'riddle' && item.kind !== 'jigsaw' && (
          <>
            {disputeConfirm && (
              <Card>
                <div className="stack">
                  <strong>What did you find?</strong>
                  <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                    Name or describe what you're looking at to prove you found it.
                  </p>
                  <input
                    value={disputeDesc}
                    onChange={(e) => setDisputeDesc(e.target.value)}
                    placeholder="e.g. the red mailbox, a blue door…"
                  />
                  {disputeError && <Banner tone="no">{disputeError}</Banner>}
                  <div className="row">
                    <Button variant="happy" disabled={hunt.busy || !disputeDesc.trim()} onClick={handleDispute}>
                      ✅ That's it!
                    </Button>
                    <Button variant="ghost" onClick={() => { setDisputeConfirm(false); setDisputeDesc(''); setDisputeError(''); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            <PhotoCapture onCapture={(f) => hunt.submitPhoto(f)} variant="happy" disabled={hunt.busy}>
              📸
            </PhotoCapture>

            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <Button variant="accent" onClick={hunt.useHelp}
                disabled={hunt.busy || !item.extraHints?.length || step.cluesUsed >= (item.extraHints?.length ?? 0)}>
                💡
              </Button>
              {item.location && (
                <a href={googleMapsLink(item.location.lat, item.location.lng)} target="_blank" rel="noreferrer" className="btn btn--accent">
                  📍
                </a>
              )}
              {hunt.lastVerdict && !hunt.lastVerdict.match && (
                <Button variant="ghost" disabled={hunt.busy} onClick={() => setDisputeConfirm(true)}>
                  🙋
                </Button>
              )}
              {canSkip(step) && (
                <Button variant="ghost" onClick={hunt.skip} disabled={hunt.busy}>
                  ⏭
                </Button>
              )}
            </div>
          </>
        )}

        {/* Final item progress — shown during the hunt */}
        {routeData.finalItem && (
          <FinalItemPanel
            finalItem={routeData.finalItem}
            items={items}
            solvedItemIds={new Set(session.steps.filter((s) => s.status === 'found').map((s) => s.itemId))}
            onSolve={hunt.solveFinalItem}
            solved={!!session.finalItemSolved}
            busy={hunt.busy}
            skippedItemIds={new Set(skippedSteps.map((s) => s.itemId))}
            onRetry={(itemId) => hunt.returnToSkipped(itemId)}
          />
        )}

        {/* Skipped items — offer to retry them */}
        {skippedSteps.length > 0 && (
          <Card>
            <div className="stack">
              <span className="field-label">⏭ Skipped items</span>
              <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                Returning to a skipped item scores fewer points.
              </p>
              {skippedSteps.map((s) => {
                const skippedItem = items.find((i) => i.id === s.itemId);
                if (!skippedItem) return null;
                return (
                  <div key={s.itemId} className="row" style={{ justifyContent: 'space-between' }}>
                    <span>{`Item ${items.findIndex((i) => i.id === s.itemId) + 1}`}</span>
                    <Button
                      variant="ghost"
                      disabled={hunt.busy}
                      onClick={() => hunt.returnToSkipped(s.itemId)}
                    >
                      ↩ Try again
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      {/* Trail map side rail */}
      <div style={{ width: 80, flexShrink: 0 }}>
        <HuntTrail
          items={trailItems}
          currentIndex={trailCurrentIndex}
          compact
          maxHeight={520}
          onSelectItem={handleTrailSelect}
        />
      </div>
      </div>
    </Page>
  );
}

function FinishedCard({ total, onSeeResults }: { total: number; onSeeResults: () => void }) {
  return (
    <Card>
      <div className="stack center pop-in">
        <div style={{ fontSize: '3.5rem' }}>🏆</div>
        <h2>Hunt complete!</h2>
        <ScorePill score={total} />
        <Button size="lg" block variant="happy" onClick={onSeeResults}>
          See your results
        </Button>
      </div>
    </Card>
  );
}
