import { useState } from 'react';
import type { BugReport, CleanupResult, ReportSeverity, ReportStatus, StorageStats } from '@ftp/shared';
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
        <h2>Reports</h2>
        <ReportsPanel />

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

// ─── Reports panel ────────────────────────────────────────────────────────────

const STATUS_OPTIONS: ReportStatus[] = ['new', 'in_progress', 'done', 'dismissed'];
const STATUS_LABELS: Record<ReportStatus, string> = {
  new: 'New',
  in_progress: 'In progress',
  done: 'Done',
  dismissed: 'Dismissed',
};
const STATUS_COLORS: Record<ReportStatus, string> = {
  new: '#2563eb',
  in_progress: '#d97706',
  done: '#16a34a',
  dismissed: '#9ca3af',
};

function ReportsPanel() {
  const reports = useAsync(() => api.listReports(), []);
  const [typeFilter, setTypeFilter] = useState<'all' | 'bug' | 'feature'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ReportStatus>('all');
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleChange(report: BugReport, patch: { status?: ReportStatus; severity?: ReportSeverity }) {
    setSaving(report.id);
    setSaveError(null);
    try {
      await api.updateReport(report.id, patch);
      reports.reload();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(null);
    }
  }

  const all = reports.data?.reports ?? [];
  const visible = all
    .filter((r) => typeFilter === 'all' || r.type === typeFilter)
    .filter((r) => statusFilter === 'all' || r.status === statusFilter)
    .sort((a, b) => {
      if (b.severity !== a.severity) return b.severity - a.severity;
      return b.createdAt.localeCompare(a.createdAt);
    });

  const activeCount = (type: 'bug' | 'feature') =>
    all.filter((r) => r.type === type && r.status !== 'done' && r.status !== 'dismissed').length;

  function exportCsv() {
    const header = ['id', 'type', 'severity', 'status', 'description', 'reporters', 'created_at'];
    const rows = visible.map((r) => [
      r.id,
      r.type,
      String(r.severity),
      r.status,
      `"${r.description.replace(/"/g, '""')}"`,
      `"${r.reporters.map((rep) => rep.name).join('; ')}"`,
      new Date(r.createdAt).toISOString(),
    ]);
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reports-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="stack">
      {/* Type filter */}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {(['all', 'bug', 'feature'] as const).map((t) => (
          <Button key={t} variant={typeFilter === t ? 'happy' : 'ghost'} onClick={() => setTypeFilter(t)}>
            {t === 'all'
              ? `All (${activeCount('bug') + activeCount('feature')})`
              : t === 'bug'
              ? `🐛 Bugs (${activeCount('bug')})`
              : `✨ Features (${activeCount('feature')})`}
          </Button>
        ))}
      </div>

      {/* Status filter */}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Button variant={statusFilter === 'all' ? 'accent' : 'ghost'} onClick={() => setStatusFilter('all')}>
          Any status
        </Button>
        {STATUS_OPTIONS.map((s) => (
          <Button key={s} variant={statusFilter === s ? 'accent' : 'ghost'} onClick={() => setStatusFilter(s)}>
            {STATUS_LABELS[s]}
          </Button>
        ))}
      </div>

      {reports.loading && <Spinner label="Loading reports…" />}
      {reports.error && <Banner tone="no">{String(reports.error)}</Banner>}
      {saveError && <Banner tone="no">{saveError}</Banner>}

      {!reports.loading && visible.length === 0 && (
        <Banner tone="ok">No reports match the current filters.</Banner>
      )}

      {visible.length > 0 && (
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={exportCsv}>
            📥 Export CSV ({visible.length})
          </Button>
        </div>
      )}

      {visible.map((r) => (
        <ReportCard
          key={r.id}
          report={r}
          isSaving={saving === r.id}
          onChange={(patch) => handleChange(r, patch)}
        />
      ))}
    </div>
  );
}

function ReportCard({
  report,
  isSaving,
  onChange,
}: {
  report: BugReport;
  isSaving: boolean;
  onChange: (patch: { status?: ReportStatus; severity?: ReportSeverity }) => void;
}) {
  const date = new Date(report.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <Card>
      <div className="stack" style={{ gap: 8 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{
                display: 'inline-block', padding: '1px 8px', borderRadius: 999,
                fontSize: '0.75rem', fontWeight: 600,
                background: STATUS_COLORS[report.status] + '22',
                color: STATUS_COLORS[report.status],
              }}>
                {STATUS_LABELS[report.status]}
              </span>
              <span className="muted" style={{ fontSize: '0.75rem' }}>
                {report.type === 'bug' ? '🐛 Bug' : '✨ Feature'}
              </span>
              <span className="muted" style={{ fontSize: '0.75rem' }}>
                {report.reporters.length} reporter{report.reporters.length !== 1 ? 's' : ''}
              </span>
              <span className="muted" style={{ fontSize: '0.75rem' }}>{date}</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>{report.description}</p>
            {report.reporters.length > 0 && (
              <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.75rem' }}>
                {report.reporters.map((r) => r.name).join(', ')}
              </p>
            )}
          </div>
        </div>

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="field-label" style={{ fontSize: '0.7rem' }}>Status</span>
            <select
              disabled={isSaving}
              value={report.status}
              onChange={(e) => onChange({ status: e.target.value as ReportStatus })}
              style={{ fontSize: '0.85rem', padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db' }}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="field-label" style={{ fontSize: '0.7rem' }}>Severity</span>
            <div className="row" style={{ gap: 4 }}>
              {([1, 2, 3] as ReportSeverity[]).map((s) => (
                <button
                  key={s}
                  disabled={isSaving}
                  onClick={() => onChange({ severity: s })}
                  style={{
                    padding: '3px 10px', borderRadius: 6, border: '1px solid', cursor: 'pointer',
                    fontSize: '0.8rem',
                    borderColor: report.severity === s ? '#2563eb' : '#d1d5db',
                    background: report.severity === s ? '#eff6ff' : 'transparent',
                    color: report.severity === s ? '#2563eb' : 'inherit',
                    fontWeight: report.severity === s ? 600 : 400,
                  }}
                >
                  {s === 1 ? 'Low' : s === 2 ? 'Med' : 'High'}
                </button>
              ))}
            </div>
          </div>

          {isSaving && <span className="muted" style={{ fontSize: '0.8rem' }}>Saving…</span>}
        </div>
      </div>
    </Card>
  );
}
