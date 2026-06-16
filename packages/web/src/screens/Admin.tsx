import { useState } from 'react';
import type { CleanupResult, StorageStats } from '@ftp/shared';
import { useAuth } from '../auth/AuthContext.js';
import { api } from '../services/apiClient.js';
import { useAsync } from '../hooks/useAsync.js';
import { Banner, Button, Card, Page, Spinner } from '../ui/index.js';

export function Admin() {
  const { user } = useAuth();
  const stats = useAsync(() => api.getStorageStats(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ label: string; r: CleanupResult } | null>(null);
  const [error, setError] = useState<string>();

  if (!user?.isAdmin) {
    return <Page onBack title="Admin"><Banner tone="no">Access denied.</Banner></Page>;
  }

  async function run(label: string, action: () => Promise<CleanupResult>) {
    setBusy(label);
    setError(undefined);
    setResult(null);
    try {
      const r = await action();
      setResult({ label, r });
      stats.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Page onBack title="Admin">
      <div className="stack">
        <h2>Storage</h2>

        {stats.loading && <Spinner label="Loading stats…" />}
        {stats.error && <Banner tone="no">{stats.error}</Banner>}

        {stats.data && <StatsCard stats={stats.data} />}

        <h2>Cleanup</h2>
        <Card>
          <div className="stack">
            <div>
              <strong>Orphaned photos</strong>
              <p className="muted" style={{ margin: '4px 0 0' }}>
                Delete uploaded photos no longer referenced by any route or hunt session.
              </p>
            </div>
            <Button
              variant="accent"
              disabled={busy !== null}
              onClick={() => run('orphaned-photos', () => api.cleanupOrphanedPhotos())}
            >
              {busy === 'orphaned-photos' ? '⏳ Cleaning…' : '🧹 Remove orphaned photos'}
            </Button>
          </div>
        </Card>

        <Card>
          <div className="stack">
            <div>
              <strong>Old finished sessions</strong>
              <p className="muted" style={{ margin: '4px 0 0' }}>
                Delete completed hunt sessions and finished teams older than 30 days.
              </p>
            </div>
            <Button
              variant="accent"
              disabled={busy !== null}
              onClick={() => run('old-sessions', () => api.cleanupOldSessions(30))}
            >
              {busy === 'old-sessions' ? '⏳ Cleaning…' : '🗑 Delete sessions older than 30 days'}
            </Button>
          </div>
        </Card>

        {result && (
          <Banner tone="ok">
            ✅ {result.label}: deleted {result.r.deleted} item{result.r.deleted !== 1 ? 's' : ''}
            {result.r.freedMb > 0.05 ? `, freed ${result.r.freedMb.toFixed(1)} MB` : ''}
          </Banner>
        )}
        {error && <Banner tone="no">{error}</Banner>}
      </div>
    </Page>
  );
}

function StatsCard({ stats }: { stats: StorageStats }) {
  const modeLabel = { postgres: 'PostgreSQL', s3: 'S3', local: 'Local disk (dev)' }[stats.mode];
  return (
    <Card>
      <div className="stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="field-label">Mode</span>
          <span>{modeLabel}</span>
        </div>

        {stats.db && (
          <>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="field-label">Database total</span>
              <strong>{stats.db.totalMb.toFixed(1)} MB</strong>
            </div>
            {Object.entries(stats.db.tables).map(([name, t]) => (
              <div key={name} className="row" style={{ justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span className="muted">{name}</span>
                <span className="muted">{t.rows} rows · {t.sizeMb.toFixed(2)} MB</span>
              </div>
            ))}
          </>
        )}

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="field-label">Photos</span>
          <span>{stats.photos.count} files · {stats.photos.totalMb.toFixed(1)} MB</span>
        </div>

        {stats.warnings.map((w) => (
          <Banner key={w} tone="no">⚠️ {w}</Banner>
        ))}
        {stats.warnings.length === 0 && (
          <Banner tone="ok">✅ Storage looks healthy</Banner>
        )}
      </div>
    </Card>
  );
}
