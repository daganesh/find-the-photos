import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RouteSummary } from '@ftp/shared';
import { useAuth } from '../auth/AuthContext.js';
import { api } from '../services/apiClient.js';
import { mediaUrl } from '../services/media.js';
import { useAsync } from '../hooks/useAsync.js';
import { Button, Card, Page, Spinner, StarRating } from '../ui/index.js';

/** The hub: greet the player, list playable routes, and start building. */
export function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: routes, loading, error, reload } = useAsync(() => api.listRoutes(), []);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function createRoute() {
    setCreating(true);
    try {
      const route = await api.createRoute({ title: 'My new hunt' });
      navigate(`/build/${route.id}`);
    } finally {
      setCreating(false);
    }
  }

  function shareRoute(routeId: string) {
    const url = `${window.location.origin}/play/${routeId}`;
    if (navigator.share) {
      navigator.share({ title: 'Find the Photos', url }).catch(() => undefined);
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedId(routeId);
        setTimeout(() => setCopiedId(null), 2000);
      });
    }
  }

  const ready = routes?.filter((r) => r.status === 'ready') ?? [];
  const mine = routes?.filter((r) => r.authorId === user?.id) ?? [];

  return (
    <Page>
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
              <RouteCard
                key={r.id}
                route={r}
                mine
                copied={copiedId === r.id}
                onPlay={() => navigate(`/play/${r.id}`)}
                onEdit={() => navigate(`/build/${r.id}`)}
                onShare={r.status === 'ready' ? () => shareRoute(r.id) : undefined}
              />
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
            <RouteCard
              key={r.id}
              route={r}
              copied={copiedId === r.id}
              onPlay={() => navigate(`/play/${r.id}`)}
              onShare={() => shareRoute(r.id)}
            />
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

function RouteCard({
  route,
  onPlay,
  onEdit,
  onShare,
  mine,
  copied,
}: {
  route: RouteSummary;
  onPlay: () => void;
  onEdit?: () => void;
  onShare?: () => void;
  mine?: boolean;
  copied?: boolean;
}) {
  const hasCover = Boolean(route.coverPhotoUrl);

  return (
    <Card>
      {/* Cover photo */}
      {hasCover && (
        <img
          src={mediaUrl(route.coverPhotoUrl!)}
          alt={route.title}
          style={{
            width: 'calc(100% + var(--space-4) * 2)',
            marginLeft: 'calc(var(--space-4) * -1)',
            marginTop: 'calc(var(--space-4) * -1)',
            marginBottom: 'var(--space-3)',
            height: 160,
            objectFit: 'cover',
            borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
            display: 'block',
          }}
        />
      )}

      {/* Main info row — tappable to play */}
      <div
        className="row"
        style={{ justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={onPlay}
      >
        <div style={{ flex: 1 }}>
          <h3 style={{ marginBottom: 4 }}>{route.title}</h3>
          <p className="muted" style={{ margin: 0 }}>
            {route.itemCount} {route.itemCount === 1 ? 'item' : 'items'}
            {mine && route.status === 'draft' && ' · draft'}
          </p>
        </div>
        <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
          {route.avgRating !== undefined && <StarRating value={Math.round(route.avgRating)} />}
          <span style={{ fontSize: '1.6rem' }}>▶️</span>
        </div>
      </div>

      {/* Actions */}
      {(onEdit ?? onShare) && (
        <div
          className="row"
          style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-line)' }}
        >
          {onEdit && (
            <Button variant="ghost" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              ✏️ Edit
            </Button>
          )}
          {onShare && (
            <Button variant="ghost" onClick={(e) => { e.stopPropagation(); onShare(); }}>
              {copied ? '✅ Copied!' : '🔗 Share'}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
