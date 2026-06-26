import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { HuntSession } from '@ftp/shared';
import { SCORING, canSkip, getJigsawGridSize, isHuntComplete, scoreStep } from '@ftp/shared';
import { useAuth } from '../auth/AuthContext.js';
import { api } from '../services/apiClient.js';
import { playSuccessSound } from '../services/sounds.js';
import { useAsync } from '../hooks/useAsync.js';
import { useTeamHunt } from '../hooks/useTeamHunt.js';
import {
  Banner,
  Button,
  Card,
  FinalItemPanel,
  Fireworks,
  GuessToastOverlay,
  HintView,
  HuntTrail,
  ItemHistoryPanel,
  JigsawView,
  Page,
  PhotoCapture,
  ScorePill,
  Spinner,
  TeamChat,
  ThinkingOverlay,
  Timer,
} from '../ui/index.js';
import { mediaUrl } from '../services/media.js';
import type { GuessToastData } from '../ui/index.js';
import {
  TOAST_BG_COLORS,
  buildToastResultLine,
  pickRandom,
  randomTilt,
} from '../ui/GuessToast.js';
import { googleMapsLink } from '../services/maps.js';

/**
 * Team hunt play screen.
 *
 * URL: /team/:teamId/play
 *
 * Shows all N active items so any team member can pick one to hunt.
 * Polls the shared session every 3 s to reflect other players' progress.
 */
