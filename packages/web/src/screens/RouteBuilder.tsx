import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { RouteVisibility } from '@ftp/shared';
import type { FinalItem, Item, ModerationIssue, Route } from '@ftp/shared';
import { getJigsawGridSize, isRoutePlayable } from '@ftp/shared';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../services/apiClient.js';
import { mediaUrl } from '../services/media.js';
import { googleMapsLink } from '../services/maps.js';
import { useAsync } from '../hooks/useAsync.js';
import { Banner, BottomBar, Button, Card, Page, PhotoCapture, Spinner, useSetPageHeader } from '../ui/index.js';
import { ItemEditor } from './ItemEditor.js';

type EditingState = Item | 'new' | 'new-task' | 'new-riddle' | 'new-jigsaw' | null;

interface SortableItemCardProps {
  item: Item;
  index: number;
  finalItem: FinalItem | null | undefined;
  chunkSize: number;
  onEdit: (item: Item) => void;
  onRemove: (id: string) => void;
}

function SortableItemCard({ item, index, finalItem, chunkSize, onEdit, onRemove }: SortableItemCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {/* Drag handle — only this initiates drag */}
          <button
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 6px',
              cursor: 'grab',
              color: 'var(--color-ink-soft)',
              fontSize: '1.1rem',
              flexShrink: 0,
              touchAction: 'none',
            }}
          >
            ⋮⋮
          </button>

          {/* Card body — tap to edit */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => onEdit(item)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onEdit(item)}
            style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}
            aria-label={`Edit ${item.name || 'untitled item'}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{index + 1}️⃣</span>
              <div style={{ minWidth: 0 }}>
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
          </div>

          {/* Delete button — plain ✕, no red background */}
          <button
            onClick={() => onRemove(item.id)}
            aria-label="Delete item"
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 6px',
              cursor: 'pointer',
              color: 'var(--color-ink-soft)',
              fontSize: '1rem',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
      </Card>
    </div>
  );
}

/** The hider flow: build a route by adding items, then finalise it. */
export function RouteBuilder() {
  const { routeId = '' } = useParams();
  const navigate = useNavigate();

  // 'new' mode: don't hit the server until the user makes a real change
  const isNewMode = routeId === 'new';

  // Tracks the actual server-side route id (null until first persist in new mode)
  const serverRouteIdRef = useRef<string | null>(isNewMode ? null : routeId);

  const { data, loading, error } = useAsync(
    () => (isNewMode ? Promise.resolve(null) : api.getRoute(routeId)),
    [routeId],
  );

  const [route, setRoute] = useState<Route | null>(null);
  const [editing, setEditing] = useState<EditingState>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverError, setCoverError] = useState('');
  const [uploadingFinalPhoto, setUploadingFinalPhoto] = useState(false);
  const [uploadingPrizeImage, setUploadingPrizeImage] = useState(false);
  const [prizeTypeOverride, setPrizeTypeOverride] = useState<'text' | 'image' | null>(null);
  const [blockedIssues, setBlockedIssues] = useState<ModerationIssue[]>([]);
  const [flaggedIssues, setFlaggedIssues] = useState<ModerationIssue[]>([]);
  const [flagOverride, setFlagOverride] = useState('');
  const [visibility, setVisibility] = useState<RouteVisibility>('public');
  const [publishError, setPublishError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [headerExpanded, setHeaderExpanded] = useState(true);
  const [confirmDeleteRoute, setConfirmDeleteRoute] = useState(false);
  const [deletingRoute, setDeletingRoute] = useState(false);

  // Undo state for deletions
  const [undoItem, setUndoItem] = useState<{ item: Item; index: number } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isNewMode) {
      // Initialise once with a blank local draft — nothing is saved to the server yet.
      // Use functional form so re-runs (e.g. when useAsync resolves null) don't reset state.
      setRoute((prev) =>
        prev
          ? prev
          : {
              id: 'new',
              title: 'My new hunt',
              description: undefined,
              authorId: '',
              authorName: '',
              items: [],
              status: 'draft',
              createdAt: new Date().toISOString(),
              ratings: [],
            },
      );
    } else if (data) {
      setRoute(data);
      if (data.visibility) setVisibility(data.visibility);
    }
  }, [isNewMode, data]);

  // DnD sensors — require 5px movement so taps still register as clicks
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  useSetPageHeader(editing ? 'Item' : 'Create Hunt', editing ? () => setEditing(null) : () => navigate('/'));

  if ((loading && !isNewMode) || !route) return <Page><Spinner label="Loading…" /></Page>;
  if (!isNewMode && error) return <Page><p style={{ color: 'var(--color-danger)' }}>{error}</p></Page>;

  async function persist(next: Route) {
    setRoute(next);
    setSaveError('');
    try {
      let id = serverRouteIdRef.current;

      if (!id) {
        // First real change in "new" mode — create the route server-side
        const created = await api.createRoute({
          title: next.title || 'My new hunt',
          description: next.description,
        });
        id = created.id;
        serverRouteIdRef.current = id;

        // Persist full state then replace URL so the component re-anchors to the real id
        await api.updateRoute(id, {
          title: next.title,
          description: next.description,
          coverPhotoUrl: next.coverPhotoUrl,
          items: next.items,
          finalItem: next.finalItem ?? null,
        });
        navigate(`/build/${id}`, { replace: true });
        return;
      }

      await api.updateRoute(id, {
        title: next.title,
        description: next.description,
        coverPhotoUrl: next.coverPhotoUrl,
        items: next.items,
        finalItem: next.finalItem ?? null,
      });
    } catch {
      setSaveError('⚠️ Changes could not be saved — check your connection');
    }
  }

  async function addCoverPhoto(file: File) {
    setUploadingCover(true);
    setCoverError('');
    try {
      const { url } = await api.uploadFile(file, file.name);
      await persist({ ...route!, coverPhotoUrl: url });
    } catch (e) {
      setCoverError(e instanceof Error ? e.message : 'Upload failed — please try again');
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

  function removeItem(id: string) {
    const currentItems = route!.items;
    const idx = currentItems.findIndex((i) => i.id === id);
    if (idx === -1) return;
    const removedItem = currentItems[idx]!;

    // If there is already a pending undo, flush that deletion to the server first
    if (undoTimerRef.current !== null) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
      // The previous pending item was already removed from local state;
      // currentItems reflects that. Persist the current list before we remove another.
      void persist({ ...route!, items: currentItems });
    }

    // Optimistically remove from local state
    const nextItems = currentItems.filter((i) => i.id !== id);
    setRoute({ ...route!, items: nextItems });
    setUndoItem({ item: removedItem, index: idx });

    // Start 5-second timer; on expiry, commit the deletion to the server
    undoTimerRef.current = setTimeout(() => {
      undoTimerRef.current = null;
      setUndoItem(null);
      setRoute((r) => {
        if (!r) return r;
        void persist({ ...r, items: r.items });
        return r;
      });
    }, 5000);
  }

  function handleUndo() {
    if (!undoItem) return;
    if (undoTimerRef.current !== null) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    // Restore the item at its original index
    setRoute((r) => {
      if (!r) return r;
      const restored = [...r.items];
      restored.splice(undoItem.index, 0, undoItem.item);
      return { ...r, items: restored };
    });
    setUndoItem(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = route!.items.findIndex((i) => i.id === active.id);
    const newIndex = route!.items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(route!.items, oldIndex, newIndex);
    void persist({ ...route!, items: reordered });
  }

  async function updateFinalItem(patch: Partial<FinalItem>) {
    const next: Route = { ...route!, finalItem: { ...(route!.finalItem ?? { kind: 'code', answer: '' }), ...patch } };
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

  async function addPrizeImage(file: File) {
    setUploadingPrizeImage(true);
    try {
      const { url } = await api.uploadFile(file, file.name);
      await updateFinalItem({ prizeImageUrl: url });
      setPrizeTypeOverride(null);
    } finally {
      setUploadingPrizeImage(false);
    }
  }

  async function finalize() {
    const id = serverRouteIdRef.current;
    if (!id) {
      // Route was never modified — nothing to publish
      navigate('/');
      return;
    }
    setSaving(true);
    setBlockedIssues([]);
    setFlaggedIssues([]);
    setPublishError('');
    try {
      const result = await api.moderateRoute(id);
      const blocked = result.issues.filter(i => i.severity === 'blocked');
      const flagged = result.issues.filter(i => i.severity === 'flagged');
      setBlockedIssues(blocked);
      setFlaggedIssues(flagged);
      if (blocked.length > 0) { setSaving(false); return; }
      if (flagged.length > 0 && !flagOverride.trim()) { setSaving(false); return; }
      await api.finalizeRoute(id, flagOverride.trim() || undefined, visibility);
      navigate(`/play/${id}`);
    } catch (e) {
      setSaving(false);
      setPublishError(e instanceof Error ? e.message : 'Could not publish — please try again');
    }
  }

  async function deleteRouteAndGoHome() {
    const id = serverRouteIdRef.current;
    setDeletingRoute(true);
    try {
      if (id) await api.deleteRoute(id);
      navigate('/');
    } catch {
      setDeletingRoute(false);
      setConfirmDeleteRoute(false);
    }
  }

  if (editing) {
    const isNew = editing === 'new' || editing === 'new-task' || editing === 'new-riddle' || editing === 'new-jigsaw';
    const defaultKind =
      editing === 'new-task' ? 'task' :
      editing === 'new-riddle' ? 'riddle' :
      editing === 'new-jigsaw' ? 'jigsaw' : 'photo';
    return (
      <Page>
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

  const isHeaderExpanded = route.items.length === 0 || headerExpanded;

  return (
    <Page>
      <div className="stack">
        {/* Header card — collapses to a summary row once items are added */}
        {isHeaderExpanded ? (
          <Card>
            <div className="stack">
              {route.items.length > 0 && (
                <button
                  className="btn btn--ghost"
                  style={{ alignSelf: 'flex-end', padding: '2px 8px', fontSize: '0.85rem' }}
                  onClick={() => setHeaderExpanded(false)}
                  aria-label="Collapse hunt details"
                >
                  ▲ Collapse
                </button>
              )}
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
                      🔄
                    </PhotoCapture>
                  </div>
                ) : (
                  <PhotoCapture onCapture={addCoverPhoto} variant="accent" disabled={uploadingCover}>
                    📷
                  </PhotoCapture>
                )}
                {coverError && <div style={{ marginTop: 'var(--space-2)' }}><Banner tone="no">{coverError}</Banner></div>}
              </div>

              <div>
                <label className="field-label" htmlFor="title">Hunt title</label>
                <input
                  id="title"
                  value={route.title}
                  onChange={(e) => setRoute({ ...route, title: e.target.value })}
                  onBlur={() => persist(route)}
                />
                {saveError && <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--color-danger)' }}>{saveError}</p>}
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

              {/* Route start / end points */}
              {route.items.some((i) => i.location) && (
                <div>
                  <span className="field-label">Route overview</span>
                  <div className="row" style={{ gap: 8 }}>
                    {route.items.find((i) => i.location)?.location && (
                      <a
                        href={googleMapsLink(route.items.find((i) => i.location)!.location!.lat, route.items.find((i) => i.location)!.location!.lng)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn--ghost"
                        style={{ fontSize: '0.85rem' }}
                      >
                        📍 Start
                      </a>
                    )}
                    {route.items.filter((i) => i.location).length > 1 && (
                      <a
                        href={googleMapsLink(route.items.filter((i) => i.location).at(-1)!.location!.lat, route.items.filter((i) => i.location).at(-1)!.location!.lng)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn--ghost"
                        style={{ fontSize: '0.85rem' }}
                      >
                        🏁 End
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        ) : (
          <button
            className="btn btn--ghost"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left' }}
            onClick={() => setHeaderExpanded(true)}
            aria-label="Expand hunt details"
          >
            <span>{route.title || 'Untitled hunt'}</span>
            <span>▼</span>
          </button>
        )}

        <h2>Items ({route.items.length})</h2>

        <DndContext
          sensors={sensors}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={route.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {route.items.map((item, i) => (
              <SortableItemCard
                key={item.id}
                item={item}
                index={i}
                finalItem={finalItem}
                chunkSize={chunkSize}
                onEdit={setEditing}
                onRemove={removeItem}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* Undo toast */}
        {undoItem && (
          <div
            style={{
              position: 'fixed',
              bottom: 'var(--space-4)',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--color-ink)',
              color: '#fff',
              borderRadius: 'var(--radius)',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              zIndex: 1000,
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            }}
          >
            <span>Item removed</span>
            <button
              onClick={handleUndo}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-accent)',
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0,
                fontSize: '1rem',
              }}
            >
              Undo
            </button>
          </div>
        )}

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
        <p className="muted">A code-lock bonus challenge unlocked after all items are found — players use characters collected along the way to crack it.</p>
        {finalItem ? (
          <Card>
            <div className="stack">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>🔒 Code lock</strong>
                <Button variant="ghost" onClick={() => { setPrizeTypeOverride(null); persist({ ...route, finalItem: undefined }); }}>Remove</Button>
              </div>

              <div>
                <label className="field-label">Code</label>
                <input
                  value={finalItem.answer}
                  placeholder="e.g. CASTLE or 2847"
                  onChange={(e) => updateFinalItem({ answer: e.target.value })}
                  style={{ fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}
                />
                {!finalItem.answer && (
                  <p style={{ color: 'var(--color-danger, #ef4444)', fontSize: '0.8rem', margin: '4px 0 0' }}>
                    ⚠️ Required — players can't open the chest without a code.
                  </p>
                )}
              </div>

              {/* Prize */}
              <div>
                <span className="field-label">Prize (revealed inside the open chest)</span>
                <div className="row" style={{ gap: 8, marginBottom: 'var(--space-2)' }}>
                  <Button
                    variant={(prizeTypeOverride ?? (finalItem.prizeImageUrl ? 'image' : 'text')) === 'text' ? 'primary' : 'ghost'}
                    onClick={() => {
                      setPrizeTypeOverride('text');
                      updateFinalItem({ prizeImageUrl: undefined });
                    }}
                  >
                    📝 Text
                  </Button>
                  <Button
                    variant={(prizeTypeOverride ?? (finalItem.prizeImageUrl ? 'image' : 'text')) === 'image' ? 'primary' : 'ghost'}
                    onClick={() => setPrizeTypeOverride('image')}
                  >
                    🖼️ Image
                  </Button>
                </div>
                {(prizeTypeOverride ?? (finalItem.prizeImageUrl ? 'image' : 'text')) === 'image' ? (
                  <div>
                    {finalItem.prizeImageUrl && (
                      <img
                        src={mediaUrl(finalItem.prizeImageUrl)}
                        alt="Prize"
                        style={{ width: 120, borderRadius: 8, objectFit: 'cover', marginBottom: 8, display: 'block' }}
                      />
                    )}
                    <PhotoCapture onCapture={addPrizeImage} variant="accent" disabled={uploadingPrizeImage}>
                      📷 {finalItem.prizeImageUrl ? 'Change prize image' : 'Upload prize image'}
                    </PhotoCapture>
                  </div>
                ) : (
                  <input
                    value={finalItem.revealAnswer ?? ''}
                    placeholder="e.g. The treasure is under the old oak tree"
                    onChange={(e) => updateFinalItem({ revealAnswer: e.target.value || undefined })}
                  />
                )}
                <p className="muted" style={{ fontSize: '0.8rem', margin: '4px 0 0' }}>
                  Optional. Shown inside the open chest after the correct code is entered.
                </p>
              </div>

              {route.items.length > 0 && finalItem.answer && (
                <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
                  Each solved item reveals ~{chunkSize} character{chunkSize !== 1 ? 's' : ''} of the code.
                </p>
              )}
            </div>
          </Card>
        ) : (
          <Button
            variant="ghost"
            block
            onClick={() => persist({ ...route, finalItem: { kind: 'code', answer: '' } })}
          >
            🔒 Add a code-lock finale
          </Button>
        )}

        {blockedIssues.length > 0 && (
          <Card>
            <div className="stack">
              <Banner tone="no">This route cannot be published due to the following issues:</Banner>
              {blockedIssues.map((issue, i) => (
                <div key={i}>
                  <strong style={{ fontSize: '0.85rem' }}>{issue.field}</strong>
                  <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.85rem' }}>{issue.reason}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {blockedIssues.length === 0 && flaggedIssues.length > 0 && (
          <Card>
            <div className="stack">
              <Banner tone="info">⚠️ This route has content that may not be suitable for all audiences:</Banner>
              {flaggedIssues.map((issue, i) => (
                <div key={i}>
                  <strong style={{ fontSize: '0.85rem' }}>{issue.field}</strong>
                  <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.85rem' }}>{issue.reason}</p>
                </div>
              ))}
              <div>
                <label className="field-label" htmlFor="flag-override">I understand and confirm because:</label>
                <input
                  id="flag-override"
                  value={flagOverride}
                  onChange={(e) => setFlagOverride(e.target.value)}
                  placeholder="Explain why this content is appropriate…"
                />
              </div>
              <Button
                variant="happy"
                disabled={!flagOverride.trim() || saving}
                onClick={finalize}
              >
                Publish anyway
              </Button>
            </div>
          </Card>
        )}

        {/* Visibility toggle — shown only before publishing (or when already published) */}
        <div>
          <span className="field-label">Visibility</span>
          <div className="row" style={{ gap: 8 }}>
            <Button
              variant={visibility === 'public' ? 'primary' : 'ghost'}
              onClick={() => {
                setVisibility('public');
                if (serverRouteIdRef.current) {
                  void api.updateRoute(serverRouteIdRef.current, { visibility: 'public' });
                }
              }}
            >
              🌍 Public
            </Button>
            <Button
              variant={visibility === 'private' ? 'primary' : 'ghost'}
              onClick={() => {
                setVisibility('private');
                if (serverRouteIdRef.current) {
                  void api.updateRoute(serverRouteIdRef.current, { visibility: 'private' });
                }
              }}
            >
              🔒 Private
            </Button>
          </div>
          <p className="muted" style={{ fontSize: '0.8rem', margin: '4px 0 0' }}>
            {visibility === 'private'
              ? 'Only you can find this hunt in the list. Anyone with the link can still play.'
              : 'Anyone can discover and play this hunt.'}
          </p>
        </div>

        <Button
          variant="happy"
          size="lg"
          block
          onClick={finalize}
          disabled={!isRoutePlayable(route) || saving}
        >
          ✅ {saving ? 'Saving…' : route.status === 'ready' ? 'Save & play' : 'Publish game'}
        </Button>
        {publishError && <Banner tone="no">{publishError}</Banner>}
        {!isRoutePlayable(route) && <p className="muted center">Add a title and at least one item to finish.</p>}

        {confirmDeleteRoute ? (
          <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 'var(--space-4)' }}>
            <span className="muted" style={{ flex: 1, fontSize: '0.9rem' }}>Delete this hunt permanently?</span>
            <Button variant="ghost" style={{ color: 'var(--color-danger, #ef4444)' }} onClick={deleteRouteAndGoHome} disabled={deletingRoute}>
              {deletingRoute ? '…' : '🗑 Yes, delete'}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDeleteRoute(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="ghost" block onClick={() => setConfirmDeleteRoute(true)} style={{ marginTop: 'var(--space-4)', color: 'var(--color-ink-soft)' }}>
            🗑 Delete this hunt
          </Button>
        )}
      </div>
      <BottomBar
        onCreate={() => navigate('/build/new')}
        onJoin={() => navigate('/join')}
        onMyHunts={() => navigate('/my-hunts')}
        onMyScores={() => navigate('/scores')}
        onMyHistory={() => navigate('/history')}
      />
    </Page>
  );
}
