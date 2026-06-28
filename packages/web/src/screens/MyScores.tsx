import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { api } from '../services/apiClient.js';
import { useAsync } from '../hooks/useAsync.js';
import { BottomBar, Card, Page, Spinner, StarRating, useSetPageHeader } from '../ui/index.js';
import type { HuntSession, RouteSummary } from '@ftp/shared';

function wasMVP(session: HuntSession, myUserId: string): boolean {
  if (!session.teamId || session.teamSize <= 1 || !session.finishedAt) return false;
  const foundSteps = session.steps.filter((s) => s.status === 'found' && s.foundBy);
  if (foundSteps.length === 0) return false;

  const countByUser = new Map<string, number>();
  for (const step of foundSteps) {
    countByUser.set(step.foundBy!, (countByUser.get(step.foundBy!) ?? 0) + 1);
  }

  const myCount = countByUser.get(myUserId) ?? 0;
  if (myCount === 0) return false;
  return myCount === Math.max(...countByUser.values());
}

type Rank = { label: string; emoji: string; color: string; next: number | null };

function getRank(points: number): Rank {
  if (points >= 2500) return { label: 'Champion', emoji: '👑', color: '#f59e0b', next: null };
  if (points >= 1000) return { label: 'Hunter', emoji: '🦅', color: '#ef4444', next: 2500 };
  if (points >= 500)  return { label: 'Tracker', emoji: '🧭', color: '#8b5cf6', next: 1000 };
  if (points >= 100)  return { label: 'Scout', emoji: '🔭', color: '#3b82f6', next: 500 };
  return { label: 'Explorer', emoji: '🌱', color: '#10b981', next: 100 };
}

function StatCard({
  label,
  value,
  icon,
  bg,
}: {
  label: string;
  value: string | number;
  icon: string;
  bg: string;
}) {
  return (
    <div
      style={{
        background: bg,
        borderRadius: 'var(--radius)',
        padding: 'var(--space-3)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <div style={{ fontSize: '1.8rem' }}>{icon}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--color-ink)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  );
}

/** Visual summary of the player's game history and created hunts. */
export function MyScores() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useSetPageHeader('My Scores', () => navigate('/'));

  const { data: myHunts, loading: loadingHunts } = useAsync(
    () => (user ? api.listAllMyHunts() : Promise.resolve({ sessions: [] })),
    [user?.id],
  );
  const { data: routes, loading: loadingRoutes } = useAsync(() => api.listRoutes(), []);

  const loading = loadingHunts || loadingRoutes;

  const finishedSessions = (myHunts?.sessions ?? []).filter((s) => !!s.finishedAt);
  const soloSessions = finishedSessions.filter((s) => !s.teamId || s.teamSize <= 1);
  const teamSessions = finishedSessions.filter((s) => s.teamId && s.teamSize > 1);

  const totalPoints = finishedSessions.reduce((sum, s) => sum + s.totalScore, 0);
  const bestScore = finishedSessions.length > 0 ? Math.max(...finishedSessions.map((s) => s.totalScore)) : 0;

  const myRoutes: RouteSummary[] = user
    ? (routes ?? []).filter((r) => r.authorId === user.id && r.status === 'ready')
    : [];

  const trophyCount = user
    ? teamSessions.filter((s) => wasMVP(s, user.id)).length
    : 0;

  const rank = getRank(totalPoints);
  const progressPct = rank.next
    ? Math.min(100, Math.round((totalPoints / rank.next) * 100))
    : 100;

  return (
    <Page>
      <div className="stack">
        {loading && <Spinner label="Loading scores…" />}

        {!loading && (
          <>
            {/* Hero: rank + points */}
            <div
              style={{
                background: 'linear-gradient(135deg, var(--color-primary) 0%, #f59e0b 100%)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-4) var(--space-4) var(--space-3)',
                color: '#fff',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* decorative circles */}
              <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />

              <div style={{ fontSize: '2.4rem', marginBottom: 2 }}>{rank.emoji}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.85, marginBottom: 4 }}>
                {rank.label}
              </div>
              <div style={{ fontSize: '3.2rem', fontWeight: 900, lineHeight: 1 }}>
                {totalPoints.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.9rem', opacity: 0.85, marginTop: 4 }}>points</div>

              {rank.next && (
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', opacity: 0.85, marginBottom: 5 }}>
                    <span>{totalPoints.toLocaleString()} pts</span>
                    <span>{rank.next.toLocaleString()} to next rank</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 999, height: 8 }}>
                    <div
                      style={{
                        background: '#fff',
                        borderRadius: 999,
                        height: '100%',
                        width: `${progressPct}%`,
                        transition: 'width 0.6s ease',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
              <StatCard label="Hunts played" value={finishedSessions.length} icon="🗺️" bg="var(--tint-accent)" />
              <StatCard label="Best score" value={bestScore} icon="🏅" bg="var(--tint-coral)" />
              <StatCard label="Solo" value={soloSessions.length} icon="🚶" bg="#f3eeff" />
              <StatCard label="Team" value={teamSessions.length} icon="👥" bg="#e0f2fe" />
            </div>

            {/* Trophies */}
            {trophyCount > 0 && (
              <div
                style={{
                  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                  borderRadius: 'var(--radius)',
                  padding: 'var(--space-3) var(--space-4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  border: '2px solid #f59e0b',
                }}
              >
                <span style={{ fontSize: '2.4rem' }}>🏆</span>
                <div>
                  <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#92400e' }}>
                    {trophyCount} {trophyCount === 1 ? 'Trophy' : 'Trophies'}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#a16207', marginTop: 2 }}>
                    Top scorer in {trophyCount === 1 ? 'a' : trophyCount} team {trophyCount === 1 ? 'hunt' : 'hunts'}
                  </div>
                </div>
              </div>
            )}

            {/* My created hunts */}
            {myRoutes.length > 0 && (
              <section className="stack">
                <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-2)' }}>Hunts I Created</h2>
                {myRoutes.map((route) => (
                  <Card key={route.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ display: 'block', marginBottom: 2 }}>{route.title}</strong>
                      <span className="muted" style={{ fontSize: '0.82rem' }}>
                        {route.itemCount} {route.itemCount === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                    {route.avgRating !== undefined ? (
                      <StarRating value={Math.round(route.avgRating)} />
                    ) : (
                      <span className="muted" style={{ fontSize: '0.8rem' }}>No ratings yet</span>
                    )}
                  </Card>
                ))}
              </section>
            )}

            {finishedSessions.length === 0 && myRoutes.length === 0 && (
              <Card>
                <div style={{ textAlign: 'center', padding: 'var(--space-3) 0' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-2)' }}>🗺️</div>
                  <p className="muted" style={{ margin: 0 }}>No scores yet — go play a hunt to see your stats!</p>
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      <BottomBar
        onCreate={() => navigate('/build/new')}
        onJoin={() => navigate('/join')}
        onMyHunts={() => navigate('/my-hunts')}
        onMyScores={() => {}}
        onMyHistory={() => navigate('/history')}
      />
    </Page>
  );
}
