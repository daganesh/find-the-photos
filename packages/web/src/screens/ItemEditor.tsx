import { useState } from 'react';
import type { Hint, Item, Photo } from '@ftp/shared';
import { api } from '../services/apiClient.js';
import { getCurrentLocation } from '../services/geolocation.js';
import { Button, Card, PhotoCapture, PhotoGallery, AudioRecorder } from '../ui/index.js';

interface ItemEditorProps {
  /** Existing item to edit, or undefined to create a new one. */
  initial?: Item;
  onSave: (item: Item) => void;
  onCancel: () => void;
}

const blankItem = (): Item => ({
  id: crypto.randomUUID(),
  name: '',
  description: '',
  hint: { kind: 'text', text: '' },
  photos: [],
  difficult: false,
});

/** Capture or edit a single hidden item: photos, name, hint, description, GPS. */
export function ItemEditor({ initial, onSave, onCancel }: ItemEditorProps) {
  const [item, setItem] = useState<Item>(initial ?? blankItem());
  const [busy, setBusy] = useState(false);
  const update = (patch: Partial<Item>) => setItem((prev) => ({ ...prev, ...patch }));
  const setHint = (patch: Partial<Hint>) => update({ hint: { ...item.hint, ...patch } });

  async function addPhoto(file: File) {
    setBusy(true);
    try {
      const { id, url } = await api.uploadFile(file, file.name);
      const photo: Photo = { id, url };
      update({ photos: [...item.photos, photo] });
    } finally {
      setBusy(false);
    }
  }

  function removePhoto(photoId: string) {
    update({ photos: item.photos.filter((p) => p.id !== photoId) });
  }

  async function recordHint(clip: Blob, durationS: number) {
    setBusy(true);
    try {
      const { url } = await api.uploadFile(clip, 'hint.webm');
      update({ hint: { kind: 'audio', audioUrl: url, audioDurationS: durationS } });
    } finally {
      setBusy(false);
    }
  }

  async function useMyLocation() {
    setBusy(true);
    try {
      const loc = await getCurrentLocation();
      if (loc) update({ location: loc });
    } finally {
      setBusy(false);
    }
  }

  const canSave = item.name.trim().length > 0 && item.photos.length > 0;

  return (
    <Card>
      <div className="stack">
        <h2>{initial ? 'Edit item' : 'New item'}</h2>

        <div>
          <span className="field-label">Photos (a few angles!)</span>
          <PhotoGallery photos={item.photos} onRemove={removePhoto} />
          <div style={{ marginTop: 'var(--space-2)' }}>
            <PhotoCapture onCapture={addPhoto} variant="accent" disabled={busy}>
              📷 Add a photo
            </PhotoCapture>
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="item-name">Name</label>
          <input
            id="item-name"
            value={item.name}
            placeholder="e.g. The red mailbox"
            onChange={(e) => update({ name: e.target.value })}
          />
        </div>

        <div>
          <span className="field-label">Clue</span>
          <div className="row" style={{ marginBottom: 'var(--space-2)' }}>
            <Button
              variant={item.hint.kind === 'text' ? 'primary' : 'ghost'}
              onClick={() => setHint({ kind: 'text' })}
            >
              💬 Text
            </Button>
            <Button
              variant={item.hint.kind === 'audio' ? 'primary' : 'ghost'}
              onClick={() => setHint({ kind: 'audio' })}
            >
              🔊 Audio
            </Button>
          </div>
          {item.hint.kind === 'text' ? (
            <textarea
              rows={2}
              value={item.hint.text ?? ''}
              placeholder="Give a fun hint…"
              onChange={(e) => setHint({ text: e.target.value })}
            />
          ) : (
            <div className="stack">
              {item.hint.audioUrl && <p className="muted">🎧 Clue recorded ({item.hint.audioDurationS}s)</p>}
              <AudioRecorder onRecorded={recordHint} />
            </div>
          )}
        </div>

        <div>
          <label className="field-label" htmlFor="item-desc">Description (extra help)</label>
          <textarea
            id="item-desc"
            rows={2}
            value={item.description ?? ''}
            placeholder="Where it is, what's around it…"
            onChange={(e) => update({ description: e.target.value })}
          />
        </div>

        <div>
          <span className="field-label">Location</span>
          <div className="row">
            <Button variant="accent" onClick={useMyLocation} disabled={busy}>
              📍 Use my location
            </Button>
            {item.location && (
              <span className="muted">
                {item.location.lat.toFixed(5)}, {item.location.lng.toFixed(5)}
              </span>
            )}
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => onSave(item)} disabled={!canSave || busy}>
            Save item
          </Button>
        </div>
        {!canSave && <p className="muted center">Add a name and at least one photo.</p>}
      </div>
    </Card>
  );
}
