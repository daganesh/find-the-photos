import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { FinalItem, Item, ModerationIssue, Route } from '@ftp/shared';
import { getJigsawGridSize, isRoutePlayable } from '@ftp/shared';
import { api } from '../services/apiClient.js';
import { mediaUrl } from '../services/media.js';
import { useAsync } from '../hooks/useAsync.js';
import { Banner, Button, Card, Page, PhotoCapture, Spinner } from '../ui/index.js';
import { ItemEditor } from './ItemEditor.js';

type EditingState = Item | 'new' | 'new-task' | 'new-riddle' | 'new-jigsaw' | null;

/** The hider flow: build a route by adding items, then finalise it. */
export function RouteBuilder() {
  const { routeId = '' } = useParams();
  const navigate = useNavigate();
  const { data, loading, error } = useAsync(() => api.getRoute(routeId), [routeId]);

  const [route, setRoute] = useState<Route | null>(null);
  const [editing, setEditing] = useState<EditingState>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingFinalPhoto, setUploadingFinalPhoto] = useState(false);
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
      finalItem: next.finalItem ?? null,
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

  async function updateFinalItem(patch: Partial<FinalItem>) {
    const next: Route = { ...route!, finalItem: { ...(route!.finalItem ?? { kind: 'riddle', answer: '' }), ...patch } };
    await persist(next);
  }

  async function addFinalItemPhoto(file: File) {
    setUploadingFinalPhoto(true);
    try {
      const { url } = await api.uploadFile(file, file.name);
      await updateFinalItem({ photoUrl: url });
    } finally {
      setUploadingFinalPhoto(false);
    }
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
      await api.updateRoute(route!.id, {
        title: route!.title,
        description: route!.description,
        coverPhotoUrl: route!.coverPhotoUrl,
        items: route!.items,
        finalItem: route!.finalItem ?? null,
      });
      await api.finalizeRoute(route!.id);
      navigate(`/play/${route!.id}`);
    } catch (e) {
      setSaving(false);
    }
  }

  if (editing) {
    const isNew = editing === 'new' || editing === 'new-task' || editing === 'new-riddle' || editing === 'new-jigsaw';
    const defaultKind =
      editing === 'new-task' ? 'task' :
      editing === 'new-riddle' ? 'riddle' :
      editing === 'new-jigsaw' ? 'jigsaw' : 'photo';
    return (
      <Page onBack={() => setEditing(null)} title="Item">
        <ItemEditor
          initial={isNew ? undefined : (editing as Item)}
          defaultKind={defaultKind}
          onSave={saveItem}
          onCancel={() => setEditing(null)}
        />
      </Page>
    );
  }

  const finalItem = route.finalItem;
  const totalPositions = finalItem
    ? finalItem.kind === 'jigsaw'
      ? getJigsawGridSize(finalItem.difficulty ?? 1) ** 2
      : finalItem.answer.length
    : 0;
  const chunkSize = route.items.length > 0 && totalPositions > 0
    ? Math.ceil(totalPositions / route.items.length)
    : 0;

  return (
    <Page onBack title="Build your hunt">
      <div className="stack">
        <Card>
          <div className="stack">
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
            <div className="stack" style={{ gap: 'var(--space-2)' }}>
              <div className="row">
                <span style={{ fontSize: '1.5rem' }}>{i + 1}️⃣</span>
                <div>
                  <strong>{item.name || 'Untitled item'}</strong>
                  <div className="muted">
                    {item.kind === 'riddle'
                      ? `❓ ${item.hint.text?.slice(0, 50) ?? 'Riddle'}`
                      : item.kind === 'task'
                      ? `🎯 ${item.taskInstruction?.slice(0, 50) ?? 'Task'}`
                      : item.kind === 'jigsaw'
                      ? `🧩 Jigsaw ${item.jigsawDifficulty === 1 ? '3×3' : item.jigsawDifficulty === 2 ? '5×5' : '10×10'}`
                      : `${item.photos.length} photo${item.photos.length === 1 ? '' : 's'}${item.location ? ' · 📍' : ''}`
                    }
                    {finalItem && chunkSize > 0 && (
                      <span style={{ marginLeft: 6, color: 'var(--color-accent)' }}>
                        🏆 {chunkSize} clue{chunkSize !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <button className="btn btn--ghost" onClick={() => move(i, -1)} aria-label="Move up" style={{ width: 44, minWidth: 44, padding: 0 }}>↑</button>
                <button className="btn btn--ghost" onClick={() => move(i, 1)} aria-label="Move down" style={{ width: 44, minWidth: 44, padding: 0 }}>↓</button>
                <button className="btn btn--ghost" onClick={() => setEditing(item)} aria-label="Edit" style={{ width: 44, minWidth: 44, padding: 0 }}>✏️</button>
                <button className="btn btn--danger" onClick={() => removeItem(item.id)} aria-label="Delete" style={{ width: 44, minWidth: 44, padding: 0 }}>🗑</button>
              </div>
            </div>
          </Card>
        ))}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Button variant="ghost" size="lg" block style={{ background: '#fff0ee' }} onClick={() => setEditing('new')}>
            📷 Photo
          </Button>
          <Button variant="ghost" size="lg" block style={{ background: '#fffbeb' }} onClick={() => setEditing('new-task')}>
            🎯 Task
          </Button>
          <Button variant="ghost" size="lg" block style={{ background: '#f0fdf4' }} onClick={() => setEditing('new-riddle')}>
            ❓ Riddle
          </Button>
          <Button variant="ghost" size="lg" block style={{ background: '#f5f3ff' }} onClick={() => setEditing('new-jigsaw')}>
            🧩 Jigsaw
          </Button>
        </div>

        {/* ── Final item ─────────────────────────────────────────────────── */}
        <h2>Final item (optional)</h2>
        {finalItem ? (
          <Card>
            <div className="stack">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>🏆 Final item</strong>
                <Button variant="ghost" onClick={() => persist({ ...route, finalItem: undefined })}>Remove</Button>
              </div>

              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                {(['riddle', 'code', 'jigsaw'] as const).map((k) => (
                  <Button
                    key={k}
                    variant={finalItem.kind === k ? 'primary' : 'ghost'}
                    onClick={() => updateFinalItem({ kind: k })}
                  >
                    {k === 'riddle' ? '❓ Riddle' : k === 'code' ? '🔢 Code' : '🧩 Jigsaw'}
                  </Button>
                ))}
              </div>

              {finalItem.kind === 'riddle' && (
                <div>
                  <label className="field-label">Riddle question</label>
                  <textarea
                    rows={2}
                    value={finalItem.riddleQuestion ?? ''}
                    placeholder="Shown to players from the start…"
                    onChange={(e) => updateFinalItem({ riddleQuestion: e.target.value })}
                  />
                </div>
              )}

              {finalItem.kind === 'jigsaw' && (
                <>
                  <div>
                    <span className="field-label">Puzzle photo</span>
                    {finalItem.photoUrl && (
                      <img src={mediaUrl(finalItem.photoUrl)} alt="" style={{ width: '100%', borderRadius: 'var(--radius)', maxHeight: 160, objectFit: 'cover', marginBottom: 'var(--space-2)' }} />
                    )}
                    <PhotoCapture onCapture={addFinalItemPhoto} variant="accent" disabled={uploadingFinalPhoto}>
                      📷 {finalItem.photoUrl ? 'Change photo' : 'Add photo'}
                    </PhotoCapture>
                  </div>
                  <div>
                    <span className="field-label">Difficulty</span>
                    <div className="row" style={{ gap: 8 }}>
                      {([1, 2, 3] as const).map((d) => (
                        <Button key={d} variant={finalItem.difficulty === d ? 'primary' : 'ghost'} onClick={() => updateFinalItem({ difficulty: d })}>
                          {d === 1 ? '3×3' : d === 2 ? '5×5' : '10×10'}
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="field-label">{finalItem.kind === 'code' ? 'Code' : 'Answer'}</label>
                <input
                  value={finalItem.answer}
                  placeholder={finalItem.kind === 'code' ? 'e.g. CASTLE or 2847' : 'The final answer…'}
                  onChange={(e) => updateFinalItem({ answer: e.target.value })}
                />
              </div>

              {route.items.length > 0 && finalItem.answer && finalItem.kind !== 'jigsaw' && (
                <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
                  Each solved item reveals ~{chunkSize} character{chunkSize !== 1 ? 's' : ''} of the {finalItem.kind === 'code' ? 'code' : 'answer'}.
                </p>
              )}
              {route.items.length > 0 && finalItem.kind === 'jigsaw' && (
                <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
                  Each solved item reveals ~{chunkSize} of {totalPositions} puzzle piece{totalPositions !== 1 ? 's' : ''}.
                </p>
              )}
            </div>
          </Card>
        ) : (
          <Button
            variant="ghost"
            block
            onClick={() => persist({ ...route, finalItem: { kind: 'riddle', answer: '', riddleQuestion: '' } })}
          >
            🏆 Add a final item
          </Button>
        )}

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
