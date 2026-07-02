import { useState } from 'react';
import type { BugReport, CleanupResult, GeminiModelTestResponse, ReportSeverity, ReportStatus, StorageStats } from '@ftp/shared';
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

        <h2>Gemini Models</h2>
        <GeminiModelsPanel />

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

// ─── Gemini models panel ──────────────────────────────────────────────────────

const ROLE_LABELS: Record<GeminiModelTestResponse['results'][number]['role'], string> = {
  'text-primary': 'Text (primary)',
  'text-fallback': 'Text (fallback)',
  'image-primary': 'Image (primary)',
  'image-fallback': 'Image (fallback)',
};

function GeminiModelsPanel() {
  const [testing, setTesting] = useState(false);
  const [response, setResponse] = useState<GeminiModelTestResponse | null>(null);
  const [error, setError] = useState<string>();

  async function runTest() {
    setTesting(true);
    setError(undefined);
    setResponse(null);
    try {
      setResponse(await api.testGeminiModels());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to test models');
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card>
      <div className="stack">
        <div>
          <strong>Model accessibility</strong>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Send a minimal request to every configured Gemini model (primary + fallback, text + image) and confirm each one resolves and is reachable with the current API key.
          </p>
        </div>
        <Button variant="accent" disabled={testing} onClick={runTest}>
          {testing ? '⏳ Testing…' : '🧪 Test model access'}
        </Button>

        {error && <Banner tone="no">{error}</Banner>}

        {response && !response.configured && (
          <Banner tone="no">⚠️ Gemini is not configured (no API key) — running on dev stubs.</Banner>
        )}

        {response?.configured && (
          <div className="stack" style={{ gap: 6 }}>
            {response.results.map((r) => (
              <div key={r.role} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    {r.ok ? '✅' : '❌'} {ROLE_LABELS[r.role]}
                  </div>
                  <div className="muted" style={{ fontSize: '0.78rem' }}>{r.model}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="muted" style={{ fontSize: '0.78rem' }}>{r.message}</div>
                  <div className="muted" style={{ fontSize: '0.72rem' }}>{r.ms} ms</div>
                </div>
              </div>
            ))}
          </div>
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
  const [creatingIssue, setCreatingIssue] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  async function handleChange(
    report: BugReport,
    patch: { status?: ReportStatus; severity?: ReportSeverity; title?: string; description?: string },
  ) {
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

  async function handleCreateIssue(report: BugReport, assignToAgent: boolean) {
    setCreatingIssue(report.id);
    setSaveError(null);
    try {
      await api.createGithubIssue(report.id, { assignToAgent });
      reports.reload();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to create GitHub issue');
    } finally {
      setCreatingIssue(null);
    }
  }

  async function handleLink(parentId: string, targetId: string) {
    setSaveError(null);
    try {
      await api.linkReports(parentId, targetId);
      reports.reload();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to link reports');
    } finally {
      setLinkingId(null);
    }
  }

  async function handleUnlink(parentId: string, linkedId: string) {
    setSaveError(null);
    try {
      await api.unlinkReport(parentId, linkedId);
      reports.reload();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to unlink report');
    }
  }

  const all = reports.data?.reports ?? [];

  // Build the set of IDs that are children so we exclude them from the top-level list.
  const childIds = new Set(all.flatMap((r) => r.linkedReportIds ?? []));

  const filtered = all
    .filter((r) => typeFilter === 'all' || r.type === typeFilter)
    .filter((r) => statusFilter === 'all' || r.status === statusFilter);

  // Root reports: not referenced as a child by any other report.
  const sorted = filtered
    .filter((r) => !childIds.has(r.id))
    .sort((a, b) => {
      if (b.severity !== a.severity) return b.severity - a.severity;
      return b.createdAt.localeCompare(a.createdAt);
    });

  const activeCount = (type: 'bug' | 'feature') =>
    all.filter((r) => r.type === type && r.status !== 'done' && r.status !== 'dismissed').length;

  function exportCsv() {
    const header = ['id', 'type', 'severity', 'status', 'description', 'reporters', 'created_at'];
    const rows = filtered.map((r) => [
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

      {!reports.loading && sorted.length === 0 && (
        <Banner tone="ok">No reports match the current filters.</Banner>
      )}

      {filtered.length > 0 && (
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={exportCsv}>
            📥 Export CSV ({filtered.length})
          </Button>
        </div>
      )}

      {sorted.map((r) => {
        const linkedChildren = (r.linkedReportIds ?? [])
          .map((lid) => all.find((x) => x.id === lid))
          .filter((x): x is BugReport => x !== undefined);

        // Tickets available to link to this report: not already linked, not itself,
        // not already a child of any parent, and not itself a parent with children.
        const linkable = all.filter(
          (x) =>
            x.id !== r.id &&
            !(r.linkedReportIds ?? []).includes(x.id) &&
            !childIds.has(x.id) &&
            !x.linkedReportIds?.length,
        );

        return (
          <div key={r.id} className="stack" style={{ gap: 4 }}>
            <ReportCard
              report={r}
              isSaving={saving === r.id}
              isCreatingIssue={creatingIssue === r.id}
              isLinkingOpen={linkingId === r.id}
              linkableReports={linkable}
              onChange={(patch) => handleChange(r, patch)}
              onCreateIssue={(assignToAgent) => handleCreateIssue(r, assignToAgent)}
              onLinkToggle={() => setLinkingId(linkingId === r.id ? null : r.id)}
              onLink={(targetId) => handleLink(r.id, targetId)}
            />
            {linkedChildren.map((child) => (
              <div key={child.id} style={{ marginLeft: 24 }}>
                <LinkedReportCard
                  report={child}
                  isSaving={saving === child.id}
                  onChange={(patch) => handleChange(child, patch)}
                  onUnlink={() => handleUnlink(r.id, child.id)}
                />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ReportCard({
  report,
  isSaving,
  isCreatingIssue,
  isLinkingOpen,
  linkableReports,
  onChange,
  onCreateIssue,
  onLinkToggle,
  onLink,
}: {
  report: BugReport;
  isSaving: boolean;
  isCreatingIssue: boolean;
  isLinkingOpen: boolean;
  linkableReports: BugReport[];
  onChange: (patch: { status?: ReportStatus; severity?: ReportSeverity; title?: string; description?: string }) => void;
  onCreateIssue: (assignToAgent: boolean) => void;
  onLinkToggle: () => void;
  onLink: (targetId: string) => void;
}) {
  const [assignToAgent, setAssignToAgent] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(report.title ?? '');
  const [editDescription, setEditDescription] = useState(report.description);

  const date = new Date(report.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  function saveEdits() {
    onChange({ title: editTitle, description: editDescription });
    setIsEditing(false);
  }

  function cancelEdits() {
    setEditTitle(report.title ?? '');
    setEditDescription(report.description);
    setIsEditing(false);
  }

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
              {(report.linkedReportIds?.length ?? 0) > 0 && (
                <span style={{
                  display: 'inline-block', padding: '1px 8px', borderRadius: 999,
                  fontSize: '0.75rem', fontWeight: 600, background: '#7c3aed22', color: '#7c3aed',
                }}>
                  🔗 {report.linkedReportIds!.length} linked
                </span>
              )}
            </div>

            {isEditing ? (
              <div className="stack" style={{ gap: 6 }}>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Title (optional)"
                  style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem' }}
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  style={{ resize: 'vertical', fontSize: '0.9rem' }}
                />
                <div className="row" style={{ gap: 6 }}>
                  <Button variant="happy" onClick={saveEdits} disabled={isSaving || !editDescription.trim()}>
                    {isSaving ? 'Saving…' : 'Save'}
                  </Button>
                  <Button variant="ghost" onClick={cancelEdits}>Cancel</Button>
                </div>
              </div>
            ) : (
              <>
                {report.title && <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: '0.9rem' }}>{report.title}</p>}
                <p style={{ margin: 0, fontSize: '0.9rem' }}>{report.description}</p>
                {report.reporters.length > 0 && (
                  <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.75rem' }}>
                    {report.reporters.map((r) => r.name).join(', ')}
                  </p>
                )}
              </>
            )}
          </div>

          {!isEditing && (
            <Button variant="ghost" onClick={() => setIsEditing(true)} disabled={isSaving}>
              ✏️ Edit
            </Button>
          )}
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

          <Button variant="ghost" onClick={onLinkToggle} disabled={isSaving}>
            🔗 Link
          </Button>

          {isSaving && <span className="muted" style={{ fontSize: '0.8rem' }}>Saving…</span>}
        </div>

        {/* Link picker — shown when admin clicks the Link button */}
        {isLinkingOpen && (
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
            <p className="muted" style={{ margin: '0 0 6px', fontSize: '0.8rem' }}>
              Select a ticket to group with this one:
            </p>
            {linkableReports.length === 0 ? (
              <span className="muted" style={{ fontSize: '0.8rem' }}>No available tickets to link.</span>
            ) : (
              <div className="stack" style={{ gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                {linkableReports.map((lr) => (
                  <button
                    key={lr.id}
                    onClick={() => onLink(lr.id)}
                    style={{
                      textAlign: 'left', padding: '6px 10px', borderRadius: 6,
                      border: '1px solid #e5e7eb', background: '#fafafa',
                      cursor: 'pointer', fontSize: '0.85rem',
                    }}
                  >
                    <span className="muted" style={{ fontSize: '0.75rem', marginRight: 6 }}>
                      {lr.type === 'bug' ? '🐛' : '✨'}
                    </span>
                    {lr.title ?? lr.description.slice(0, 60)}
                    {!lr.title && lr.description.length > 60 ? '…' : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* GitHub issue: file the report and (optionally) hand it to Claude. */}
        {report.status !== 'done' && report.status !== 'new' && <div
          className="row"
          style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid #f0f0f0', paddingTop: 8 }}
        >
          {report.github ? (
            <>
              <a
                href={report.github.issueUrl}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '0.85rem', fontWeight: 600 }}
              >
                🐙 Issue #{report.github.issueNumber}
              </a>
              {report.github.assignedToAgent && (
                <span style={{
                  display: 'inline-block', padding: '1px 8px', borderRadius: 999,
                  fontSize: '0.75rem', fontWeight: 600, background: '#7c3aed22', color: '#7c3aed',
                }}>
                  🤖 Sent to Claude
                </span>
              )}
            </>
          ) : (
            <>
              <label className="row" style={{ gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={assignToAgent}
                  disabled={isCreatingIssue}
                  onChange={(e) => setAssignToAgent(e.target.checked)}
                />
                Send to agent
              </label>
              <Button
                variant="accent"
                disabled={isCreatingIssue}
                onClick={() => onCreateIssue(assignToAgent)}
              >
                {isCreatingIssue ? '⏳ Creating…' : '🐙 Create GitHub issue'}
              </Button>
            </>
          )}
        </div>}
      </div>
    </Card>
  );
}

// A compact card for a child (linked) report, with unlink and edit capabilities.
function LinkedReportCard({
  report,
  isSaving,
  onChange,
  onUnlink,
}: {
  report: BugReport;
  isSaving: boolean;
  onChange: (patch: { status?: ReportStatus; severity?: ReportSeverity; title?: string; description?: string }) => void;
  onUnlink: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(report.title ?? '');
  const [editDescription, setEditDescription] = useState(report.description);

  function saveEdits() {
    onChange({ title: editTitle, description: editDescription });
    setIsEditing(false);
  }

  function cancelEdits() {
    setEditTitle(report.title ?? '');
    setEditDescription(report.description);
    setIsEditing(false);
  }

  return (
    <Card>
      <div className="stack" style={{ gap: 6 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{
                display: 'inline-block', padding: '1px 8px', borderRadius: 999,
                fontSize: '0.7rem', fontWeight: 600, background: '#6b728022', color: '#6b7280',
              }}>
                🔗 Linked
              </span>
              <span className="muted" style={{ fontSize: '0.7rem' }}>
                {report.type === 'bug' ? '🐛 Bug' : '✨ Feature'}
              </span>
            </div>
            {isEditing ? (
              <div className="stack" style={{ gap: 6 }}>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Title (optional)"
                  style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  style={{ resize: 'vertical', fontSize: '0.85rem' }}
                />
                <div className="row" style={{ gap: 6 }}>
                  <Button variant="happy" onClick={saveEdits} disabled={isSaving || !editDescription.trim()}>
                    {isSaving ? 'Saving…' : 'Save'}
                  </Button>
                  <Button variant="ghost" onClick={cancelEdits}>Cancel</Button>
                </div>
              </div>
            ) : (
              <>
                {report.title && <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: '0.85rem' }}>{report.title}</p>}
                <p style={{ margin: 0, fontSize: '0.85rem' }}>{report.description}</p>
              </>
            )}
          </div>
          <div className="row" style={{ gap: 4 }}>
            {!isEditing && (
              <Button variant="ghost" onClick={() => setIsEditing(true)} disabled={isSaving}>
                ✏️
              </Button>
            )}
            <Button variant="ghost" onClick={onUnlink} disabled={isSaving}>
              ✂️ Unlink
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
