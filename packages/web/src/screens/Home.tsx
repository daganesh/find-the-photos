import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RouteSummary } from '@ftp/shared';
import { useAuth } from '../auth/AuthContext.js';
import { api } from '../services/apiClient.js';
import { useAsync } from '../hooks/useAsync.js';
import { Button, Card, Page, Spinner, StarRating } from '../ui/index.js';

/** The hub: greet the player, list playable routes, and start building. */
export function Home() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: routes, loading, error, reload } = useAsync(() => api.listRoutes(), []);
  const [creating, setCreating] = useState(false);

  async function createRoute() {
    setCreating(true);
    try {
      const route = await api.createRoute({ title: 'My new hunt' });
      navigate(`/build/${route.id}`);
    } finally {
      setCreating(false);
    }
  }

  const ready = routes?.filter((r) => r.status === 'ready') ?? [];
  const mine = routes?.filter((r) => r.authorId === user?.id) ?? [];

  return (
    <Page
      right={
        <Button variant="ghost" onClick={signOut}>
          Sign out
        </Button>
      }
    >
      <div className="stack">
        <header className="stack">
          <h1>Hi {user?.name?.split(' ')[0]} 👋</h1>
          <p className="muted">Play a hunt someone made, or create your own!</p>
        </header>

        <Button size="lg" block variant="happy" onClick={createRoute} disabled={creating}>
          ➕ {creating ? 'Creating…' : 'Make a new hunt'}
        </Button>

        {loading && <Spinner label="Loading hunts…" />}
        {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

        {mine.length > 0 && (
          <section className="stack">
            <h2>Your hunts</h2>
            {mine.map((r) => (
              <RouteCard key={r.id} route={r} onClick={() => navigate(r.status === 'ready' ? `/play/${r.id}` : `/build/${r.id}`)} mine />
            ))}
          </section>
        )}

        <section className="stack">
          <h2>Ready to play</h2>
          {ready.length === 0 && !loading && (
            <Card>
              <p className="center muted">No hunts yet — be the first to make one! 🎈</p>
            </Card>
          )}
          {ready.map((r) => (
            <RouteCard key={r.id} route={r} onClick={() => navigate(`/play/${r.id}`)} />
          ))}
        </section>

        {!loading && (
          <Button variant="ghost" onClick={reload}>
            ↻ Refresh
          </Button>
        )}
      </div>
    </Page>
  );
}

function RouteCard({ route, onClick, mine }: { route: RouteSummary; onClick: () => void; mine?: boolean }) {
  return (
    <Card clickable onClick={onClick}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ marginBottom: 4 }}>{route.title}</h3>
          <p className="muted" style={{ margin: 0 }}>
            {route.itemCount} {route.itemCount === 1 ? 'item' : 'items'}
            {mine && route.status === 'draft' && ' · draft'}
          </p>
        </div>
        <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
          {route.avgRating !== undefined && <StarRating value={Math.round(route.avgRating)} />}
          <span style={{ fontSize: '1.6rem' }}>{route.status === 'ready' ? '▶️' : '✏️'}</span>
        </div>
      </div>
    </Card>
  );
}
