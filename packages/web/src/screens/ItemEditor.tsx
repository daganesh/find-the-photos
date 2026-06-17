import { useState } from 'react';
import type { Hint, Item, Photo } from '@ftp/shared';
import { api } from '../services/apiClient.js';
import { getCurrentLocation } from '../services/geolocation.js';
import { getJigsawGridSize } from '@ftp/shared';
import { mediaUrl } from '../services/media.js';
import { Button, Card, JigsawView, PhotoCapture, PhotoGallery, AudioRecorder } from '../ui/index.js';

interface ItemEditorProps {
  initial?: Item;
  defaultKind?: Item['kind'];
  onSave: (item: Item) => void;
  onCancel: () => void;
}

const blankItem = (kind?: Item['kind']): Item => ({
  id: crypto.randomUUID(),
  kind: kind ?? 'photo',
  name: '',
  description: '',
  hint: { kind: 'text', text: '' },
  extraHints: [],
  photos: [],
  difficult: false,
  taskInstruction: '',
});

/** Capture or edit a single hidden item: photos, name, hints, description, GPS. */
export function ItemEditor({ initial, defaultKind, onSave, onCancel }: ItemEditorProps) {
  const [item, setItem] = useState<Item>(initial ?? blankItem(defaultKind));
  const [busy, setBusy] = useState(false);
  const update = (patch: Partial<Item>) => setItem((prev) => ({ ...prev, ...patch }));

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

  function addExtraHint() {
    update({ extraHints: [...(item.extraHints ?? []), { kind: 'text', text: '' }] });
  }

  function updateExtraHint(index: number, patch: Partial<Hint>) {
    const next = [...(item.extraHints ?? [])];
    next[index] = { ...next[index]!, ...patch };
    update({ extraHints: next });
  }

  async function recordExtraHint(index: number, clip: Blob, durationS: number) {
    setBusy(true);
    try {
      const { url } = await api.uploadFile(clip, 'hint.webm');
      updateExtraHint(index, { kind: 'audio', audioUrl: url, audioDurationS: durationS });
    } finally {
      setBusy(false);
    }
  }

  function removeExtraHint(index: number) {
    const next = [...(item.extraHints ?? [])];
    next.splice(index, 1);
    update({ extraHints: next });
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

  const canSave =
    item.kind === 'task'
      ? (item.taskInstruction ?? '').trim().length > 0
      : item.kind === 'riddle'
      ? (item.hint.text ?? '').trim().length > 0 && item.name.trim().length > 0
      : item.kind === 'jigsaw'
      ? item.photos.length > 0 && item.name.trim().length > 0
      : item.name.trim().length > 0 && item.photos.length > 0;

  function handleSave() {
    let saved = item;
    if (item.kind === 'task') {
      const autoName = (item.taskInstruction ?? '').trim().slice(0, 60) || 'Task';
      saved = { ...item, name: autoName };
    }
    onSave(saved);
  }

  return (
    <Card>
      <div className="stack">
        <h2>{initial ? 'Edit item' : 'New item'}</h2>

        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Button variant={!item.kind || item.kind === 'photo' ? 'primary' : 'ghost'} onClick={() => update({ kind: 'photo' })}>
            📷 Photo
          </Button>
          <Button variant={item.kind === 'task' ? 'primary' : 'ghost'} onClick={() => update({ kind: 'task' })}>
            🎯 Task
          </Button>
          <Button variant={item.kind === 'riddle' ? 'primary' : 'ghost'} onClick={() => update({ kind: 'riddle' })}>
            🧩 Riddle
          </Button>
          <Button variant={item.kind === 'jigsaw' ? 'primary' : 'ghost'} onClick={() => update({ kind: 'jigsaw', jigsawDifficulty: item.jigsawDifficulty ?? 1 })}>
            🔲 Jigsaw
          </Button>
        </div>

        {item.kind === 'task' ? (
          <div>
            <label className="field-label" htmlFor="task-instruction">Task instruction</label>
            <textarea
              id="task-instruction"
              rows={3}
              value={item.taskInstruction ?? ''}
              placeholder="e.g. Jump as high as you can! or Make a funny face."
              onChange={(e) => update({ taskInstruction: e.target.value })}
            />
          </div>
        ) : item.kind === 'riddle' ? (
          <>
            <div>
              <label className="field-label" htmlFor="riddle-question">Riddle</label>
              <textarea
                id="riddle-question"
                rows={3}
                value={item.hint.text ?? ''}
                placeholder="e.g. I have hands but no arms, and tell you something every minute…"
                onChange={(e) => update({ hint: { ...item.hint, kind: 'text', text: e.target.value } })}
              />
            </div>

            {(item.extraHints ?? []).map((h, i) => (
              <div key={i}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
                  <span className="field-label" style={{ margin: 0 }}>Clue {i + 1}</span>
                  <Button variant="ghost" onClick={() => removeExtraHint(i)} disabled={busy}>🗑 Remove</Button>
                </div>
                <textarea
                  rows={2}
                  value={h.text ?? ''}
                  placeholder="An extra hint for the player…"
                  onChange={(e) => updateExtraHint(i, { kind: 'text', text: e.target.value })}
                />
              </div>
            ))}

            <Button variant="ghost" onClick={addExtraHint} disabled={busy}>➕ Add a clue</Button>

            <div>
              <label className="field-label" htmlFor="riddle-answer">Answer</label>
              <input
                id="riddle-answer"
                value={item.name}
                placeholder="e.g. A clock"
                onChange={(e) => update({ name: e.target.value })}
              />
            </div>
          </>
        ) : item.kind === 'jigsaw' ? (
          <>
            <div>
              <span className="field-label">Puzzle photo</span>
              {item.photos[0] && (
                <div style={{ marginBottom: 'var(--space-2)' }}>
                  <JigsawView
                    imageUrl={mediaUrl(item.photos[0].url)}
                    gridSize={getJigsawGridSize(item.jigsawDifficulty ?? 1)}
                    mode="scrambled"
                    difficulty={item.jigsawDifficulty ?? 1}
                    seed={item.id}
                  />
                </div>
              )}
              <PhotoCapture onCapture={addPhoto} variant="accent" disabled={busy}>
                📷 {item.photos[0] ? 'Change photo' : 'Add puzzle photo'}
              </PhotoCapture>
            </div>

            <div>
              <span className="field-label">Difficulty</span>
              <div className="row" style={{ gap: 8 }}>
                {([1, 2, 3] as const).map((d) => (
                  <Button
                    key={d}
                    variant={item.jigsawDifficulty === d ? 'primary' : 'ghost'}
                    onClick={() => update({ jigsawDifficulty: d })}
                  >
                    {d === 1 ? '3×3' : d === 2 ? '5×5' : '10×10'}
                  </Button>
                ))}
              </div>
            </div>

            {(item.extraHints ?? []).map((h, i) => (
              <div key={i}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
                  <span className="field-label" style={{ margin: 0 }}>Clue {i + 1}</span>
                  <Button variant="ghost" onClick={() => removeExtraHint(i)} disabled={busy}>🗑 Remove</Button>
                </div>
                <textarea
                  rows={2}
                  value={h.text ?? ''}
                  placeholder="An extra hint for the player…"
                  onChange={(e) => updateExtraHint(i, { kind: 'text', text: e.target.value })}
                />
              </div>
            ))}
            <Button variant="ghost" onClick={addExtraHint} disabled={busy}>➕ Add a clue</Button>

            <div>
              <label className="field-label" htmlFor="jigsaw-answer">What is this? (answer)</label>
              <input
                id="jigsaw-answer"
                value={item.name}
                placeholder="e.g. The old town fountain"
                onChange={(e) => update({ name: e.target.value })}
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <span className="field-label">Photos (a few angles!)</span>
              <PhotoGallery photos={item.photos} onRemove={removePhoto} />
              <div style={{ marginTop: 'var(--space-2)' }}>
                <PhotoCapture onCapture={addPhoto} variant="accent" disabled={busy}>
                  📷 Add a photo
                </PhotoCapture>
              </div>
            </div>

            <HintEditor
              label="Clue"
              hint={item.hint}
              onChange={(patch) => update({ hint: { ...item.hint, ...patch } })}
              onRecord={recordHint}
              busy={busy}
            />

            {(item.extraHints ?? []).map((h, i) => (
              <HintEditor
                key={i}
                label={`Extra clue ${i + 1}`}
                hint={h}
                onChange={(patch) => updateExtraHint(i, patch)}
                onRecord={(clip, dur) => recordExtraHint(i, clip, dur)}
                onRemove={() => removeExtraHint(i)}
                busy={busy}
              />
            ))}

            <Button variant="ghost" onClick={addExtraHint} disabled={busy}>
              ➕ Add another clue
            </Button>

            <div>
              <label className="field-label" htmlFor="item-name">Answer</label>
              <input
                id="item-name"
                value={item.name}
                placeholder="e.g. The red mailbox"
                onChange={(e) => update({ name: e.target.value })}
              />
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
          </>
        )}

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave || busy}>
            Save item
          </Button>
        </div>
        {!canSave && (
          <p className="muted center">
            {item.kind === 'task'
              ? 'Add a task instruction.'
              : item.kind === 'riddle'
              ? 'Add a riddle question and the answer.'
              : item.kind === 'jigsaw'
              ? 'Add a puzzle photo and name what it shows.'
              : 'Add an answer and at least one photo.'}
          </p>
        )}
      </div>
    </Card>
  );
}

