import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { api } from '../services/apiClient.js';
import { Banner, Page, Spinner } from '../ui/index.js';

/** Auto-join a team via 6-char join code in the URL, then redirect to the lobby. */
export function JoinTeam() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!code) { navigate('/'); return; }
    const avatarEmoji = user?.id ? (localStorage.getItem(`ftp.avatar.${user.id}`) ?? undefined) : undefined;
    api.joinTeamByCode(code, avatarEmoji)
      .then((team) => navigate(`/team/${team.id}`, { replace: true }))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not join the team — check the code and try again.'));
  }, [code, navigate, user]);

  if (error) {
    return (
      <Page onBack title="Join Team">
        <Banner tone="no">{error}</Banner>
      </Page>
    );
  }

  return (
    <Page title="Joining…">
      <Spinner label="Joining the team…" />
    </Page>
  );
}
