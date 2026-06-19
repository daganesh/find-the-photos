import { useState } from 'react';
import type { BugReport, ReportSeverity, ReportType } from '@ftp/shared';
import { api } from '../services/apiClient.js';
import { useAsync } from '../hooks/useAsync.js';
import { Banner, Button, Card, Page, Spinner } from '../ui/index.js';

const STATUS_LABELS: Record<BugReport['status'], string> = {
  new: 'New',
  in_progress: 'In progress',
  done: 'Done',
  dismissed: 'Dismissed',
};

const STATUS_COLORS: Record<BugReport['status'], string> = {
  new: '#2563eb',
  in_progress: '#d97706',
  done: '#16a34a',
  dismissed: '#9ca3af',
};

export function Report() {
  const reports = useAsync(() => api.listReports(), []);
  const [type, setType] = useState<ReportType>('bug');
  const [severity, setSeverity] = useState<ReportSeverity>(2);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (description.trim().length < 10) {
      setError('Please describe the issue in at least 10 characters.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { merged } = await api.submitReport({ description: description.trim(), type, severity });
      setSuccessMsg(merged ? 'Thanks — your report was merged with an existing one!' : 'Report submitted!');
      setDescription('');
      reports.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const list = [...(reports.data?.reports ?? [])].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );

  return (
    <Page onBack title="🐛 Report / Feedback">
      <div className="stack">
        <Card>
          <div className="stack">
            <span className="field-label">Type</span>
            <div className="row" style={{ gap: 8 }}>
              <Button variant={type === 'bug' ? 'happy' : 'ghost'} onClick={() => setType('bug')}>🐛 Bug</Button>
              <Button variant={type === 'feature' ? 'happy' : 'ghost'} onClick={() => setType('feature')}>✨ Feature</Button>
            </div>

            <span className="field-label">Severity</span>
            <div className="row" style={{ gap: 8 }}>
              {([1, 2, 3] as ReportSeverity[]).map((s) => (
                <Button key={s} variant={severity === s ? 'happy' : 'ghost'} onClick={() => setSeverity(s)}>
                  {s === 1 ? '1 Low' : s === 2 ? '2 Medium' : '3 High'}
                </Button>
              ))}
            </div>

            <span className="field-label">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={type === 'bug' ? 'What went wrong? What did you expect?' : 'What would you like to see?'}
              rows={4}
              style={{ resize: 'vertical' }}
              disabled={submitting}
            />

            {error && <Banner tone="no">{error}</Banner>}
            {successMsg && <Banner tone="ok">{successMsg}</Banner>}

            <Button variant="happy" block disabled={submitting || !description.trim()} onClick={handleSubmit}>
              {submitting ? 'Submitting…' : '📤 Submit'}
            </Button>
          </div>
        </Card>

        {reports.loading && <Spinner label="Loading reports…" />}

        {list.length > 0 && (
          <>
            <h3 style={{ margin: 0 }}>All reports</h3>
            {list.map((r) => (
              <Card key={r.id}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{
                        display: 'inline-block', padding: '1px 8px', borderRadius: 999,
                        fontSize: '0.75rem', fontWeight: 600,
                        background: STATUS_COLORS[r.status] + '22',
                        color: STATUS_COLORS[r.status],
                      }}>
                        {STATUS_LABELS[r.status]}
                      </span>
                      <span className="muted" style={{ fontSize: '0.75rem' }}>
                        {r.type === 'bug' ? '🐛' : '✨'} · Severity {r.severity}
                      </span>
                      <span className="muted" style={{ fontSize: '0.75rem' }}>
                        👤 {r.reporters.length}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>
                      {r.description.length > 120 ? r.description.slice(0, 120) + '…' : r.description}
                    </p>
                    <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.75rem' }}>
                      {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </>
        )}
      </div>
    </Page>
  );
}
