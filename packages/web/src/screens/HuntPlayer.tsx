import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { GeoPoint, Item } from '@ftp/shared';
import { HelpLevel, canSkip, getJigsawGridSize, isHuntComplete, scoreStep } from '@ftp/shared';
import { api } from '../services/apiClient.js';
import { playSuccessSound } from '../services/sounds.js';
import { useAsync } from '../hooks/useAsync.js';
import { useHunt } from '../hooks/useHunt.js';
import { getCurrentLocation } from '../services/geolocation.js';
import {
  Banner,
  Button,
  Card,
  FinalItemPanel,
  Fireworks,
  HintView,
  JigsawView,
  MapView,
  Page,
  PhotoCapture,
  ScorePill,
  Spinner,
  Timer,
} from '../ui/index.js';
import { mediaUrl } from '../services/media.js';

/** The hunter flow: lobby → play → celebrate → results. */
export function HuntPlayer() {
  const { routeId = '' } = useParams();
  const navigate = useNavigate();
  const route = useAsync(() => api.getRoute(routeId), [routeId]);
  const hunt = useHunt(routeId);

  const [celebrateId, setCelebrateId] = useState<string | null>(null);
  const [hunterLoc, setHunterLoc] = useState<GeoPoint | undefined>();
  const prevFound = useRef(0);
  const [disputeConfirm, setDisputeConfirm] = useState(false);
  const [disputeDesc, setDisputeDesc] = useState('');
  const [disputeError, setDisputeError] = useState('');
  const [riddleAnswer, setRiddleAnswer] = useState('');
  const [riddleError, setRiddleError] = useState('');

  // Countdown: 3 → 2 → 1 → null (hunt becomes visible after)
  const [countdown, setCountdown] = useState<number | null>(null);
  const [timerStartedAt, setTimerStartedAt] = useState<string>();
  const sessionCreatedRef = useRef(false);

  // Start countdown the moment the session arrives for the first time
  useEffect(() => {
    if (!sessionCreatedRef.current && hunt.session && !hunt.notStarted) {
      sessionCreatedRef.current = true;
      setCountdown(3);
    }
  }, [hunt.session, hunt.notStarted]);

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

  // Fetch the device location once we reach a map-help level.
  const helpLevel = hunt.activeStep?.helpLevel ?? HelpLevel.None;
  useEffect(() => {
    if (helpLevel >= HelpLevel.MapDot && !hunterLoc) {
      getCurrentLocation().then(setHunterLoc);
    }
  }, [helpLevel, hunterLoc]);

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
              {hunt.error && <Banner tone="no">{hunt.error}</Banner>}
              <Button size="lg" block variant="happy" onClick={hunt.start} disabled={hunt.loading}>
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
  if (countdown !== null) {
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
    const goToResults = () => navigate(`/results/${routeId}`, { state: { session } });

    if (routeData.finalItem) {
      return (
        <Page title={session.finalItemSolved ? 'All done! 🏆' : 'Final challenge!'}>
          <Fireworks />
          <div className="stack">
            <Card>
              <div className="stack center">
                <ScorePill score={session.totalScore} />
                {session.finalItemSolved && (
                  <p className="muted" style={{ margin: 0 }}>You solved the final item!</p>
                )}
              </div>
            </Card>
            <FinalItemPanel
              finalItem={routeData.finalItem}
              items={items}
              solvedItemIds={solvedIds}
              onSolve={hunt.solveFinalItem}
              solved={!!session.finalItemSolved}
              busy={hunt.busy}
              defaultExpanded
              showBreakdown
              skippedItemIds={skippedIds}
              onRetry={(itemId) => hunt.returnToSkipped(itemId)}
            />
            <Button variant="ghost" block onClick={goToResults}>📊 See full results</Button>
          </div>
        </Page>
      );
    }

    return (
      <Page title="Done!">
        <Fireworks />
        <div className="stack">
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
              {complete ? '🏁 See your results' : '➡️ Next clue'}
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
            <p className="muted">Take a break — your progress is saved.</p>
            <Button size="lg" block variant="happy" onClick={hunt.resume}>
              ▶ Resume Hunt
            </Button>
          </div>
        </Card>
      </Page>
    );
  }

  const step = hunt.activeStep;
  const item = items.find((i) => i.id === step?.itemId);
  if (!step || !item) return <Page onBack title="Play"><Spinner /></Page>;

  const stepNumber = items.findIndex((i) => i.id === item.id) + 1;

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
      <div className="stack">
        {/* ── Clue / instruction / riddle / jigsaw card ──────────────────── */}
        {item.kind === 'riddle' ? (
          <Card>
            <div className="stack">
              <span className="field-label">🧩 Riddle</span>
              <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{item.hint.text}</p>
              {(item.extraHints ?? []).filter((h) => h.text).length > 0 && (
                <>
                  <span className="field-label" style={{ marginTop: 'var(--space-1)' }}>Clues</span>
                  {(item.extraHints ?? []).map((h, i) => (
                    <p key={i} style={{ margin: 0, color: 'var(--color-ink-soft)' }}>• {h.text}</p>
                  ))}
                </>
              )}
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
            {(item.extraHints ?? []).filter((h) => h.text).length > 0 && (
              <Card>
                <div className="stack">
                  <span className="field-label">Clues</span>
                  <HintView hint={item.hint} extraHints={item.extraHints} />
                </div>
              </Card>
            )}
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
              <HintView hint={item.hint} extraHints={item.extraHints} />
            </div>
          </Card>
        )}

        {/* Help panel — photo items only */}
        {item.kind !== 'task' && item.kind !== 'riddle' && item.kind !== 'jigsaw' && (
          <HelpPanel item={item} step={step} hunterLoc={hunterLoc} />
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
            <input
              value={riddleAnswer}
              onChange={(e) => setRiddleAnswer(e.target.value)}
              placeholder="Your answer…"
              disabled={hunt.busy}
              onKeyDown={(e) => { if (e.key === 'Enter' && riddleAnswer.trim()) handleRiddleSubmit(); }}
            />
            <Button variant="happy" block disabled={hunt.busy || !riddleAnswer.trim()} onClick={handleRiddleSubmit}>
              {hunt.busy ? 'Checking…' : '✅ Submit answer'}
            </Button>
            {canSkip(step) && (
              <Button variant="ghost" onClick={hunt.skip} disabled={hunt.busy}>
                ⏭ Skip
              </Button>
            )}
          </>
        )}

        {/* ── Jigsaw: text guess + camera + help + dispute ────────────────── */}
        {item.kind === 'jigsaw' && (
          <>
            {riddleError && <Banner tone="no">{riddleError}</Banner>}
            {hunt.lastVerdict && !hunt.lastVerdict.match && (
              <Banner tone="no">🤔 {hunt.lastVerdict.reason}</Banner>
            )}
            <input
              value={riddleAnswer}
              onChange={(e) => setRiddleAnswer(e.target.value)}
              placeholder="What do you think this shows?"
              disabled={hunt.busy}
              onKeyDown={(e) => { if (e.key === 'Enter' && riddleAnswer.trim()) handleRiddleSubmit(); }}
            />
            <Button variant="happy" block disabled={hunt.busy || !riddleAnswer.trim()} onClick={handleRiddleSubmit}>
              {hunt.busy ? 'Checking…' : '✅ Guess what it shows'}
            </Button>
            <PhotoCapture onCapture={(f) => hunt.submitPhoto(f)} variant="accent" disabled={hunt.busy}>
              📸 Go find it — take a photo
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
              {hunt.lastVerdict && !hunt.lastVerdict.match && (
                <Button variant="ghost" disabled={hunt.busy} onClick={() => setDisputeConfirm(true)}>
                  🙋 I really found it!
                </Button>
              )}
              {canSkip(step) && (
                <Button variant="ghost" onClick={hunt.skip} disabled={hunt.busy}>⏭ Skip</Button>
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
              {hunt.busy ? '🔎 Checking…' : '📸 I found it — take a photo'}
            </PhotoCapture>

            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <Button variant="accent" onClick={hunt.useHelp} disabled={hunt.busy || step.helpLevel >= HelpLevel.Surroundings}>
                💡 Help me
              </Button>
              {hunt.lastVerdict && !hunt.lastVerdict.match && (
                <Button variant="ghost" disabled={hunt.busy} onClick={() => setDisputeConfirm(true)}>
                  🙋 I really found it!
                </Button>
              )}
              {canSkip(step) && (
                <Button variant="ghost" onClick={hunt.skip} disabled={hunt.busy}>
                  ⏭ Skip
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
    </Page>
  );
}

/** Renders help appropriate to the unlocked level (map, then descriptions). */
function HelpPanel({ item, step, hunterLoc }: { item: Item; step: { helpLevel: HelpLevel }; hunterLoc?: GeoPoint }) {
  if (step.helpLevel === HelpLevel.None) return null;

  return (
    <Card>
      <div className="stack">
        <span className="field-label">💡 Help</span>
        {step.helpLevel >= HelpLevel.MapDot && item.location && (
          <MapView
            target={item.location}
            hunter={hunterLoc}
            showRoute={step.helpLevel >= HelpLevel.RouteLine}
          />
        )}
        {step.helpLevel >= HelpLevel.MapDot && !item.location && (
          <Banner tone="info">This item has no map location — read the clues below!</Banner>
        )}
        {step.helpLevel >= HelpLevel.Describe && item.description && (
          <p style={{ margin: 0 }}>📝 {item.description}</p>
        )}
        {step.helpLevel >= HelpLevel.Surroundings && (
          <p className="muted" style={{ margin: 0 }}>
            You're very close! Look high and low, behind and underneath things.
          </p>
        )}
      </div>
    </Card>
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
