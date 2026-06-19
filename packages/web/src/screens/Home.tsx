import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { HuntSession, RouteSummary } from '@ftp/shared';
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
  const { data: myHunts } = useAsync(() => (user ? api.listAllMyHunts() : Promise.resolve({ sessions: [] })), [user?.id]);
  const { data: myTeams } = useAsync(() => (user ? api.listMyTeams() : Promise.resolve({ teams: [] })), [user?.id]);
  const [creating, setCreating] = useState(false);
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

  const ready = routes?.filter((r) => r.status === 'ready') ?? [];
  const myDrafts = user ? (routes?.filter((r) => r.authorId === user.id && r.status !== 'ready' && r.itemCount > 0) ?? []) : [];
  const allSessions = myHunts?.sessions ?? [];
  const activeSessions = allSessions.filter((s) => !s.finishedAt);
  const pastSessions = allSessions.filter((s) => !!s.finishedAt).slice(0, 10);
  const activeTeams = myTeams?.teams ?? [];

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
        {activeSessions.length > 0 && (
          <CollapsibleSection title={activeSessions.some((s) => s.pausedAt) ? 'Paused hunts' : 'Active hunts'}>
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
          </CollapsibleSection>
        )}

        {activeTeams.length > 0 && (
          <CollapsibleSection title="Team hunts in progress">
            {activeTeams.map((team) => {
              const route = routes?.find((r) => r.id === team.routeId);
              const isPaused = team.status === 'paused';
              return (
                <Card key={team.id}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ marginBottom: 4 }}>{route?.title ?? 'Hunt'}</h3>
                      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                        👥 {team.name} · {team.members.length} member{team.members.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px',
                      borderRadius: 'var(--radius-full, 999px)',
                      background: isPaused ? 'var(--tint-happy, #dcfce7)' : 'var(--tint-accent, #eff6ff)',
                      color: isPaused ? 'var(--color-ok, #16a34a)' : 'var(--color-accent, #2563eb)',
                      fontSize: '0.78rem', fontWeight: 600, flexShrink: 0, marginLeft: 'var(--space-2)',
                    }}>
                      {isPaused ? '⏸ Paused' : '▶ Active'}
                    </span>
                  </div>
                  <div style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-line)' }}>
                    <Button variant="happy" onClick={() => navigate(`/team/${team.id}/play`)}>
                      👥 Rejoin team hunt
                    </Button>
                  </div>
                </Card>
              );
            })}
          </CollapsibleSection>
        )}

        {user && myDrafts.length > 0 && (
          <CollapsibleSection title="My drafts">
            {myDrafts.map((r) => (
              <DraftCard
                key={r.id}
                route={r}
                onContinue={() => navigate(`/build/${r.id}`)}
                onDelete={() => deleteDraft(r.id)}
              />
            ))}
          </CollapsibleSection>
        )}

        <CollapsibleSection title="Ready to play">
          {ready.length === 0 && !loading && (
            <Card>
              <p className="center muted">No hunts yet — be the first to make one! 🎈</p>
            </Card>
          )}
          {ready.map((r) => (
            <RouteCard
              key={r.id}
              route={r}
              onClick={() => navigate(`/hunt/${r.id}`)}
            />
          ))}
        </CollapsibleSection>

        {pastSessions.length > 0 && (
          <CollapsibleSection title="Past hunts" defaultOpen={false}>
            {pastSessions.map((s) => {
              const route = routes?.find((r) => r.id === s.routeId);
              const found = s.steps.filter((st) => st.status === 'found').length;
              return (
                <Card key={s.id}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{route?.title ?? 'Hunt'}</strong>
                      <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.82rem' }}>
                        {found}/{s.steps.length} found · ⭐ {s.totalScore}
                      </p>
                    </div>
                    <Button variant="ghost" onClick={() => navigate(`/results/${s.routeId}/${s.id}`)}>
                      Results →
                    </Button>
                  </div>
                </Card>
              );
            })}
          </CollapsibleSection>
        )}

        {!loading && (
          <Button variant="ghost" onClick={reload}>
            ↻ Refresh
          </Button>
        )}
      </div>
    </Page>
  );
}

function CollapsibleSection({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="stack">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', width: '100%' }}
      >
        <h2 style={{ margin: 0 }}>{title}</h2>
        <span style={{ fontSize: '0.85rem', color: 'var(--color-ink-soft)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && children}
    </section>
  );
}

function RouteCard({ route, onClick }: { route: RouteSummary; onClick: () => void }) {
  const hasCover = Boolean(route.coverPhotoUrl);

  return (
    <button
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <Card style={{ padding: 0, overflow: 'hidden' }}>
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
            </p>
          </div>
          {route.avgRating !== undefined && (
            <div style={{ flexShrink: 0, marginLeft: 'var(--space-2)' }}>
              <StarRating value={Math.round(route.avgRating)} />
            </div>
          )}
        </div>
      </Card>
    </button>
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
