import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GeoPoint, HuntSession, RouteSummary, Team } from '@ftp/shared';
import { useAuth } from '../auth/AuthContext.js';
import { api } from '../services/apiClient.js';
import { mediaUrl } from '../services/media.js';
import { useAsync } from '../hooks/useAsync.js';
import { getCurrentLocation } from '../services/geolocation.js';
import { BottomBar, Button, Card, MapView, Page, Spinner, StarRating } from '../ui/index.js';
import { filterHunts, hasActiveFilters } from './huntFilters.js';
import type { DateFilter } from './huntFilters.js';

type FilterDraft = {
  name: string;
  creator: string;
  distanceKm: number | null;
  dateFilter: DateFilter | null;
};

const EMPTY_FILTERS: FilterDraft = { name: '', creator: '', distanceKm: null, dateFilter: null };

/** The hub: greet the player, list playable routes, and start building. */
export function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: routes, loading, error, reload } = useAsync(() => api.listRoutes(), []);
  const { data: myHunts, reload: reloadHunts } = useAsync(() => (user ? api.listAllMyHunts() : Promise.resolve({ sessions: [] })), [user?.id]);
  const { data: myTeams } = useAsync(() => (user ? api.listMyTeams() : Promise.resolve({ teams: [] })), [user?.id]);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  // Filter state — draft is the in-popup edit, applied is what's actually filtering
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<FilterDraft>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<FilterDraft>(EMPTY_FILTERS);
  const [myLocation, setMyLocation] = useState<GeoPoint | undefined>();
  const [locating, setLocating] = useState(false);

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

  async function deleteSession(sessionId: string) {
    setDeletingId(sessionId);
    try {
      await api.deleteHunt(sessionId);
      reloadHunts();
    } finally {
      setDeletingId(null);
    }
  }

  /** Called when distance filter changes inside the popup — triggers geolocation if needed. */
  async function handleDraftDistanceGeo(km: number | null) {
    if (km !== null && !myLocation) {
      setLocating(true);
      const loc = await getCurrentLocation();
      setMyLocation(loc);
      setLocating(false);
    }
  }

  function openFilterPopup() {
    setDraft(applied);
    setFilterOpen(true);
  }

  function applyFilters() {
    setApplied(draft);
    setFilterOpen(false);
  }

  function clearFilters() {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setFilterOpen(false);
  }

  const ready = routes?.filter((r) => r.status === 'ready') ?? [];
  const myDrafts = user ? (routes?.filter((r) => r.authorId === user.id && r.status === 'draft') ?? []) : [];
  const myRoutes = user ? (routes?.filter((r) => r.authorId === user.id && r.status === 'ready') ?? []) : [];
  const allSessions = myHunts?.sessions ?? [];
  const activeSessions = allSessions.filter((s) => !s.finishedAt);
  const pastSessions = allSessions.filter((s) => !!s.finishedAt).slice(0, 10);
  const activeTeams = myTeams?.teams ?? [];

  const filterOpts = { ...applied, myLocation };
  const filteredReady = filterHunts(ready, filterOpts);
  const filtersActive = hasActiveFilters(applied);
  const activeFilterCount = [
    applied.name.trim(),
    applied.creator.trim(),
    applied.distanceKm !== null ? '1' : '',
    applied.dateFilter ?? '',
  ].filter(Boolean).length;

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

        {joinOpen ? (
          <div className="row" style={{ gap: 8 }}>
            <input
              autoFocus
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter join code…"
              maxLength={8}
              style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '0.1em' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && joinCode.trim()) navigate(`/join/${joinCode.trim()}`);
                if (e.key === 'Escape') { setJoinOpen(false); setJoinCode(''); }
              }}
            />
            <Button variant="happy" disabled={!joinCode.trim()} onClick={() => navigate(`/join/${joinCode.trim()}`)}>
              Join
            </Button>
            <Button variant="ghost" onClick={() => { setJoinOpen(false); setJoinCode(''); }}>
              ✕
            </Button>
          </div>
        ) : (
          <Button block variant="ghost" onClick={() => setJoinOpen(true)}>
            👥 Join a team hunt
          </Button>
        )}

        {loading && <Spinner label="Loading hunts…" />}
        {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}
        {(activeSessions.length > 0 || activeTeams.length > 0) && (
          <CollapsibleSection title="Active hunts" id="home-active-hunts">
            {activeSessions.map((s) => {
              const route = routes?.find((r) => r.id === s.routeId);
              return (
                <ActiveHuntCard
                  key={s.id}
                  session={s}
                  routeTitle={route?.title}
                  onResume={() => navigate(`/play/${s.routeId}/resume/${s.id}`)}
                  onDelete={() => deleteSession(s.id)}
                  deleting={deletingId === s.id}
                />
              );
            })}
            {activeTeams.map((team) => {
              const route = routes?.find((r) => r.id === team.routeId);
              return (
                <ActiveTeamHuntCard
                  key={team.id}
                  team={team}
                  routeTitle={route?.title}
                  onRejoin={() => navigate(`/team/${team.id}/play`)}
                />
              );
            })}
          </CollapsibleSection>
        )}

        {user && myDrafts.length > 0 && (
          <CollapsibleSection title="My drafts" id="home-my-drafts">
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

        {user && myRoutes.length > 0 && (
          <CollapsibleSection title="My published hunts" id="home-my-published-hunts">
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
          </CollapsibleSection>
        )}

        <CollapsibleSection title="Available Hunts">
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <FilterButton active={filtersActive} count={activeFilterCount} onClick={openFilterPopup} />
          </div>
          {filterOpen && (
            <FilterPopup
              draft={draft}
              onChange={setDraft}
              onDistanceChange={handleDraftDistanceGeo}
              onApply={applyFilters}
              onClear={clearFilters}
              onClose={() => setFilterOpen(false)}
              locating={locating}
            />
          )}
          {filteredReady.length === 0 && !loading && (
            <Card>
              <p className="center muted">
                {filtersActive ? 'No hunts match your filters.' : 'No hunts yet — be the first to make one! 🎈'}
              </p>
            </Card>
          )}
          {filteredReady.map((r) => (
            <RouteCard
              key={r.id}
              route={r}
              onClick={() => navigate(`/hunt/${r.id}`)}
            />
          ))}
        </CollapsibleSection>

        {pastSessions.length > 0 && (
          <CollapsibleSection title="Past hunts" defaultOpen={false} id="home-past-hunts">
            {pastSessions.map((s) => {
              const route = routes?.find((r) => r.id === s.routeId);
              const found = s.steps.filter((st) => st.status === 'found').length;
              return (
                <PastHuntCard
                  key={s.id}
                  title={route?.title ?? 'Hunt'}
                  found={found}
                  total={s.steps.length}
                  score={s.totalScore}
                  onResults={() => navigate(`/results/${s.routeId}/${s.id}`)}
                  onDelete={() => deleteSession(s.id)}
                  deleting={deletingId === s.id}
                />
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
      <BottomBar
        onCreate={createRoute}
        onJoin={() => setJoinOpen(true)}
        onMyHunts={() => {
          const el =
            document.getElementById('home-my-drafts') ??
            document.getElementById('home-my-published-hunts');
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
        onMyScores={() => {
          document.getElementById('home-past-hunts')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
        onMyHistory={() => {
          const el =
            document.getElementById('home-active-hunts') ??
            document.getElementById('home-past-hunts');
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
        creating={creating}
      />
    </Page>
  );
}

function FilterButton({ active, count, onClick }: { active: boolean; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={active ? `Filters (${count} active)` : 'Open filters'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: active ? 'var(--color-accent)' : 'var(--color-surface)',
        color: active ? 'var(--color-accent-ink)' : 'var(--color-ink)',
        border: 'none',
        borderRadius: 'var(--radius-pill)',
        padding: '8px 16px',
        fontFamily: 'inherit',
        fontWeight: 700,
        fontSize: '0.95rem',
        cursor: 'pointer',
        boxShadow: 'var(--shadow)',
      }}
    >
      🔽 Filters
      {active && (
        <span
          style={{
            background: 'rgba(255,255,255,0.35)',
            borderRadius: '50%',
            width: 20,
            height: 20,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            lineHeight: 1,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function FilterPopup({
  draft,
  onChange,
  onDistanceChange,
  onApply,
  onClear,
  onClose,
  locating,
}: {
  draft: FilterDraft;
  onChange: (d: FilterDraft) => void;
  onDistanceChange: (km: number | null) => void;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
  locating: boolean;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 300,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(2px)',
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Popup */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filter hunts"
        className="pop-in"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 301,
          width: 'min(90vw, 400px)',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: 'var(--space-4)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-3)',
          }}
        >
          <h3 style={{ margin: 0 }}>Filter hunts</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filter popup"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.2rem',
              cursor: 'pointer',
              color: 'var(--color-ink-soft)',
              lineHeight: 1,
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <label style={{ display: 'block' }}>
            <span className="field-label">Name</span>
            <input
              type="search"
              placeholder="Search by name…"
              value={draft.name}
              onChange={(e) => onChange({ ...draft, name: e.target.value })}
              aria-label="Search hunts by name"
            />
          </label>

          <label style={{ display: 'block' }}>
            <span className="field-label">Creator</span>
            <input
              type="search"
              placeholder="Filter by creator…"
              value={draft.creator}
              onChange={(e) => onChange({ ...draft, creator: e.target.value })}
              aria-label="Filter by creator"
            />
          </label>

          <label style={{ display: 'block' }}>
            <span className="field-label">Distance</span>
            <select
              value={draft.distanceKm ?? ''}
              onChange={(e) => {
                const km = e.target.value ? Number(e.target.value) : null;
                onChange({ ...draft, distanceKm: km });
                onDistanceChange(km);
              }}
              aria-label="Filter by distance from my location"
            >
              <option value="">Any distance</option>
              <option value="1">≤ 1 km</option>
              <option value="5">≤ 5 km</option>
              <option value="10">≤ 10 km</option>
              <option value="25">≤ 25 km</option>
            </select>
            {locating && (
              <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.82rem' }}>
                📍 Getting your location…
              </p>
            )}
          </label>

          <label style={{ display: 'block' }}>
            <span className="field-label">Date added</span>
            <select
              value={draft.dateFilter ?? ''}
              onChange={(e) => onChange({ ...draft, dateFilter: (e.target.value as DateFilter) || null })}
              aria-label="Filter by date created"
            >
              <option value="">Any time</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last week</option>
              <option value="30d">Last month</option>
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
          <Button variant="ghost" onClick={onClear} style={{ flex: 1 }}>
            Clear all
          </Button>
          <Button variant="happy" onClick={onApply} style={{ flex: 1 }}>
            Apply
          </Button>
        </div>
      </div>
    </>
  );
}

function CollapsibleSection({ title, children, defaultOpen = true, id }: { title: string; children: ReactNode; defaultOpen?: boolean; id?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} className="stack">
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

function formatRouteDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function RouteCard({ route, onClick }: { route: RouteSummary; onClick: () => void }) {
  const [showMap, setShowMap] = useState(false);
  const hasCover = Boolean(route.coverPhotoUrl);
  const hasLocation = Boolean(route.startLocation);

  return (
    <div style={{ position: 'relative' }}>
      {/* Main clickable card */}
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
              <h3 style={{ marginBottom: 2, color: hasCover ? '#fff' : undefined }}>{route.title}</h3>
              <p
                className="muted"
                style={{
                  margin: '0 0 4px',
                  fontSize: '0.82rem',
                  color: hasCover ? 'rgba(255,255,255,0.85)' : undefined,
                }}
              >
                {route.authorName ? `by ${route.authorName}` : 'by Unknown'}
                {' · '}
                {formatRouteDate(route.createdAt)}
              </p>
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

      {/* Location pin — sibling of the main button, positioned over the card */}
      {hasLocation && (
        <button
          type="button"
          onClick={() => setShowMap((v) => !v)}
          aria-label={showMap ? 'Hide map' : 'Show hunt start location on map'}
          style={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: showMap ? 'var(--color-accent)' : 'rgba(255,255,255,0.92)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow)',
            zIndex: 1,
          }}
        >
          📍
        </button>
      )}

      {/* Inline map — shown below the card when pin is active */}
      {showMap && route.startLocation && (
        <div style={{ marginTop: 'var(--space-2)' }}>
          <MapView target={route.startLocation} />
        </div>
      )}
    </div>
  );
}

function ActiveHuntCard({
  session,
  routeTitle,
  onResume,
  onDelete,
  deleting,
}: {
  session: HuntSession;
  routeTitle?: string;
  onResume: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const found = session.steps.filter((s) => s.status === 'found').length;
  const total = session.steps.length;

  function handleCardClick() {
    setExpanded((e) => !e);
    if (expanded) setConfirmDelete(false);
  }

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={handleCardClick}
        style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 'var(--space-4)', cursor: 'pointer' }}
      >
        <h3 style={{ margin: '0 0 2px' }}>{routeTitle ?? 'Hunt'}</h3>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          {found} / {total} items found
        </p>
      </button>
      {expanded && (
        <div style={{ padding: 'var(--space-2) var(--space-4) var(--space-3)', borderTop: '1px solid var(--color-line)' }}>
          {confirmDelete ? (
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <span className="muted" style={{ fontSize: '0.9rem', flex: 1 }}>Abandon this hunt?</span>
              <Button variant="ghost" style={{ color: 'var(--color-danger, #ef4444)' }} onClick={onDelete} disabled={deleting}>
                {deleting ? '…' : '🗑 Yes'}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          ) : (
            <div className="row" style={{ gap: 8 }}>
              <Button variant="happy" onClick={onResume}>▶ Resume hunt</Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(true)} style={{ color: 'var(--color-ink-soft)' }}>🗑</Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function PastHuntCard({
  title,
  found,
  total,
  score,
  onResults,
  onDelete,
  deleting,
}: {
  title: string;
  found: number;
  total: number;
  score: number;
  onResults: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleCardClick() {
    setExpanded((e) => !e);
    if (expanded) setConfirmDelete(false);
  }

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={handleCardClick}
        style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 'var(--space-4)', cursor: 'pointer' }}
      >
        <h3 style={{ margin: '0 0 2px' }}>{title}</h3>
        <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>
          {found}/{total} found · ⭐ {score}
        </p>
      </button>
      {expanded && (
        <div style={{ padding: 'var(--space-2) var(--space-4) var(--space-3)', borderTop: '1px solid var(--color-line)' }}>
          {confirmDelete ? (
            <div className="row" style={{ gap: 6, alignItems: 'center' }}>
              <span className="muted" style={{ fontSize: '0.9rem', flex: 1 }}>Delete this record?</span>
              <Button variant="ghost" style={{ color: 'var(--color-danger, #ef4444)', fontSize: '0.85rem' }} onClick={onDelete} disabled={deleting}>
                {deleting ? '…' : 'Delete'}
              </Button>
              <Button variant="ghost" style={{ fontSize: '0.85rem' }} onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          ) : (
            <div className="row" style={{ gap: 6 }}>
              <Button variant="ghost" onClick={onResults}>Results →</Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(true)} style={{ color: 'var(--color-ink-soft)' }}>🗑</Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function ActiveTeamHuntCard({
  team,
  routeTitle,
  onRejoin,
}: {
  team: Team;
  routeTitle?: string;
  onRejoin: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 'var(--space-4)', cursor: 'pointer' }}
      >
        <h3 style={{ margin: '0 0 2px' }}>{routeTitle ?? 'Hunt'}</h3>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          👥 {team.name} · {team.members.length} member{team.members.length !== 1 ? 's' : ''}
        </p>
      </button>
      {expanded && (
        <div style={{ padding: 'var(--space-2) var(--space-4) var(--space-3)', borderTop: '1px solid var(--color-line)' }}>
          <Button variant="happy" onClick={onRejoin}>👥 Rejoin team hunt</Button>
        </div>
      )}
    </Card>
  );
}

function PublishedRouteCard({
  route,
  onPlay,
  onEdit,
  onDelete,
  deleting,
}: {
  route: RouteSummary;
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleCardClick() {
    setExpanded((e) => !e);
    if (expanded) setConfirmDelete(false);
  }

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={handleCardClick}
        style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 'var(--space-4)', cursor: 'pointer' }}
      >
        <h3 style={{ margin: '0 0 2px' }}>{route.title || 'Untitled hunt'}</h3>
        <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>
          {route.itemCount} {route.itemCount === 1 ? 'item' : 'items'}
          {route.avgRating !== undefined && ` · ⭐ ${route.avgRating.toFixed(1)}`}
        </p>
      </button>
      {expanded && (
        <div style={{ padding: 'var(--space-2) var(--space-4) var(--space-3)', borderTop: '1px solid var(--color-line)' }}>
          {confirmDelete ? (
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <span className="muted" style={{ fontSize: '0.9rem', flex: 1 }}>Delete this hunt permanently?</span>
              <Button variant="ghost" style={{ color: 'var(--color-danger, #ef4444)' }} onClick={onDelete} disabled={deleting}>
                {deleting ? '…' : '🗑 Yes, delete'}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          ) : (
            <div className="row" style={{ gap: 8 }}>
              <Button variant="happy" onClick={onPlay}>▶ Play</Button>
              <Button variant="ghost" onClick={onEdit}>✏️ Edit</Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(true)} style={{ color: 'var(--color-ink-soft)' }}>🗑</Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function DraftCard({ route, onContinue, onDelete }: { route: RouteSummary; onContinue: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleCardClick() {
    setExpanded((e) => !e);
    if (expanded) setConfirmDelete(false);
  }

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={handleCardClick}
        style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 'var(--space-4)', cursor: 'pointer' }}
      >
        <h3 style={{ margin: '0 0 2px' }}>{route.title || 'Untitled hunt'}</h3>
        <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>
          {route.itemCount} {route.itemCount === 1 ? 'item' : 'items'}
        </p>
      </button>
      {expanded && (
        <div style={{ padding: 'var(--space-2) var(--space-4) var(--space-3)', borderTop: '1px solid var(--color-line)' }}>
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
      )}
    </Card>
  );
}
