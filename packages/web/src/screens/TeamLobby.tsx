import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Team } from '@ftp/shared';
import { useAuth } from '../auth/AuthContext.js';
import { api } from '../services/apiClient.js';
import { useAsync } from '../hooks/useAsync.js';
import { getCurrentLocation } from '../services/geolocation.js';
import { mediaUrl } from '../services/media.js';
import { googleMapsLink } from '../services/maps.js';
import { Avatar, Banner, Button, Card, Page, Spinner } from '../ui/index.js';

const POLL_MS = 2500;

/** Pre-hunt lobby: show the join code, member list, and let the owner start. */
export function TeamLobby() {
  const { teamId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [team, setTeam] = useState<Team>();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [reversed, setReversed] = useState(false);
  const [openItemLimit, setOpenItemLimit] = useState(5);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();

  const route = useAsync(
    () => team?.routeId ? api.getRoute(team.routeId) : Promise.resolve(undefined),
    [team?.routeId],
  );

  // Poll team state so all members see the lobby refresh.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    async function poll() {
      try {
        const t = await api.getTeam(teamId);
        if (!cancelled) {
          setTeam(t);
          setLoading(false);
          if (t.status === 'playing' && t.sessionId) {
            navigate(`/team/${teamId}/play`, { replace: true });
            return;
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load team');
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    }

    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [teamId, navigate]);

  const isOwner = team?.ownerId === user?.id;
  const joinUrl = `${window.location.origin}/join/${team?.joinCode ?? ''}`;
  const ownerName = team?.members.find((m) => m.userId === team.ownerId)?.name ?? 'the owner';

  function shareCode() {
    if (navigator.share) {
      navigator.share({ title: 'Join my hunt!', url: joinUrl }).catch(() => undefined);
    } else {
      navigator.clipboard.writeText(joinUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      });
    }
  }

  async function handleStart() {
    setStarting(true);
    setError(undefined);
    try {
      const location = await getCurrentLocation().catch(() => undefined);
      const effectiveLimit = Math.max(1, Math.min(openItemLimit, team?.members.length ?? openItemLimit));
      const { team: t } = await api.startTeamHunt(teamId, location, reversed, effectiveLimit);
      setTeam(t);
      if (t.status === 'playing') {
        navigate(`/team/${teamId}/play`, { replace: true });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the hunt');
      setStarting(false);
    }
  }

  if (loading && !team) return <Page title="Team Lobby"><Spinner label="Loading…" /></Page>;

  if (!team) {
    return (
      <Page onBack title="Team Lobby">
        <Banner tone="no">{error ?? 'Team not found'}</Banner>
      </Page>
    );
  }

  const routeItems = route.data?.items ?? [];
  const startItem = reversed ? routeItems.at(-1) : routeItems[0];
  const endItem   = reversed ? routeItems[0]     : routeItems.at(-1);
  const showEnd   = endItem && endItem.id !== startItem?.id;

  return (
    <Page onBack title={team.name}>
      <div className="stack">
        {/* Route cover + start/end */}
        {route.data && (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {route.data.coverPhotoUrl && (
              <img
                src={mediaUrl(route.data.coverPhotoUrl)}
                alt=""
                style={{ width: '100%', display: 'block', maxHeight: 200, objectFit: 'cover' }}
              />
            )}
            <div className="stack center" style={{ padding: 'var(--space-3) var(--space-4)' }}>
              <h3 style={{ margin: 0 }}>{route.data.title}</h3>
              <p className="muted" style={{ margin: 0 }}>
                {routeItems.length} item{routeItems.length !== 1 ? 's' : ''} to find
              </p>
              {(startItem?.location || (showEnd && endItem?.location)) && (
                <div className="row" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {startItem?.location && (
                    <a href={googleMapsLink(startItem.location.lat, startItem.location.lng)} target="_blank" rel="noreferrer" className="btn btn--ghost" style={{ fontSize: '0.85rem' }}>
                      📍 Starting point
                    </a>
                  )}
                  {showEnd && endItem?.location && (
                    <a href={googleMapsLink(endItem.location.lat, endItem.location.lng)} target="_blank" rel="noreferrer" className="btn btn--ghost" style={{ fontSize: '0.85rem' }}>
                      🏁 End point
                    </a>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Join code */}
        <Card>
          <div className="stack center">
            <div style={{ fontSize: '2.5rem' }}>🤝</div>
            <p className="muted" style={{ margin: 0 }}>Invite friends with this code:</p>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '2.4rem',
                fontWeight: 700,
                letterSpacing: '0.18em',
                padding: '10px 24px',
                background: 'var(--tint-happy)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text)',
              }}
            >
              {team.joinCode}
            </div>
            <Button block variant="accent" onClick={shareCode}>
              {copied ? '✅ Copied!' : '🔗 Share invite link'}
            </Button>
          </div>
        </Card>

        {/* Members */}
        <Card>
          <div className="stack">
            <span className="field-label">Team members ({team.members.length})</span>
            {team.members.map((m) => (
              <div key={m.userId} className="row" style={{ alignItems: 'center', gap: 10 }}>
                <Avatar name={m.name} emoji={m.avatarEmoji} imageUrl={m.avatarImageUrl} size={42} />
                <span style={{ flex: 1 }}>{m.name}</span>
                {m.userId === team.ownerId && (
                  <span className="muted" style={{ fontSize: '0.8rem' }}>captain</span>
                )}
              </div>
            ))}
          </div>
        </Card>

        {error && <Banner tone="no">{error}</Banner>}

        {isOwner ? (
          <>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="muted" style={{ fontSize: '0.9rem' }}>
                {reversed ? '🔄 Playing reversed order' : '▶ Playing original order'}
              </span>
              <Button variant="ghost" onClick={() => setReversed((r) => !r)}>
                {reversed ? 'Play original' : 'Play reversed'}
              </Button>
            </div>

            <Card>
              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="field-label" style={{ margin: 0 }}>Open clues at once</span>
                  <strong style={{ fontSize: '1.3rem', minWidth: 28, textAlign: 'center' }}>{Math.min(openItemLimit, team.members.length)}</strong>
                </div>
                <input
                  type="range"
                  min={1}
                  max={Math.min(10, team.members.length)}
                  value={openItemLimit}
                  onChange={(e) => setOpenItemLimit(Number(e.target.value))}
                  style={{ width: '100%' }}
                  aria-label="Number of clues open simultaneously"
                />
                <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>
                  {Math.min(openItemLimit, team.members.length) === 1
                    ? 'Everyone focuses on the same clue.'
                    : `Up to ${Math.min(openItemLimit, team.members.length)} clues active at once — capped by team size.`}
                </p>
              </div>
            </Card>

            <Button size="lg" block variant="happy" onClick={handleStart} disabled={starting}>
              {starting ? 'Starting…' : '▶ Start Hunt'}
            </Button>
          </>
        ) : (
          <Card>
            <p className="center muted" style={{ margin: 0 }}>
              ⏳ Waiting for {ownerName} to start the hunt…
            </p>
          </Card>
        )}
      </div>
    </Page>
  );
}
