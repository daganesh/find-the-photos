import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Team } from '@ftp/shared';
import { useAuth } from '../auth/AuthContext.js';
import { api } from '../services/apiClient.js';
import { getCurrentLocation } from '../services/geolocation.js';
import { Banner, Button, Card, Page, Spinner } from '../ui/index.js';

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
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();

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
      const { team: t } = await api.startTeamHunt(teamId, location, reversed);
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

  return (
    <Page onBack title={team.name}>
      <div className="stack">
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
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'var(--tint-happy)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: m.avatarEmoji ? '1.3rem' : '1rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {m.avatarEmoji ?? m.name[0]?.toUpperCase()}
                </div>
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
