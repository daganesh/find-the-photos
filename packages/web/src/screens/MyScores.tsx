import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { api } from '../services/apiClient.js';
import { useAsync } from '../hooks/useAsync.js';
import { BottomBar, Card, Page, Spinner, StarRating } from '../ui/index.js';
import type { HuntSession, RouteSummary } from '@ftp/shared';

/** Compute whether the current user was the top scorer (MVP) in a team session. */
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

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <Card style={{ textAlign: 'center', padding: 'var(--space-3)' }}>
      <div style={{ fontSize: '2rem', marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-accent)' }}>{value}</div>
      <div className="muted" style={{ fontSize: '0.8rem', marginTop: 2 }}>{label}</div>
    </Card>
  );
}

/** Visual summary of the player's game history and created hunts. */
export function MyScores() {
  const { user } = useAuth();
  const navigate = useNavigate();

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

  return (
    <Page title="My Scores" onBack={() => navigate('/')}>
      <div className="stack">
        {loading && <Spinner label="Loading scores…" />}

        {!loading && (
          <>
            {/* Summary banner */}
            <div
              style={{
                background: 'linear-gradient(135deg, var(--color-accent) 0%, #f97316 100%)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-4)',
                color: '#fff',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '2.8rem', fontWeight: 900 }}>{totalPoints.toLocaleString()}</div>
              <div style={{ fontSize: '1rem', opacity: 0.9, marginTop: 4 }}>Total Points</div>
            </div>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <StatCard label="Hunts played" value={finishedSessions.length} icon="🗺️" />
              <StatCard label="Best score" value={bestScore} icon="🏅" />
              <StatCard label="Solo hunts" value={soloSessions.length} icon="🚶" />
              <StatCard label="Team hunts" value={teamSessions.length} icon="👥" />
            </div>

            {/* Trophies */}
            {trophyCount > 0 && (
              <Card style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4)' }}>
                <span style={{ fontSize: '2.5rem' }}>🏆</span>
                <div>
                  <strong style={{ fontSize: '1.1rem' }}>
                    {trophyCount} {trophyCount === 1 ? 'Trophy' : 'Trophies'}
                  </strong>
                  <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.85rem' }}>
                    Times you were the top scorer in a team hunt
                  </p>
                </div>
              </Card>
            )}

            {/* My created hunts */}
            {myRoutes.length > 0 && (
              <section className="stack">
                <h2>Hunts I Created</h2>
                {myRoutes.map((route) => (
                  <Card key={route.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                <p className="center muted">No scores yet — go play a hunt to see your stats! 🗺️</p>
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
