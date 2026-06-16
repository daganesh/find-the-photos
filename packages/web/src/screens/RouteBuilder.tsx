import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Item, ModerationIssue, Route } from '@ftp/shared';
import { isRoutePlayable } from '@ftp/shared';
import { api } from '../services/apiClient.js';
import { mediaUrl } from '../services/media.js';
import { useAsync } from '../hooks/useAsync.js';
import { Banner, Button, Card, Page, PhotoCapture, Spinner } from '../ui/index.js';
import { ItemEditor } from './ItemEditor.js';

/** The hider flow: build a route by adding items, then finalise it. */
export function RouteBuilder() {
  const { routeId = '' } = useParams();
  const navigate = useNavigate();
  const { data, loading, error } = useAsync(() => api.getRoute(routeId), [routeId]);

  const [route, setRoute] = useState<Route | null>(null);
  const [editing, setEditing] = useState<Item | 'new' | 'new-task' | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [moderationIssues, setModerationIssues] = useState<ModerationIssue[]>([]);

  useEffect(() => {
    if (data) setRoute(data);
  }, [data]);

  if (loading) return <Page onBack title="Build"><Spinner label="Loading…" /></Page>;
  if (error || !route) return <Page onBack title="Build"><p style={{ color: 'var(--color-danger)' }}>{error ?? 'Not found'}</p></Page>;

  async function persist(next: Route) {
    setRoute(next);
    await api.updateRoute(next.id, {
      title: next.title,
      description: next.description,
      coverPhotoUrl: next.coverPhotoUrl,
      items: next.items,
    });
  }

  async function addCoverPhoto(file: File) {
    setUploadingCover(true);
    try {
      const { url } = await api.uploadFile(file, file.name);
      await persist({ ...route!, coverPhotoUrl: url });
    } finally {
      setUploadingCover(false);
    }
  }

  async function saveItem(item: Item) {
    const exists = route!.items.some((i) => i.id === item.id);
    const items = exists
      ? route!.items.map((i) => (i.id === item.id ? item : i))
      : [...route!.items, item];
    await persist({ ...route!, items });
    setEditing(null);
  }

  async function removeItem(id: string) {
    await persist({ ...route!, items: route!.items.filter((i) => i.id !== id) });
  }

  async function move(index: number, dir: -1 | 1) {
    const items = [...route!.items];
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target]!, items[index]!];
    await persist({ ...route!, items });
  }

  async function finalize() {
    setSaving(true);
    setModerationIssues([]);
    try {
      const result = await api.moderateRoute(route!.id);
      if (result.flagged) {
        setModerationIssues(result.issues);
        setSaving(false);
        return;
      }
      await api.updateRoute(route!.id, { title: route!.title, description: route!.description, coverPhotoUrl: route!.coverPhotoUrl, items: route!.items });
      await api.finalizeRoute(route!.id);
      navigate(`/play/${route!.id}`);
    } catch (e) {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <Page onBack={() => setEditing(null)} title="Item">
        <ItemEditor
          initial={editing === 'new' || editing === 'new-task' ? undefined : editing}
          defaultKind={editing === 'new-task' ? 'task' : 'photo'}
          onSave={saveItem}
          onCancel={() => setEditing(null)}
        />
      </Page>
    );
  }

  return (
    <Page onBack title="Build your hunt">
      <div className="stack">
        <Card>
          <div className="stack">
            {/* Cover photo */}
            <div>
              <span className="field-label">Cover photo (optional)</span>
              {route.coverPhotoUrl ? (
                <div style={{ position: 'relative' }}>
                  <img
                    src={mediaUrl(route.coverPhotoUrl)}
                    alt="Cover"
                    style={{ width: '100%', borderRadius: 'var(--radius)', display: 'block', maxHeight: 200, objectFit: 'cover' }}
                  />
                  <PhotoCapture
                    onCapture={addCoverPhoto}
                    variant="ghost"
                    disabled={uploadingCover}
                    style={{ marginTop: 'var(--space-2)' }}
                  >
                    🔄 {uploadingCover ? 'Uploading…' : 'Change photo'}
                  </PhotoCapture>
                </div>
              ) : (
                <PhotoCapture onCapture={addCoverPhoto} variant="accent" disabled={uploadingCover}>
                  🖼 {uploadingCover ? 'Uploading…' : 'Add a cover photo'}
                </PhotoCapture>
              )}
            </div>

            <div>
              <label className="field-label" htmlFor="title">Hunt title</label>
              <input
                id="title"
                value={route.title}
                onChange={(e) => setRoute({ ...route, title: e.target.value })}
                onBlur={() => persist(route)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="desc">About this hunt</label>
              <textarea
                id="desc"
                rows={2}
                value={route.description ?? ''}
                placeholder="A walk around the park…"
                onChange={(e) => setRoute({ ...route, description: e.target.value })}
                onBlur={() => persist(route)}
              />
            </div>
          </div>
        </Card>

        <h2>Items ({route.items.length})</h2>
        {route.items.map((item, i) => (
          <Card key={item.id}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="row">
                <span style={{ fontSize: '1.5rem' }}>{i + 1}️⃣</span>
                <div>
                  <strong>{item.name || 'Untitled item'}</strong>
                  <div className="muted">
                    {item.kind === 'task'
                      ? `🎯 ${item.taskInstruction?.slice(0, 50) ?? 'Task'}`
                      : `${item.photos.length} photo${item.photos.length === 1 ? '' : 's'}${item.location ? ' · 📍' : ''}`
                    }
                  </div>
                </div>
              </div>
              <div className="row">
                <button className="btn btn--ghost" onClick={() => move(i, -1)} aria-label="Move up" style={{ width: 44, minWidth: 44, padding: 0 }}>↑</button>
                <button className="btn btn--ghost" onClick={() => move(i, 1)} aria-label="Move down" style={{ width: 44, minWidth: 44, padding: 0 }}>↓</button>
                <button className="btn btn--ghost" onClick={() => setEditing(item)} aria-label="Edit" style={{ width: 44, minWidth: 44, padding: 0 }}>✏️</button>
                <button className="btn btn--danger" onClick={() => removeItem(item.id)} aria-label="Delete" style={{ width: 44, minWidth: 44, padding: 0 }}>🗑</button>
              </div>
            </div>
          </Card>
        ))}

        <div className="row" style={{ gap: 8 }}>
          <Button variant="accent" size="lg" style={{ flex: 3 }} onClick={() => setEditing('new')}>
            ➕ Add a photo item
          </Button>
          <Button variant="ghost" size="lg" style={{ flex: 2 }} onClick={() => setEditing('new-task')}>
            🎯 Add a task
          </Button>
        </div>

        {moderationIssues.length > 0 && (
          <Card>
            <div className="stack">
              <Banner tone="no">⚠️ Please fix these issues before publishing:</Banner>
              {moderationIssues.map((issue, i) => (
                <div key={i}>
                  <strong style={{ fontSize: '0.85rem' }}>{issue.field}</strong>
                  <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.85rem' }}>{issue.reason}</p>
                </div>
              ))}
              <Button variant="ghost" onClick={() => setModerationIssues([])}>Dismiss</Button>
            </div>
          </Card>
        )}

        <Button
          variant="happy"
          size="lg"
          block
          onClick={finalize}
          disabled={!isRoutePlayable(route) || saving}
        >
          ✅ {saving ? 'Saving…' : route.status === 'ready' ? 'Save & play' : 'Finish & make ready'}
        </Button>
        {!isRoutePlayable(route) && <p className="muted center">Add a title and at least one item to finish.</p>}
      </div>
    </Page>
  );
}
