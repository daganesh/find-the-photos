import { useState } from 'react';
import type { BugReport, ReportSeverity, ReportType } from '@ftp/shared';
import { api } from '../services/apiClient.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../auth/AuthContext.js';
import { Banner, Button, Card, Page, Spinner } from '../ui/index.js';

const MAX_IMAGES = 3;
const MAX_DIM = 1024;
const JPEG_QUALITY = 0.82;

async function resizeImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { naturalWidth: w, naturalHeight: h } = img;
      if (w <= MAX_DIM && h <= MAX_DIM) { resolve(file); return; }
      const scale = MAX_DIM / Math.max(w, h);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file),
        'image/jpeg',
        JPEG_QUALITY,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

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

interface ImageEntry {
  previewUrl: string;
  file: File;
}

export function Report() {
  const { user } = useAuth();
  const reports = useAsync(() => api.listReports(), []);
  const [type, setType] = useState<ReportType>('bug');
  const [severity, setSeverity] = useState<ReportSeverity>(2);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');

  async function handleImageFiles(files: FileList) {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) return;
    const toAdd = Array.from(files).slice(0, remaining);
    const resized = await Promise.all(toAdd.map(resizeImage));
    const entries: ImageEntry[] = resized.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setImages((prev) => [...prev, ...entries]);
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index]!.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSubmit() {
    if (description.trim().length < 10) {
      setError('Please describe the issue in at least 10 characters.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const imageUrls: string[] = [];
      for (const entry of images) {
        const { url } = await api.uploadFile(entry.file, entry.file.name);
        imageUrls.push(url);
      }
      const { merged } = await api.submitReport({
        title: title.trim() || undefined,
        description: description.trim(),
        type,
        severity,
        ...(imageUrls.length ? { imageUrls } : {}),
      });
      setSuccessMsg(merged ? 'Thanks — your report was merged with an existing one!' : 'Report submitted!');
      setDescription('');
      setTitle('');
      for (const entry of images) URL.revokeObjectURL(entry.previewUrl);
      setImages([]);
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
            <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="field-label" style={{ minWidth: 60 }}>Type</span>
              <Button variant={type === 'bug' ? 'happy' : 'ghost'} onClick={() => setType('bug')}>🐛 Bug</Button>
              <Button variant={type === 'feature' ? 'happy' : 'ghost'} onClick={() => setType('feature')}>✨ Feature</Button>
            </div>

            <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="field-label" style={{ minWidth: 60 }}>Severity</span>
              {([1, 2, 3] as ReportSeverity[]).map((s) => (
                <Button key={s} variant={severity === s ? 'happy' : 'ghost'} onClick={() => setSeverity(s)}>
                  {s === 1 ? '1 Low' : s === 2 ? '2 Medium' : '3 High'}
                </Button>
              ))}
            </div>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Feature/Report Title"
              disabled={submitting}
              style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.95rem', color: title ? undefined : '#9ca3af' }}
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Feature/Report Description"
              rows={4}
              style={{ resize: 'vertical' }}
              disabled={submitting}
            />

            <div>
              <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="field-label" style={{ minWidth: 60 }}>Photos</span>
                {images.length < MAX_IMAGES && (
                  <label
                    className="btn btn--ghost"
                    aria-disabled={submitting}
                    style={{ cursor: submitting ? 'not-allowed' : 'pointer' }}
                  >
                    📎 Add image ({images.length}/{MAX_IMAGES})
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={submitting}
                      style={{ display: 'none' }}
                      onChange={(e) => { if (e.target.files?.length) handleImageFiles(e.target.files); e.target.value = ''; }}
                    />
                  </label>
                )}
              </div>
              {images.length > 0 && (
                <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {images.map((entry, i) => (
                    <div key={entry.previewUrl} style={{ position: 'relative' }}>
                      <img
                        src={entry.previewUrl}
                        alt={`Attachment ${i + 1}`}
                        style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid #d1d5db' }}
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        disabled={submitting}
                        aria-label="Remove image"
                        style={{
                          position: 'absolute', top: -6, right: -6,
                          width: 20, height: 20, borderRadius: '50%',
                          background: '#ef4444', color: '#fff',
                          border: 'none', cursor: 'pointer', fontSize: '0.7rem',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          lineHeight: 1, padding: 0,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
            <h3 style={{ margin: 0 }}>{user?.isAdmin ? 'All reports' : 'Your reports'}</h3>
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
