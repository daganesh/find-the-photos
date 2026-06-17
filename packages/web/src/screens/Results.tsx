import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { HuntSession } from '@ftp/shared';
import { scoreStep, stepStars } from '@ftp/shared';
import { api } from '../services/apiClient.js';
import { renderScoreCard, shareScore } from '../services/scoreCard.js';
import { useAsync } from '../hooks/useAsync.js';
import { Button, Card, Page, ScorePill, Spinner, StarRating, formatDuration } from '../ui/index.js';

/** End-of-hunt: per-item scores, total time, share, and rate-the-route. */
export function Results() {
  const { routeId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const session = (location.state as { session?: HuntSession } | null)?.session;
  const route = useAsync(() => api.getRoute(routeId), [routeId]);

  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [rated, setRated] = useState(false);
  const [rating, setRating] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [summaryUrl, setSummaryUrl] = useState<string | null>(null);
  const [renderingCard, setRenderingCard] = useState(false);

  const totalSeconds = useMemo(() => {
    if (!session?.finishedAt) return undefined;
    return (new Date(session.finishedAt).getTime() - new Date(session.startedAt).getTime()) / 1000;
  }, [session]);

  if (route.loading) return <Page title="Results"><Spinner /></Page>;
  if (!session || !route.data) {
    return (
      <Page onBack title="Results">
        <Card><p className="center muted">We couldn't find your results. 🤷</p></Card>
        <Button block onClick={() => navigate('/')}>Back home</Button>
      </Page>
    );
  }

  const items = route.data.items;
  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? 'Item';
  const stepSeconds = (s: HuntSession['steps'][number]): number | undefined =>
    s.startedAt && s.finishedAt
      ? (new Date(s.finishedAt).getTime() - new Date(s.startedAt).getTime()) / 1000
      : undefined;

  async function submitRating() {
    setRating(true);
    try {
      await api.rateRoute(routeId, { stars, comment: comment.trim() || undefined });
      setRated(true);
    } finally {
      setRating(false);
    }
  }

  async function handleShowSummary() {
    setRenderingCard(true);
    try {
      const nameMap = new Map(items.map((i) => [i.id, i.name]));
      const playUrl = `${window.location.origin}/play/${routeId}`;
      const blob = await renderScoreCard(route.data!.title, session!, nameMap, playUrl);
      if (summaryUrl) URL.revokeObjectURL(summaryUrl);
      setSummaryUrl(URL.createObjectURL(blob));
    } catch {
      // Fail silently — share button still available
    } finally {
      setRenderingCard(false);
    }
  }

  async function handleShare() {
    setSharing(true);
    try {
      const playUrl = `${window.location.origin}/play/${routeId}`;
      if (summaryUrl) {
        // Re-use the already-rendered blob for sharing
        const resp = await fetch(summaryUrl);
        const blob = await resp.blob();
        const file = new File([blob], 'hunt-score.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: `I scored ${session!.totalScore} pts on "${route.data!.title}"!` });
          return;
        }
      }
      await shareScore(route.data!.title, session!, nameMap(), playUrl);
    } catch {
      // Share cancelled or not supported — silently ignore.
    } finally {
      setSharing(false);
    }
  }

  return (
    <Page title="Your results">
      <div className="stack">
        <Card>
          <div className="stack center">
            <div style={{ fontSize: '3rem' }}>🏆</div>
            <h2>{route.data.title}</h2>
            <ScorePill score={session.totalScore} />
            {totalSeconds !== undefined && <p className="muted">Total time: {formatDuration(totalSeconds)}</p>}
            {summaryUrl ? (
              <div className="stack">
                <img src={summaryUrl} alt="Score card" style={{ width: '100%', borderRadius: 'var(--radius)', display: 'block' }} />
                <div className="row" style={{ gap: 8 }}>
                  <Button variant="accent" style={{ flex: 1 }} disabled={sharing} onClick={handleShare}>
                    {sharing ? 'Sharing…' : '📤 Share this'}
                  </Button>
                  <Button variant="ghost" onClick={() => { URL.revokeObjectURL(summaryUrl); setSummaryUrl(null); }}>
                    Hide
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Button variant="accent" block disabled={renderingCard} onClick={handleShowSummary}>
                  {renderingCard ? 'Creating…' : '🖼 Show Summary'}
                </Button>
                <Button variant="ghost" block disabled={sharing} onClick={handleShare}>
                  {sharing ? 'Creating image…' : '📤 Share score'}
                </Button>
              </>
            )}
          </div>
        </Card>

        <h2>How you did</h2>
        {session.steps.map((step, i) => (
          <Card key={step.itemId}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <strong>{i + 1}. {itemName(step.itemId)}</strong>
                <div className="muted">
                  {step.status === 'skipped' ? 'Skipped' : `${'⭐'.repeat(stepStars(step)) || '—'}`}
                  {stepSeconds(step) !== undefined && ` · ⏱ ${formatDuration(stepSeconds(step)!)}`}
                  {step.disputed && ' · you overruled the AI 🙋'}
                </div>
              </div>
              <span className="muted" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>⭐ {scoreStep(step)}</span>
            </div>
          </Card>
        ))}

        <h2>Rate this hunt</h2>
        <Card>
          {rated ? (
            <p className="center">Thanks for the feedback! 💛</p>
          ) : (
            <div className="stack center">
              <StarRating value={stars} onChange={setStars} />
              <textarea
                rows={2}
                placeholder="Leave a note for the hider (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <Button block disabled={stars === 0 || rating} onClick={submitRating}>
                {rating ? 'Sending…' : 'Send rating'}
              </Button>
            </div>
          )}
        </Card>

        <Button variant="ghost" block onClick={() => navigate('/')}>🏠 Back home</Button>
      </div>
    </Page>
  );
}
