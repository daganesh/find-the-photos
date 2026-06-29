import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { api } from '../services/apiClient.js';
import { mediaUrl } from '../services/media.js';
import { googleMapsLink } from '../services/maps.js';
import { useAsync } from '../hooks/useAsync.js';
import { Banner, Button, Card, Page, Spinner, StarRating } from '../ui/index.js';

export function HuntStart() {
  const { routeId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: route, loading, error } = useAsync(() => api.getRoute(routeId), [routeId]);
  const [teaming, setTeaming] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [copied, setCopied] = useState(false);

  async function startTeam() {
    setTeaming(true);
    setTeamError('');
    try {
      const avatarEmoji = user?.id ? (localStorage.getItem(`ftp.avatar.${user.id}`) ?? undefined) : undefined;
      const team = await api.createTeam(routeId, user?.name ?? undefined, avatarEmoji);
      navigate(`/team/${team.id}`);
    } catch (e) {
      setTeamError(e instanceof Error ? e.message : 'Could not create team');
      setTeaming(false);
    }
  }

  function share() {
    const url = `${window.location.origin}/play/${routeId}`;
    if (navigator.share) {
      navigator.share({ title: route?.title ?? 'Find the Photos', url }).catch(() => undefined);
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  if (loading) return <Page onBack title="Start Hunt"><Spinner label="Loading…" /></Page>;
  if (error || !route) return <Page onBack title="Start Hunt"><Banner tone="no">{error ?? 'Not found'}</Banner></Page>;

  const hasCover = Boolean(route.coverPhotoUrl);
  const isMine = route.authorId === user?.id;
  const firstItem = route.items[0];
  const lastItem = route.items.at(-1);
  const startLoc = firstItem?.location;
  const endLoc = lastItem?.location && lastItem.id !== firstItem?.id ? lastItem.location : undefined;

  return (
    <Page onBack title="Start Hunt">
      <div className="stack">
        {hasCover && (
          <div
            style={{
              width: '100%',
              height: 200,
              borderRadius: 'var(--radius-lg)',
              backgroundImage: `linear-gradient(rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.55) 100%), url(${mediaUrl(route.coverPhotoUrl!)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex',
              alignItems: 'flex-end',
              padding: 'var(--space-4)',
            }}
          >
            <div>
              <h2 style={{ margin: 0, color: '#fff' }}>{route.title}</h2>
              <p className="muted" style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.78)', fontSize: '0.9rem' }}>
                {route.items.length} item{route.items.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        )}

        {!hasCover && (
          <div>
            <h3 style={{ margin: 0 }}>{route.title}</h3>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              {route.items.length} item{route.items.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        {route.avgRating !== undefined && (
          <StarRating value={Math.round(route.avgRating)} />
        )}

        {route.description && (
          <p className="muted" style={{ margin: 0 }}>{route.description}</p>
        )}

        {(startLoc || endLoc) && (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {startLoc && (
              <a href={googleMapsLink(startLoc.lat, startLoc.lng)} target="_blank" rel="noreferrer" className="btn btn--ghost" style={{ fontSize: '0.85rem' }}>
                📍 Start
              </a>
            )}
            {endLoc && (
              <a href={googleMapsLink(endLoc.lat, endLoc.lng)} target="_blank" rel="noreferrer" className="btn btn--ghost" style={{ fontSize: '0.85rem' }}>
                🏁 End
              </a>
            )}
          </div>
        )}

        {teamError && <Banner tone="no">{teamError}</Banner>}

        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
          <Card style={{ flex: 1, minWidth: 0 }}>
            <div className="stack">
              <Button size="lg" block variant="happy" onClick={() => navigate(`/play/${routeId}`)}>
                ▶ Start Solo
              </Button>
              <Button size="lg" block variant="accent" disabled={teaming} onClick={startTeam}>
                {teaming ? '⏳ Creating…' : '👥 Team'}
              </Button>
              <Button size="lg" block variant="ghost" onClick={share}>
                {copied ? '✅ Link copied!' : '🔗 Share link'}
              </Button>
              {isMine && (
                <Button block variant="ghost" onClick={() => navigate(`/build/${routeId}`)}>
                  ✏️ Edit
                </Button>
              )}
            </div>
          </Card>
          <img
            src="/fox-camera.png"
            alt=""
            aria-hidden="true"
            style={{
              width: 110,
              height: 'auto',
              flexShrink: 0,
              filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.18))',
            }}
          />
        </div>
      </div>
    </Page>
  );
}
