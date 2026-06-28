import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { api } from '../services/apiClient.js';
import { useAsync } from '../hooks/useAsync.js';
import { BottomBar, Card, Page, Spinner, useSetPageHeader } from '../ui/index.js';
import { DraftCard, PublishedRouteCard } from './Home.js';

export function MyHunts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: routes, loading, error, reload } = useAsync(() => api.listRoutes(), []);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useSetPageHeader('My Hunts', () => navigate('/'));

  const myDrafts = user ? (routes?.filter((r) => r.authorId === user.id && r.status === 'draft') ?? []) : [];
  const myRoutes = user ? (routes?.filter((r) => r.authorId === user.id && r.status === 'ready') ?? []) : [];

  function createRoute() {
    navigate('/build/new');
  }

  async function deleteDraft(routeId: string) {
    setDeletingId(routeId);
    try {
      await api.deleteRoute(routeId);
      reload();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Page>
      <div className="stack">
        {loading && <Spinner label="Loading…" />}
        {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

        <section className="stack">
          <h2>My Drafts</h2>
          {myDrafts.length === 0 && !loading && (
            <Card><p className="center muted">No drafts yet.</p></Card>
          )}
          {myDrafts.map((r) => (
            <DraftCard
              key={r.id}
              route={r}
              onContinue={() => navigate(`/build/${r.id}`)}
              onDelete={() => deleteDraft(r.id)}
            />
          ))}
        </section>

        <section className="stack">
          <h2>My Published Hunts</h2>
          {myRoutes.length === 0 && !loading && (
            <Card><p className="center muted">No published hunts yet.</p></Card>
          )}
          {myRoutes.map((r) => (
            <PublishedRouteCard
              key={r.id}
              route={r}
              onPlay={() => navigate(`/hunt/${r.id}`)}
              onEdit={() => navigate(`/build/${r.id}`)}
              onDelete={() => deleteDraft(r.id)}
              deleting={deletingId === r.id}
            />
          ))}
        </section>
      </div>

      <BottomBar
        onCreate={createRoute}
        onJoin={() => navigate('/join')}
        onMyHunts={() => {}}
        onMyScores={() => navigate('/scores')}
        onMyHistory={() => navigate('/history')}
        activePage="my-hunts"
      />
    </Page>
  );
}
