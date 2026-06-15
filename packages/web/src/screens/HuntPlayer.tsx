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

/** The hunter flow: read the clue, take a photo, get help, advance. */
export function HuntPlayer() {
  const { routeId = '' } = useParams();
  const navigate = useNavigate();
  const route = useAsync(() => api.getRoute(routeId), [routeId]);
  const hunt = useHunt(routeId);

  const [celebrateId, setCelebrateId] = useState<string | null>(null);
  const [hunterLoc, setHunterLoc] = useState<GeoPoint | undefined>();
  const prevFound = useRef(0);

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

  if (route.loading || hunt.loading) return <Page onBack title="Play"><Spinner label="Setting up your hunt…" /></Page>;
  if (route.error || !route.data) return <Page onBack title="Play"><p style={{ color: 'var(--color-danger)' }}>{route.error ?? 'Route not found'}</p></Page>;

  // Fix #1: show a proper error when the hunt session could not be started.
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

  const items = route.data.items;
  const session = hunt.session;
  const complete = isHuntComplete(session.steps);

  // Whole hunt finished → fireworks + summary card.
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

  // Celebrating a freshly found item.
  if (celebrateId) {
    const item = items.find((i) => i.id === celebrateId);
    const step = session.steps.find((s) => s.itemId === celebrateId);
    const last = complete;
    return (
      <Page title="Great find!">
        <Card>
          <div className="stack center pop-in">
            <div style={{ fontSize: '3.5rem' }}>🎉</div>
            <h2>You found {item?.name}!</h2>
            {step && <ScorePill score={scoreStep(step)} max={100} />}
            <Button size="lg" block variant="happy" onClick={() => setCelebrateId(null)}>
              {last ? '🏁 See your results' : '➡️ Next clue'}
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
      right={<Timer startedAt={session.startedAt} />}
    >
      <div className="stack">
        <Card>
          <div className="stack">
            <span className="field-label">Your clue</span>
            {/* Fix #5: show all hints (primary + extra) */}
            <HintView hint={item.hint} extraHints={item.extraHints} />
          </div>
        </Card>

        <HelpPanel item={item} step={step} hunterLoc={hunterLoc} />

        {hunt.lastVerdict && !hunt.lastVerdict.match && (
          <Banner tone="no">🤔 {hunt.lastVerdict.reason} Try another angle, or get help!</Banner>
        )}
        {hunt.error && <Banner tone="no">{hunt.error}</Banner>}

        <PhotoCapture onCapture={(f) => hunt.submitPhoto(f)} variant="happy" disabled={hunt.busy}>
          {hunt.busy ? '🔎 Checking…' : '📸 I found it — take a photo'}
        </PhotoCapture>

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <Button variant="accent" onClick={hunt.useHelp} disabled={hunt.busy || step.helpLevel >= HelpLevel.Surroundings}>
            💡 Help me
          </Button>
          {hunt.lastVerdict && !hunt.lastVerdict.match && (
            <Button variant="ghost" onClick={hunt.dispute} disabled={hunt.busy}>
              🙋 I really found it!
            </Button>
          )}
          {canSkip(step) && (
            <Button variant="ghost" onClick={hunt.skip} disabled={hunt.busy}>
              ⏭ Skip
            </Button>
          )}
        </div>
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
