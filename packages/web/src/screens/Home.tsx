import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { HuntSession, RouteSummary } from '@ftp/shared';
import { useAuth } from '../auth/AuthContext.js';
import { api } from '../services/apiClient.js';
import { mediaUrl } from '../services/media.js';
import { useAsync } from '../hooks/useAsync.js';
import { googleMapsLink } from '../services/maps.js';
import { Banner, Button, Card, Page, Spinner, StarRating } from '../ui/index.js';

/** The hub: greet the player, list playable routes, and start building. */
export function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: routes, loading, error, reload } = useAsync(() => api.listRoutes(), []);
  const { data: myHunts } = useAsync(() => (user ? api.listMyHunts() : Promise.resolve({ sessions: [] })), [user?.id]);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [teamingRouteId, setTeamingRouteId] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string>();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function createRoute() {
    setCreating(true);
    try {
      const route = await api.createRoute({ title: 'My new hunt' });
      navigate(`/build/${route.id}`);
    } finally {
      setCreating(false);
    }
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

  async function startTeam(routeId: string) {
    setTeamingRouteId(routeId);
    setTeamError(undefined);
    try {
      const avatarEmoji = user?.id ? (localStorage.getItem(`ftp.avatar.${user.id}`) ?? undefined) : undefined;
      const team = await api.createTeam(routeId, user?.name ?? undefined, avatarEmoji);
      navigate(`/team/${team.id}`);
    } catch (e) {
      setTeamError(e instanceof Error ? e.message : 'Could not create team');
    } finally {
      setTeamingRouteId(null);
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
  const myDrafts = user ? (routes?.filter((r) => r.authorId === user.id && r.status !== 'ready') ?? []) : [];
  const activeSessions = myHunts?.sessions ?? [];

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
        {teamError && <Banner tone="no">{teamError}</Banner>}

        {activeSessions.length > 0 && (
          <section className="stack">
            <h2>{activeSessions.some((s) => s.pausedAt) ? 'Paused hunts' : 'Active hunts'}</h2>
            {activeSessions.map((s) => {
              const route = routes?.find((r) => r.id === s.routeId);
              return (
                <ActiveHuntCard
                  key={s.id}
                  session={s}
                  routeTitle={route?.title}
                  onResume={() => navigate(`/play/${s.routeId}/resume/${s.id}`)}
                />
              );
            })}
          </section>
        )}

        {user && myDrafts.length > 0 && (
          <section className="stack">
            <h2>My drafts</h2>
            {myDrafts.map((r) => (
              <DraftCard
                key={r.id}
                route={r}
                onContinue={() => navigate(`/build/${r.id}`)}
                onDelete={() => deleteDraft(r.id)}
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
              teaming={teamingRouteId === r.id}
              onPlay={() => navigate(`/play/${r.id}`)}
              onTeamPlay={() => startTeam(r.id)}
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
  onTeamPlay,
  onEdit,
  onShare,
  mine,
  copied,
  teaming,
}: {
  route: RouteSummary;
  onPlay: () => void;
  onTeamPlay?: () => void;
  onEdit?: () => void;
  onShare?: () => void;
  mine?: boolean;
  copied?: boolean;
  teaming?: boolean;
}) {
  const hasCover = Boolean(route.coverPhotoUrl);

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {/* Hero — info only, no click-to-play (actions are in the button bar below) */}
      <div
        style={{
          padding: 'var(--space-4)',
          minHeight: hasCover ? 160 : undefined,
          display: 'flex',
          alignItems: hasCover ? 'flex-end' : undefined,
          justifyContent: 'space-between',
          backgroundImage: hasCover
            ? `linear-gradient(rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.62) 100%), url(${mediaUrl(route.coverPhotoUrl!)})`
            : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div style={{ flex: 1 }}>
          <h3 style={{ marginBottom: 4, color: hasCover ? '#fff' : undefined }}>{route.title}</h3>
          <p className="muted" style={{ margin: 0, color: hasCover ? 'rgba(255,255,255,0.78)' : undefined }}>
            {route.itemCount} {route.itemCount === 1 ? 'item' : 'items'}
            {mine && route.status === 'draft' && ' · draft'}
          </p>
        </div>
        {route.avgRating !== undefined && (
          <div style={{ flexShrink: 0, marginLeft: 'var(--space-2)' }}>
            <StarRating value={Math.round(route.avgRating)} />
          </div>
        )}
      </div>

      {/* Start / end location links */}
      {(route.startLocation || route.endLocation) && (
        <div className="row" style={{ padding: '4px var(--space-4) 4px', gap: 8, flexWrap: 'wrap' }}>
          {route.startLocation && (
            <a
              href={googleMapsLink(route.startLocation.lat, route.startLocation.lng)}
              target="_blank"
              rel="noreferrer"
              className="btn btn--ghost"
              style={{ fontSize: '0.78rem', padding: '4px 10px' }}
            >
              📍 Start
            </a>
          )}
          {route.endLocation && (
            <a
              href={googleMapsLink(route.endLocation.lat, route.endLocation.lng)}
              target="_blank"
              rel="noreferrer"
              className="btn btn--ghost"
              style={{ fontSize: '0.78rem', padding: '4px 10px' }}
            >
              🏁 End
            </a>
          )}
        </div>
      )}

      {/* Action buttons — always present for ready routes */}
      <div
        className="row"
        style={{ padding: 'var(--space-2) var(--space-4) var(--space-3)', borderTop: '1px solid var(--color-line)', flexWrap: 'wrap', gap: 4 }}
      >
        <Button variant="happy" onClick={(e) => { e.stopPropagation(); onPlay(); }}>
          ▶ Play solo
        </Button>
        {onTeamPlay && (
          <Button variant="accent" disabled={teaming} onClick={(e) => { e.stopPropagation(); onTeamPlay(); }}>
            {teaming ? '⏳' : '👥 Team'}
          </Button>
        )}
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
    </Card>
  );
}

function ActiveHuntCard({
  session,
  routeTitle,
  onResume,
}: {
  session: HuntSession;
  routeTitle?: string;
  onResume: () => void;
}) {
  const found = session.steps.filter((s) => s.status === 'found').length;
  const total = session.steps.length;
  const isPaused = Boolean(session.pausedAt);

  return (
    <Card>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ marginBottom: 4 }}>{routeTitle ?? 'Hunt'}</h3>
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            {found} / {total} items found
          </p>
        </div>
        <span
          style={{
            display: 'inline-block',
            padding: '2px 10px',
            borderRadius: 'var(--radius-full, 999px)',
            background: isPaused ? 'var(--tint-happy, #dcfce7)' : 'var(--tint-accent, #eff6ff)',
            color: isPaused ? 'var(--color-ok, #16a34a)' : 'var(--color-accent, #2563eb)',
            fontSize: '0.78rem',
            fontWeight: 600,
            flexShrink: 0,
            marginLeft: 'var(--space-2)',
          }}
        >
          {isPaused ? '⏸ Paused' : '▶ Active'}
        </span>
      </div>
      <div style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-line)' }}>
        <Button variant="happy" onClick={onResume}>
          ▶ Resume hunt
        </Button>
      </div>
    </Card>
  );
}

function DraftCard({ route, onContinue, onDelete }: { route: RouteSummary; onContinue: () => void; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Card>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ marginBottom: 4 }}>{route.title || 'Untitled hunt'}</h3>
          <p className="muted" style={{ margin: 0 }}>
            {route.itemCount} {route.itemCount === 1 ? 'item' : 'items'}
          </p>
        </div>
        <span
          style={{
            display: 'inline-block',
            padding: '2px 10px',
            borderRadius: 'var(--radius-full, 999px)',
            background: 'var(--color-surface-raised, #e8e8e8)',
            color: 'var(--color-text-muted, #666)',
            fontSize: '0.78rem',
            fontWeight: 600,
            letterSpacing: '0.03em',
            flexShrink: 0,
            marginLeft: 'var(--space-2)',
          }}
        >
          Draft
        </span>
      </div>
      <div style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-line)' }}>
        {confirmDelete ? (
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: '0.9rem', flex: 1 }}>Delete this draft?</span>
            <Button variant="ghost" style={{ color: 'var(--color-danger, #ef4444)' }} onClick={onDelete}>🗑 Yes, delete</Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </div>
        ) : (
          <div className="row" style={{ gap: 8 }}>
            <Button variant="ghost" onClick={onContinue}>✏️ Continue editing</Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(true)} style={{ color: 'var(--color-ink-soft)' }}>🗑</Button>
          </div>
        )}
      </div>
    </Card>
  );
}
