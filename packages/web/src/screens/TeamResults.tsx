import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { HuntSession, Team, TeamResult } from '@ftp/shared';
import { computeTeamResult } from '@ftp/shared';
import { api } from '../services/apiClient.js';
import { shareScore } from '../services/scoreCard.js';
import { useAsync } from '../hooks/useAsync.js';
import { Banner, Button, Card, Page, ScorePill, Spinner, formatDuration } from '../ui/index.js';

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

  const mvp = result.memberScores[0];
  const isMvp = (userId: string) => userId === result.mvpUserId;

  return (
    <Page title="Team Results">
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
            <h2>{result.teamName}</h2>
            <ScorePill score={result.totalScore} />
            {result.totalSeconds !== undefined && (
              <p className="muted">Total time: {formatDuration(result.totalSeconds)}</p>
            )}
            <Button variant="accent" block disabled={sharing || route.loading} onClick={handleShare}>
              {sharing ? 'Creating polaroid…' : '📤 Share polaroid'}
            </Button>
          </div>
        </Card>

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

        <Button variant="ghost" block onClick={() => navigate('/')}>🏠 Back home</Button>
      </div>
    </Page>
  );
}
