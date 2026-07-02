import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { api } from '../services/apiClient.js';
import { Banner, BottomBar, Button, Page, Spinner, useSetPageHeader } from '../ui/index.js';
import { AvailableHuntsSection } from './Home.js';
import { getStoredAvatarEmoji, getStoredAvatarImage } from '../services/avatarStorage.js';

/** Code entry form — shown at /join with no code yet. */
function JoinEntry() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');

  useSetPageHeader('Join a Hunt', () => navigate('/'));

  return (
    <Page>
      <div className="stack">
        <div className="stack" style={{ marginTop: 'var(--space-4)' }}>
          <p className="muted">Enter the join code shared by your hunt organiser.</p>
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter join code…"
            maxLength={8}
            style={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '1.4rem', textAlign: 'center' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && code.trim()) navigate(`/join/${code.trim()}`);
            }}
          />
          <Button
            variant="happy"
            disabled={!code.trim()}
            onClick={() => navigate(`/join/${code.trim()}`)}
          >
            Join →
          </Button>
        </div>

        <AvailableHuntsSection onHuntClick={(id) => navigate(`/hunt/${id}`)} />
      </div>
      <BottomBar
        onCreate={() => navigate('/build/new')}
        onJoin={() => {}}
        onMyHunts={() => navigate('/my-hunts')}
        onMyScores={() => navigate('/scores')}
        onMyHistory={() => navigate('/history')}
        activePage="join"
      />
    </Page>
  );
}

/** Auto-join component — receives code as prop so hooks always run. */
function JoinAuto({ code }: { code: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState<string>();

  useSetPageHeader('Joining…', () => navigate('/'));

  useEffect(() => {
    const avatarEmoji = user?.id ? (getStoredAvatarEmoji(user.id) || undefined) : undefined;
    const avatarImageUrl = user?.id ? (getStoredAvatarImage(user.id) || undefined) : undefined;
    api
      .joinTeamByCode(code, avatarEmoji, avatarImageUrl)
      .then((team) => navigate(`/team/${team.id}`, { replace: true }))
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Could not join the team — check the code and try again.'),
      );
  }, [code, navigate, user]);

  if (error) {
    return (
      <Page>
        <Banner tone="no">{error}</Banner>
      </Page>
    );
  }

  return (
    <Page>
      <Spinner label="Joining the team…" />
    </Page>
  );
}

/** Route component — delegates to entry form or auto-join based on URL param. */
export function JoinTeam() {
  const { code = '' } = useParams();
  return code ? <JoinAuto code={code} /> : <JoinEntry />;
}