export function TeamHuntPlayer() {
  const { teamId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Load the team first to get the sessionId.
  const [sessionId, setSessionId] = useState<string>();
  const [teamLoadError, setTeamLoadError] = useState<string>();

  useEffect(() => {
    api.getTeam(teamId)
      .then((t) => {
        if (t.sessionId) setSessionId(t.sessionId);
        else navigate(`/team/${teamId}`, { replace: true });
      })
      .catch(() => setTeamLoadError('Could not load team. Please try again.'));
  }, [teamId, navigate]);

  if (teamLoadError) {
    return <Page onBack title="Hunt"><Banner tone="no">{teamLoadError}</Banner></Page>;
  }
  if (!sessionId) {
    return <Page title="Loading…"><Spinner label="Loading team hunt…" /></Page>;
  }

  return <TeamHuntInner teamId={teamId} sessionId={sessionId} />;
}

/** Inner component rendered once sessionId is known. */
function TeamHuntInner({ teamId, sessionId }: { teamId: string; sessionId: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const hunt = useTeamHunt(teamId, sessionId);
  const route = useAsync(() => hunt.session ? api.getRoute(hunt.session.routeId) : Promise.resolve(undefined), [hunt.session?.routeId]);

  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [celebrateItemId, setCelebrateItemId] = useState<string | null>(null);
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [disputeConfirm, setDisputeConfirm] = useState(false);
  const [disputeDesc, setDisputeDesc] = useState('');
  const [disputeError, setDisputeError] = useState('');
  const [riddleAnswer, setRiddleAnswer] = useState('');
  const [riddleError, setRiddleError] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [jigsawDisplayDifficulty, setJigsawDisplayDifficulty] = useState<1 | 2 | 3>(3);
  const [finalItemSkipped, setFinalItemSkipped] = useState(false);
  const [prizeAcknowledged, setPrizeAcknowledged] = useState(false);

  // Guard the browser back button while the team hunt is active.
  const isHuntActive = Boolean(
    hunt.session && !isHuntComplete(hunt.session.steps),
  );
  useEffect(() => {
    if (!isHuntActive) return;
    window.history.pushState({ huntGuard: true }, '');
    const onPop = () => {
      window.history.pushState({ huntGuard: true }, '');
      setConfirmLeave(true);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [isHuntActive]);

  // ── Guess toast queue ──────────────────────────────────────────────────
  const [toastQueue, setToastQueue] = useState<GuessToastData[]>([]);
  const prevSessionRef = useRef<HuntSession | undefined>();
  const detectionReadyRef = useRef(false);

  // Detect new photo attempts and riddle solves from teammates via polling.
  useEffect(() => {
    if (!hunt.session || !hunt.team || !route.data) return;

    // First time all data is ready: snapshot without firing toasts.
    if (!detectionReadyRef.current) {
      prevSessionRef.current = hunt.session;
      detectionReadyRef.current = true;
      return;
    }

    const prev = prevSessionRef.current;
    prevSessionRef.current = hunt.session;
    if (!prev) return;

    const newToasts: GuessToastData[] = [];

    for (const step of hunt.session.steps) {
      const prevStep = prev.steps.find((s) => s.itemId === step.itemId);
      const item = route.data!.items.find((i) => i.id === step.itemId);

      // New photo attempts by teammates.
      const prevCount = prevStep?.photoAttempts.length ?? 0;
      const fresh = step.photoAttempts.slice(prevCount);
      for (const attempt of fresh) {
        if (attempt.submittedBy === user?.id) continue; // own attempt shown inline
        const member = hunt.team!.members.find((m) => m.userId === attempt.submittedBy);
        newToasts.push({
          id: `${step.itemId}-${attempt.at}`,
          playerName: member?.name.split(' ')[0] ?? 'Someone',
          playerEmoji: member?.avatarEmoji ?? '🧑',
          photoUrl: attempt.photoUrl,
          correct: attempt.verdict.match,
          bgColor: pickRandom(TOAST_BG_COLORS),
          tilt: randomTilt(6),
          innerTilt: randomTilt(8),
          resultLine: buildToastResultLine(attempt.photoUrl, attempt.verdict.match),
        });
      }

      // Riddle/task solved by a teammate (no new photo attempt — text answer).
      const wasPrevFound = prevStep?.status === 'found';
      const isNowFound = step.status === 'found';
      const hasPhotoMatch = fresh.some((a) => a.verdict.match);
      if (isNowFound && !wasPrevFound && !hasPhotoMatch && step.foundBy !== user?.id) {
        const member = hunt.team!.members.find((m) => m.userId === step.foundBy);
        newToasts.push({
          id: `${step.itemId}-solved`,
          playerName: member?.name.split(' ')[0] ?? 'Someone',
          playerEmoji: member?.avatarEmoji ?? '🧑',
          textContent: item?.name ?? 'the riddle',
          correct: true,
          bgColor: pickRandom(TOAST_BG_COLORS),
          tilt: randomTilt(6),
          innerTilt: randomTilt(8),
          resultLine: buildToastResultLine(undefined, true),
        });
      }
    }

    if (newToasts.length > 0) {
      setToastQueue((q) => [...q, ...newToasts]);
    }
  }, [hunt.session, hunt.team, route.data, user?.id]);

  // Auto-dismiss the current toast after 4.5 s.
  useEffect(() => {
    if (toastQueue.length === 0) return;
    const t = setTimeout(() => setToastQueue((q) => q.slice(1)), 4500);
    return () => clearTimeout(t);
  }, [toastQueue]);

  // ── Celebrate when the current user's photo matches ────────────────────
  // Celebrate when the current user's photo matches.
  useEffect(() => {
    if (hunt.lastVerdict?.verdict.match) {
      setCelebrateItemId(hunt.lastVerdict.itemId);
      setFocusedItemId(null);
      playSuccessSound();
    }
  }, [hunt.lastVerdict]);

  useEffect(() => {
    if (!hunt.team?.startedAt) return;
    function calc() {
      const elapsed = Date.now() - new Date(hunt.team!.startedAt!).getTime();
      return Math.max(0, Math.ceil((5000 - elapsed) / 1000));
    }
    const initial = calc();
    if (initial <= 0) return;
    setCountdown(initial);
    const tick = setInterval(() => {
      const rem = calc();
      setCountdown(rem);
      if (rem <= 0) clearInterval(tick);
    }, 200);
    return () => clearInterval(tick);
  }, [hunt.team?.startedAt]);

  // Reset dispute confirm when verdict or focused item changes.
  useEffect(() => { setDisputeConfirm(false); setDisputeDesc(''); setDisputeError(''); }, [hunt.lastVerdict, focusedItemId]);

  // Reset riddle state and jigsaw difficulty when focused item changes.
  useEffect(() => {
    setRiddleAnswer('');
    setRiddleError('');
    const step = hunt.session?.steps.find((s) => s.itemId === focusedItemId);
    setJigsawDisplayDifficulty(Math.max(1, 3 - (step?.cluesUsed ?? 0)) as 1 | 2 | 3);
  }, [focusedItemId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRiddleSubmit() {
    if (!focusedItemId) return;
    setRiddleError('');
    try {
      await hunt.submitRiddleAnswer(focusedItemId, riddleAnswer.trim());
    } catch (e) {
      setRiddleError(e instanceof Error ? e.message : 'Not quite — try again!');
    }
  }

  async function handleDispute() {
    if (!focusedItemId) return;
    setDisputeError('');
    try {
      await hunt.dispute(focusedItemId, disputeDesc.trim());
      setDisputeConfirm(false);
      setDisputeDesc('');
    } catch (e) {
      setDisputeError(e instanceof Error ? e.message : 'Could not verify — please try again.');
    }
  }

  // Floating guess toast — rendered outside the Page tree so it overlays everything.
  const currentToast = toastQueue[0];

  if (!hunt.session || !route.data) {
    return <Page title="Hunt"><Spinner label="Loading…" /></Page>;
  }

  const { session, team } = hunt;
  const items = route.data.items;
  const complete = isHuntComplete(session.steps);
  const paused = team?.status === 'paused';

  // Trail map data — follows session.steps order.
  const trailItems = session.steps.map((st) => {
    const it = items.find((i) => i.id === st.itemId);
    const foundPhoto = st.photoAttempts.filter((a) => a.verdict.match).at(-1)?.photoUrl;
    return { id: st.itemId, name: it?.name ?? 'Item', completed: st.status === 'found', thumbnail: foundPhoto };
  });
  const firstActiveIdx = session.steps.findIndex((s) => s.status === 'active');
  const trailCurrentIndex = firstActiveIdx >= 0 ? firstActiveIdx : session.steps.length - 1;

  function handleTrailSelect(idx: number) {
    const st = session.steps[idx];
    if (!st) return;
    if (st.status === 'active') setFocusedItemId(st.itemId);
    if (st.status === 'found') setHistoryItemId(st.itemId);
  }

  /** Wraps an active hunt screen with the guess toast overlay and team chat. */
  const withToast = (el: React.ReactElement, showChat = false) => (
    <>
      <ThinkingOverlay visible={hunt.busy} />
      {currentToast && (
        <GuessToastOverlay
          toast={currentToast}
          onDismiss={() => setToastQueue((q) => q.slice(1))}
        />
      )}
      {showChat && team && (
        <TeamChat teamId={teamId} members={team.members} />
      )}
      {el}
    </>
  );

  if (confirmLeave) {
    return (
      <Page title="Leave hunt?">
        <Card>
          <div className="stack center">
            <div style={{ fontSize: '2.5rem' }}>🚪</div>
            <h3 style={{ margin: 0 }}>Leave the team hunt?</h3>
            <p className="muted" style={{ margin: 0, textAlign: 'center' }}>
              Your team can continue without you. Rejoin anytime from the home screen.
            </p>
            <Button block variant="ghost" style={{ color: 'var(--color-danger, #ef4444)' }}
              onClick={() => navigate('/')}>
              Leave hunt
            </Button>
            <Button block variant="happy" onClick={() => setConfirmLeave(false)}>
              Keep playing
            </Button>
          </div>
        </Card>
      </Page>
    );
  }

  if (countdown > 0) {
    return withToast(
      <Page title="Get ready!">
        <div className="countdown-wrap">
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-ink-soft)', margin: 0 }}>
            Get ready!
          </p>
          <div className="countdown-digit" key={countdown}>{countdown}</div>
          <p className="muted" style={{ margin: 0 }}>Hunt starts in…</p>
        </div>
      </Page>,
      true,
    );
  }

  // Final challenge gate — shown after all steps are complete, before results.
  if (complete && !celebrateItemId) {
    const hasFinalItem = Boolean(route.data.finalItem);
    const finalDone = !hasFinalItem || (!!session.finalItemSolved && prizeAcknowledged) || finalItemSkipped;
    if (hasFinalItem && !finalDone) {
      return withToast(
        <Page title={session.finalItemSolved ? '🎁 Your prize!' : '🏆 Final challenge!'}>
          <div className="stack">
            <FinalItemPanel
              finalItem={route.data.finalItem!}
              items={items}
              solvedItemIds={new Set(session.steps.filter((s) => s.status === 'found').map((s) => s.itemId))}
              onSolve={hunt.solveFinalItem}
              solved={!!session.finalItemSolved}
              busy={hunt.busy}
              defaultExpanded
              onPrizeContinue={() => setPrizeAcknowledged(true)}
            />
            {!session.finalItemSolved && (
              <Button variant="ghost" block onClick={() => setFinalItemSkipped(true)}>
                Skip final challenge
              </Button>
            )}
          </div>
        </Page>,
        true,
      );
    }
  }

  // Navigate to results when done (after user dismisses celebration).
  if (complete && !celebrateItemId) {
    return withToast(
      <Page title="Done!">
        <Fireworks />
        <Card>
          <div className="stack center pop-in">
            <div style={{ fontSize: '3.5rem' }}>🏆</div>
            <h2>Hunt complete!</h2>
            {session.finalItemSolved && (
              <strong>Final item solved! +100 bonus points!</strong>
            )}
            <ScorePill score={session.totalScore} />
            <Button size="lg" block variant="happy"
              onClick={() => navigate(`/team/${teamId}/results`, { state: { session, teamId } })}>
              See team results
            </Button>
          </div>
        </Card>
      </Page>,
      true,
    );
  }

  if (celebrateItemId) {
    const item = items.find((i) => i.id === celebrateItemId);
    const step = session.steps.find((s) => s.itemId === celebrateItemId);
    return withToast(
      <Page title="Great find!">
        <Card>
          <div className="stack center pop-in">
            <div style={{ fontSize: '3.5rem' }}>🎉</div>
            <h2>You found {item?.name}!</h2>
            {step && <ScorePill score={scoreStep(step)} max={100} />}
            <Button size="lg" block variant="happy" onClick={() => setCelebrateItemId(null)}>
              {complete ? '🏁 See team results' : '➡️ Next item'}
            </Button>
          </div>
        </Card>
      </Page>,
      true,
    );
  }

  if (paused) {
    return withToast(
      <Page title="Paused ⏸">
        <Card>
          <div className="stack center">
            <div style={{ fontSize: '3rem' }}>⏸️</div>
            <h2>Hunt paused</h2>
            <p className="muted">Anyone can resume.</p>
            <Button size="lg" block variant="happy" onClick={hunt.pauseOrResume}>▶ Resume</Button>
          </div>
        </Card>
      </Page>,
      true,
    );
  }

  // ── Item history (tap a found trail node) ─────────────────────────────────
  if (historyItemId) {
    const histStep = session.steps.find((s) => s.itemId === historyItemId);
    const histItem = items.find((i) => i.id === historyItemId);
    const histIdx = session.steps.findIndex((s) => s.itemId === historyItemId);
    if (histStep && histItem) {
      return withToast(
        <ItemHistoryPanel
          step={histStep}
          itemName={histItem.name}
          stepNum={histIdx + 1}
          onClose={() => setHistoryItemId(null)}
          members={team?.members}
        />,
      );
    }
  }

  // ── Single-item hunt view ─────────────────────────────────────────────────
  if (focusedItemId) {
    const step = session.steps.find((s) => s.itemId === focusedItemId);
    const item = items.find((i) => i.id === focusedItemId);

    if (!step || !item || step.status !== 'active') {
      setFocusedItemId(null);
      return null;
    }

    const stepNum = session.steps.findIndex((s) => s.itemId === focusedItemId) + 1;
    const verdict = hunt.lastVerdict?.itemId === focusedItemId ? hunt.lastVerdict.verdict : undefined;

    return withToast(<Page
        onBack={() => setFocusedItemId(null)}
        title={`Clue ${stepNum}`}
        right={
          <div className="row" style={{ gap: 8 }}>
            {team?.startedAt && <Timer startedAt={team.startedAt} paused={paused} />}
            <button className="btn btn--ghost" style={{ minWidth: 40, padding: '0 10px', fontSize: '1.1rem' }}
              onClick={() => setConfirmLeave(true)} aria-label="Leave hunt">🚪</button>
            <button className="btn btn--ghost" style={{ minWidth: 40, padding: '0 10px', fontSize: '1.1rem' }}
              onClick={hunt.pauseOrResume} aria-label="Pause hunt">⏸</button>
          </div>
        }
      >
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start', paddingBottom: 68 }}>
        <div className="stack" style={{ flex: 1, minWidth: 0 }}>
          {item.kind === 'riddle' ? (
            <Card>
              <div className="stack">
                <span className="field-label">💭 Riddle</span>
                <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{item.hint.text}</p>
                {step.cluesUsed > 0 && (item.extraHints ?? []).slice(0, step.cluesUsed).filter((h) => h.text).length > 0 && (
                  <>
                    <span className="field-label" style={{ marginTop: 'var(--space-1)' }}>Clues</span>
                    {(item.extraHints ?? []).slice(0, step.cluesUsed).filter((h) => h.text).map((h, i) => (
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
                  gridSize={getJigsawGridSize(jigsawDisplayDifficulty)}
                  mode="scrambled"
                  difficulty={jigsawDisplayDifficulty}
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

          {riddleError && <Banner tone="no">{riddleError}</Banner>}
          {verdict && !verdict.match && item.kind !== 'riddle' && (
            <Banner tone="no">🤔 {verdict.reason} Try another angle, or get help!</Banner>
          )}
          {hunt.error && <Banner tone="no">{hunt.error}</Banner>}

          {item.kind === 'riddle' ? (
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
                <Button variant="accent"
                  disabled={hunt.busy || !item.extraHints?.length || step.cluesUsed >= (item.extraHints?.length ?? 0)}
                  onClick={() => hunt.useHelp(focusedItemId)}>
                  💡
                </Button>
                {canSkip(step) && (
                  <Button variant="ghost" disabled={hunt.busy} onClick={(e) => { e.stopPropagation(); hunt.skip(focusedItemId); }}>
                    ⏭
                  </Button>
                )}
              </div>
            </>
          ) : item.kind === 'jigsaw' ? (
            <>
              {verdict && !verdict.match && (
                <Banner tone="no">🤔 {verdict.reason}</Banner>
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
              <PhotoCapture onCapture={(f) => hunt.submitPhoto(focusedItemId, f)} variant="accent" disabled={hunt.busy}>
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
                {jigsawDisplayDifficulty > 1 ? (
                  <Button variant="ghost" disabled={hunt.busy} aria-label="Make easier"
                    onClick={() => {
                      setJigsawDisplayDifficulty((d) => Math.max(1, d - 1) as 1 | 2 | 3);
                      hunt.useHelp(focusedItemId);
                    }}>
                    🔽
                  </Button>
                ) : (
                  <span className="muted" style={{ fontSize: '0.8rem' }}>Lowest difficulty</span>
                )}
                {item.location && (
                  <a href={googleMapsLink(item.location.lat, item.location.lng)} target="_blank" rel="noreferrer" className="btn btn--accent">
                    📍
                  </a>
                )}
                {verdict && !verdict.match && (
                  <Button variant="ghost" disabled={hunt.busy} onClick={() => setDisputeConfirm(true)}>
                    🙋
                  </Button>
                )}
                {canSkip(step) && (
                  <Button variant="ghost" disabled={hunt.busy} onClick={() => hunt.skip(focusedItemId)}>
                    ⏭
                  </Button>
                )}
              </div>
            </>
          ) : (
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

              <PhotoCapture onCapture={(f) => hunt.submitPhoto(focusedItemId, f)} variant="happy" disabled={hunt.busy}>
                📸
              </PhotoCapture>

              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <Button variant="accent"
                  disabled={hunt.busy || !item.extraHints?.length || step.cluesUsed >= (item.extraHints?.length ?? 0)}
                  onClick={() => hunt.useHelp(focusedItemId)}>
                  💡
                </Button>
                {item.location && (
                  <a href={googleMapsLink(item.location.lat, item.location.lng)} target="_blank" rel="noreferrer" className="btn btn--accent">
                    📍
                  </a>
                )}
                {item.kind !== 'task' && verdict && !verdict.match && (
                  <Button variant="ghost" disabled={hunt.busy} onClick={() => setDisputeConfirm(true)}>
                    🙋
                  </Button>
                )}
                {canSkip(step) && (
                  <Button variant="ghost" disabled={hunt.busy} onClick={() => hunt.skip(focusedItemId)}>
                    ⏭
                  </Button>
                )}
              </div>
            </>
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
      </Page>, true);
  }

  // ── Active items grid ─────────────────────────────────────────────────────
  const activeSteps = session.steps.filter((s) => s.status === 'active');
  const skippedSteps = session.steps.filter((s) => s.status === 'skipped');
  const foundSteps = session.steps.filter((s) => s.status === 'found');
  const totalItems = session.steps.length;

  return withToast(<Page
      title={team?.name ?? 'Team Hunt'}
      right={
        <div className="row" style={{ gap: 8 }}>
          {team?.startedAt && <Timer startedAt={team.startedAt} paused={paused} />}
          <button className="btn btn--ghost" style={{ minWidth: 40, padding: '0 10px', fontSize: '1.1rem' }}
            onClick={() => setConfirmLeave(true)} aria-label="Leave hunt">🚪</button>
          <button className="btn btn--ghost" style={{ minWidth: 40, padding: '0 10px', fontSize: '1.1rem' }}
            onClick={hunt.pauseOrResume} aria-label="Pause hunt">⏸</button>
        </div>
      }
    >
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start', paddingBottom: 68 }}>
      <div className="stack" style={{ flex: 1, minWidth: 0 }}>
        {/* Team progress summary */}
        <Card>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span>🎯 {foundSteps.length} / {totalItems} found</span>
            <ScorePill score={session.totalScore} />
          </div>
          {/* Member scores */}
          {team && (
            <div className="row" style={{ marginTop: 10, gap: 12, flexWrap: 'wrap' }}>
              {team.members.map((m) => {
                const myFound = foundSteps.filter((s) => s.foundBy === m.userId).length;
                return (
                  <div key={m.userId} className="row" style={{ gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: '1.1rem' }}>{m.avatarEmoji ?? '🧑'}</span>
                    <span className="muted" style={{ fontSize: '0.85rem' }}>{m.name.split(' ')[0]}: {myFound}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {hunt.error && <Banner tone="no">{hunt.error}</Banner>}

        {/* Active items */}
        <h3 style={{ margin: 0 }}>Active clues</h3>
        {activeSteps.length === 0 ? (
          <Card><p className="center muted">No active clues right now — check back soon!</p></Card>
        ) : (
          activeSteps.map((step) => {
            const item = items.find((i) => i.id === step.itemId);
            if (!item) return null;
            const stepNum = session.steps.findIndex((s) => s.itemId === step.itemId) + 1;
            return (
              <Card key={step.itemId}>
                <div className="stack" style={{ gap: 8 }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <strong>Clue {stepNum}</strong>
                    {step.cluesUsed > 0 && (
                      <span className="muted" style={{ fontSize: '0.8rem' }}>{step.cluesUsed} clue{step.cluesUsed > 1 ? 's' : ''} used</span>
                    )}
                  </div>
                  <Button block variant="happy" onClick={() => setFocusedItemId(step.itemId)} aria-label="Hunt this one">
                    🔍
                  </Button>
                </div>
              </Card>
            );
          })
        )}

        {/* Skipped items */}
        {skippedSteps.length > 0 && (
          <>
            <h3 style={{ margin: 0 }}>⏭ Skipped</h3>
            {skippedSteps.map((step) => {
              const item = items.find((i) => i.id === step.itemId);
              if (!item) return null;
              return (
                <div key={step.itemId} className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="muted">{item.name}</span>
                  <Button variant="ghost" disabled={hunt.busy} onClick={() => hunt.returnToSkipped(step.itemId)}>
                    ↩ Try again
                  </Button>
                </div>
              );
            })}
          </>
        )}

        {/* Found items */}
        {foundSteps.length > 0 && (
          <>
            <h3 style={{ margin: 0 }}>✅ Found</h3>
            {foundSteps.map((step) => {
              const item = items.find((i) => i.id === step.itemId);
              const finder = team?.members.find((m) => m.userId === step.foundBy);
              return (
                <div key={step.itemId} className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{item?.name ?? step.itemId}</span>
                  <span className="muted" style={{ fontSize: '0.85rem' }}>
                    {finder ? `${finder.avatarEmoji ?? '🧑'} ${finder.name.split(' ')[0]} · ` : ''}
                    ⭐ {scoreStep(step)}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Trail map side rail */}
      <div style={{ width: 80, flexShrink: 0 }}>
        <HuntTrail
          items={trailItems}
          currentIndex={trailCurrentIndex}
          compact
          maxHeight={560}
          onSelectItem={handleTrailSelect}
        />
      </div>
      </div>
    </Page>, true);
}

