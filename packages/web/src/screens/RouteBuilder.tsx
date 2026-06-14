import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Item, Route } from '@ftp/shared';
import { isRoutePlayable } from '@ftp/shared';
import { api } from '../services/apiClient.js';
import { useAsync } from '../hooks/useAsync.js';
import { Button, Card, Page, Spinner } from '../ui/index.js';
import { ItemEditor } from './ItemEditor.js';

/** The hider flow: build a route by adding items, then finalise it. */
export function RouteBuilder() {
  const { routeId = '' } = useParams();
  const navigate = useNavigate();
  const { data, loading, error } = useAsync(() => api.getRoute(routeId), [routeId]);

  const [route, setRoute] = useState<Route | null>(null);
  const [editing, setEditing] = useState<Item | 'new' | null>(null);
  const [saving, setSaving] = useState(false);

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
      items: next.items,
    });
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
    try {
      await api.updateRoute(route!.id, { title: route!.title, description: route!.description, items: route!.items });
      await api.finalizeRoute(route!.id);
      navigate(`/play/${route!.id}`);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <Page onBack={() => setEditing(null)} title="Item">
        <ItemEditor
          initial={editing === 'new' ? undefined : editing}
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
                  <div className="muted">{item.photos.length} photo{item.photos.length === 1 ? '' : 's'}{item.location ? ' · 📍' : ''}</div>
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

        <Button variant="accent" size="lg" block onClick={() => setEditing('new')}>
          ➕ Add an item
        </Button>

        <Button
          variant="happy"
          size="lg"
          block
          onClick={finalize}
          disabled={!isRoutePlayable(route) || saving}
        >
          ✅ {saving ? 'Finishing…' : route.status === 'ready' ? 'Update & play' : 'Finish & make ready'}
        </Button>
        {!isRoutePlayable(route) && <p className="muted center">Add a title and at least one item to finish.</p>}
      </div>
    </Page>
  );
}
