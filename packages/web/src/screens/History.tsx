import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { api } from '../services/apiClient.js';
import { useAsync } from '../hooks/useAsync.js';
import { BottomBar, Card, Page, Spinner } from '../ui/index.js';
import { PastHuntCard } from './Home.js';

export function History() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: routes } = useAsync(() => api.listRoutes(), []);
  const { data: myHunts, loading, error, reload: reloadHunts } = useAsync(
    () => (user ? api.listAllMyHunts() : Promise.resolve({ sessions: [] })),
    [user?.id],
  );
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const pastSessions = (myHunts?.sessions ?? []).filter((s) => !!s.finishedAt);

  async function createRoute() {
    setCreating(true);
    try {
      const route = await api.createRoute({ title: 'My new hunt' });
      navigate(`/build/${route.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function deleteSession(sessionId: string) {
    setDeletingId(sessionId);
    try {
      await api.deleteHunt(sessionId);
      reloadHunts();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Page title="My History" onBack={() => navigate('/')}>
      <div className="stack">
        {loading && <Spinner label="Loading…" />}
        {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

        {pastSessions.length === 0 && !loading && (
          <Card><p className="center muted">No completed hunts yet — go explore! 🗺️</p></Card>
        )}

        {pastSessions.map((s) => {
          const route = routes?.find((r) => r.id === s.routeId);
          const found = s.steps.filter((st) => st.status === 'found').length;
          return (
            <PastHuntCard
              key={s.id}
              title={route?.title ?? 'Hunt'}
              coverPhotoUrl={route?.coverPhotoUrl}
              found={found}
              total={s.steps.length}
              score={s.totalScore}
              onResults={() => navigate(`/results/${s.routeId}/${s.id}`)}
              onDelete={() => deleteSession(s.id)}
              deleting={deletingId === s.id}
            />
          );
        })}
      </div>

      <BottomBar
        onCreate={createRoute}
        onJoin={() => navigate('/join')}
        onMyHunts={() => navigate('/my-hunts')}
        onMyScores={() => {}}
        onMyHistory={() => {}}
        creating={creating}
      />
    </Page>
  );
}
