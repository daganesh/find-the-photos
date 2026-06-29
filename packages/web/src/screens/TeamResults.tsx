import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { HuntSession, Team, TeamResult } from '@ftp/shared';
import { computeTeamResult } from '@ftp/shared';
import { api } from '../services/apiClient.js';
import { renderScoreCard, shareScore } from '../services/scoreCard.js';
import { useAsync } from '../hooks/useAsync.js';
import { Banner, Button, Card, MemoryLane, Page, ScorePill, Spinner, StarRating, formatDuration } from '../ui/index.js';

/** Team results screen: per-member leaderboard, MVP badge, total score + time. */
export function TeamResults() {
  const { teamId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const passedSession = (location.state as { session?: HuntSession } | null)?.session;

  const [result, setResult] = useState<TeamResult>();
  const [team, setTeam] = useState<Team>();
  const [session, setSession] = useState<HuntSession>();
  const [routeId, setRouteId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [sharing, setSharing] = useState(false);
  const [summaryUrl, setSummaryUrl] = useState<string | null>(null);
  const [renderingCard, setRenderingCard] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [rated, setRated] = useState(false);
  const [rating, setRating] = useState(false);
  const [showMemoryLane, setShowMemoryLane] = useState(false);

  const route = useAsync(() => routeId ? api.getRoute(routeId) : Promise.resolve(undefined), [routeId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const t = await api.getTeam(teamId);
        if (!t.sessionId) throw new Error('No session found for this team');
        const { session: s } = await api.getHunt(t.sessionId);
        if (!cancelled) {
          setTeam(t);
          setSession(s);
          setRouteId(s.routeId);
          setResult(computeTeamResult(t, s));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load results');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [teamId]);

  async function submitRating() {
    if (!routeId) return;
    setRating(true);
    try {
      await api.rateRoute(routeId, { stars, comment: comment.trim() || undefined });
      setRated(true);
    } finally {
      setRating(false);
    }
  }

  async function handleShowSummary() {
    if (!result || !session || !route.data) return;
    setRenderingCard(true);
    try {
      const nameMap = new Map(route.data.items.map((i) => [i.id, i.name]));
      const playUrl = `${window.location.origin}/play/${session.routeId}`;
      const blob = await renderScoreCard(route.data.title, session, nameMap, playUrl, team, result);
      if (summaryUrl) URL.revokeObjectURL(summaryUrl);
      setSummaryUrl(URL.createObjectURL(blob));
    } finally {
      setRenderingCard(false);
    }
  }

  async function handleShare() {
    if (!result || !session || !route.data) return;
    setSharing(true);
    try {
      const nameMap = new Map(route.data.items.map((i) => [i.id, i.name]));
      const playUrl = `${window.location.origin}/play/${session.routeId}`;
      await shareScore(route.data.title, session, nameMap, playUrl, team, result);
    } catch {
      // Share cancelled or not supported — silently ignore.
    } finally {
      setSharing(false);
    }
  }

  if (loading) return <Page title="Team Results"><Spinner /></Page>;
  if (error || !result) {
    return (
      <Page onBack title="Team Results">
        <Banner tone="no">{error ?? 'Results unavailable'}</Banner>
        <Button block onClick={() => navigate('/')}>Back home</Button>
      </Page>
    );
  }

  const isMvp = (userId: string) => userId === result.mvpUserId;

  if (showMemoryLane && route.data && session) {
    return (
      <MemoryLane
        route={route.data}
        session={session}
        members={team?.members}
        onClose={() => setShowMemoryLane(false)}
      />
    );
  }

  return (
    <Page title={result.teamName}>
      <div className="stack">
        {/* Team summary */}
        <Card>
          <div className="stack center">
            {result.teamPhotoUrl ? (
              <img src={result.teamPhotoUrl} alt={result.teamName}
                style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ fontSize: '3rem' }}>🏆</div>
            )}
            <ScorePill score={result.totalScore} />
            {result.totalSeconds !== undefined && (
              <p className="muted">Total time: {formatDuration(result.totalSeconds)}</p>
            )}
            {summaryUrl ? (
              <div className="stack">
                <img src={summaryUrl} alt="Score card" style={{ width: '100%', borderRadius: 'var(--radius)', border: '1px solid var(--color-line)' }} />
                <Button variant="accent" block disabled={sharing} onClick={handleShare}>
                  {sharing ? 'Sharing…' : '📤 Share this'}
                </Button>
                <Button variant="ghost" block onClick={() => { URL.revokeObjectURL(summaryUrl); setSummaryUrl(null); }}>
                  Hide summary
                </Button>
              </div>
            ) : (
              <>
                <Button variant="accent" block disabled={renderingCard || route.loading} onClick={handleShowSummary}>
                  {renderingCard ? 'Creating…' : '🖼 Show Summary'}
                </Button>
                <Button variant="ghost" block disabled={sharing} onClick={handleShare}>
                  {sharing ? 'Creating polaroid…' : '📤 Share polaroid'}
                </Button>
              </>
            )}
          </div>
        </Card>

        <Button variant="ghost" block onClick={() => setShowMemoryLane(true)}>
          🎞️ Memory Lane
        </Button>

        {/* Member leaderboard */}
        <h2>Team leaderboard</h2>
        {result.memberScores.map((ms, rank) => (
          <Card key={ms.userId}>
            <div className="row" style={{ alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '1.3rem', minWidth: 32 }}>
                {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `#${rank + 1}`}
              </span>
              <span style={{ fontSize: '1.4rem' }}>{ms.avatarEmoji ?? '🧑'}</span>
              <div style={{ flex: 1 }}>
                <strong>{ms.name}</strong>
                {isMvp(ms.userId) && ms.itemsFound > 0 && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: '0.75rem',
                      background: 'var(--color-happy)',
                      color: '#fff',
                      borderRadius: 12,
                      padding: '2px 8px',
                      fontWeight: 700,
                    }}
                  >
                    ⚡ MVP
                  </span>
                )}
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                  {ms.itemsFound} item{ms.itemsFound !== 1 ? 's' : ''} found
                </div>
              </div>
              <ScorePill score={ms.totalScore} />
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
