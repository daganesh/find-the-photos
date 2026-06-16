import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { GeoPoint, Item } from '@ftp/shared';
import { HelpLevel, canSkip, isHuntComplete, scoreStep } from '@ftp/shared';
import { api } from '../services/apiClient.js';
import { playSuccessSound } from '../services/sounds.js';
import { useAsync } from '../hooks/useAsync.js';
import { useHunt } from '../hooks/useHunt.js';
import { getCurrentLocation } from '../services/geolocation.js';
import {
  Banner,
  Button,
  Card,
  Fireworks,
  HintView,
  MapView,
  Page,
  PhotoCapture,
  ScorePill,
  Spinner,
  Timer,
} from '../ui/index.js';

/** The hunter flow: lobby → play → celebrate → results. */
export function HuntPlayer() {
  const { routeId = '' } = useParams();
  const navigate = useNavigate();
  const route = useAsync(() => api.getRoute(routeId), [routeId]);
  const hunt = useHunt(routeId);

  const [celebrateId, setCelebrateId] = useState<string | null>(null);
  const [hunterLoc, setHunterLoc] = useState<GeoPoint | undefined>();
  const prevFound = useRef(0);
  const [countdown, setCountdown] = useState(0);
  const countdownStartedRef = useRef(false);
  const [disputeConfirm, setDisputeConfirm] = useState(false);

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

  // Start 5-second countdown when session first appears.
  useEffect(() => {
    if (hunt.session && !countdownStartedRef.current) {
      countdownStartedRef.current = true;
      setCountdown(5);
      const tick = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) { clearInterval(tick); return 0; }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(tick);
    }
  }, [hunt.session]);

  // Fetch the device location once we reach a map-help level.
  const helpLevel = hunt.activeStep?.helpLevel ?? HelpLevel.None;
  useEffect(() => {
    if (helpLevel >= HelpLevel.MapDot && !hunterLoc) {
      getCurrentLocation().then(setHunterLoc);
    }
  }, [helpLevel, hunterLoc]);

  // Reset dispute confirm when verdict changes.
  useEffect(() => { setDisputeConfirm(false); }, [hunt.lastVerdict]);

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

  if (hunt.session && countdown > 0) {
    return (
      <Page title="Get ready!">
        <div className="stack center" style={{ paddingTop: 60 }}>
          <div style={{
            fontSize: '7rem', fontWeight: 900,
            color: 'var(--color-happy)',
            animation: 'pop-in 0.3s ease',
            lineHeight: 1,
          }}>
            {countdown}
          </div>
          <p className="muted" style={{ fontSize: '1.2rem' }}>Hunt starts in…</p>
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

  const items = routeData.items;
  const session = hunt.session;
  const skippedSteps = session.steps.filter((s) => s.status === 'skipped');
  const complete = isHuntComplete(session.steps);

  // ── Hunt finished ───────────────────────────────────────────────────────
  if (complete && !celebrateId) {
    return (
      <Page title="Done!">
        <Fireworks />
        <FinishedCard
          total={session.totalScore}
          onSeeResults={() => navigate(`/results/${routeId}`, { state: { session } })}
        />
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
          <Timer startedAt={session.startedAt} paused={hunt.paused} />
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
        <Card>
          <div className="stack">
            <span className="field-label">Your clue</span>
            <HintView hint={item.hint} extraHints={item.extraHints} />
          </div>
        </Card>

        <HelpPanel item={item} step={step} hunterLoc={hunterLoc} />

        {hunt.lastVerdict && !hunt.lastVerdict.match && (
          <Banner tone="no">🤔 {hunt.lastVerdict.reason} Try another angle, or get help!</Banner>
        )}
        {hunt.error && <Banner tone="no">{hunt.error}</Banner>}

        {disputeConfirm && (
          <Card>
            <div className="stack">
              <strong>Confirm: I found this!</strong>
              {item.description
                ? <p style={{ margin: 0 }}>{item.description}</p>
                : <p className="muted" style={{ margin: 0 }}>No description available.</p>
              }
              <div className="row">
                <Button variant="happy" disabled={hunt.busy} onClick={async () => {
                  setDisputeConfirm(false);
                  await hunt.dispute();
                }}>
                  ✅ Yes, I found it
                </Button>
                <Button variant="ghost" onClick={() => setDisputeConfirm(false)}>
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