interface HintEditorProps {
  label: string;
  hint: Hint;
  onChange: (patch: Partial<Hint>) => void;
  onRecord: (clip: Blob, durationS: number) => Promise<void>;
  onRemove?: () => void;
  busy: boolean;
}

function HintEditor({ label, hint, onChange, onRecord, onRemove, busy }: HintEditorProps) {
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
        <span className="field-label" style={{ margin: 0 }}>{label}</span>
        {onRemove && (
          <Button variant="ghost" onClick={onRemove} disabled={busy}>
            🗑 Remove
          </Button>
        )}
      </div>
      <div className="row" style={{ marginBottom: 'var(--space-2)' }}>
        <Button
          variant={hint.kind === 'text' ? 'primary' : 'ghost'}
          onClick={() => onChange({ kind: 'text' })}
        >
          💬 Text
        </Button>
        <Button
          variant={hint.kind === 'audio' ? 'primary' : 'ghost'}
          onClick={() => onChange({ kind: 'audio' })}
        >
          🔊 Audio
        </Button>
      </div>
      {hint.kind === 'text' ? (
        <textarea
          rows={2}
          value={hint.text ?? ''}
          placeholder="Give a fun hint…"
          onChange={(e) => onChange({ text: e.target.value })}
        />
      ) : (
        <div className="stack">
          {hint.audioUrl && <p className="muted">🎧 Clue recorded ({hint.audioDurationS}s)</p>}
          <AudioRecorder onRecorded={onRecord} />
        </div>
      )}
    </div>
  );
}
