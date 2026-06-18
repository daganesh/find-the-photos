import { useState, type CSSProperties, type ReactNode } from 'react';

const MAX_DIM = 1024;
const JPEG_QUALITY = 0.82;

/**
 * Downscale an image to MAX_DIM on its longest side and re-encode as JPEG.
 * Images already within the limit pass through unchanged (no re-encode cost).
 */
async function resizeImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { naturalWidth: w, naturalHeight: h } = img;
      if (w <= MAX_DIM && h <= MAX_DIM) {
        resolve(file);
        return;
      }
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

interface PhotoCaptureProps {
  /** Called with the chosen (and resized) image file. */
  onCapture: (file: File) => void;
  /** Label for the primary camera button. */
  children: ReactNode;
  variant?: 'primary' | 'accent' | 'happy' | 'ghost';
  disabled?: boolean;
  style?: CSSProperties;
}

/**
 * Two-button photo picker: a primary button that opens the camera directly,
 * and a secondary "Gallery" button that opens the device photo library.
 * Both resize the chosen image to at most 1024 px on the longest side before
 * calling onCapture, keeping uploads small for storage and AI costs.
 * On desktop both fall back to the system file picker.
 */
export function PhotoCapture({ onCapture, children, variant = 'primary', disabled, style }: PhotoCaptureProps) {
  const [pasteMsg, setPasteMsg] = useState('');
  const variantCls = { accent: 'btn--accent', happy: 'btn--happy', ghost: 'btn--ghost', primary: '' }[variant];

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) resizeImage(file).then(onCapture);
  }

  async function handlePaste() {
    setPasteMsg('');
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], 'paste.jpg', { type: imageType });
          resizeImage(file).then(onCapture);
          return;
        }
      }
      setPasteMsg('No image in clipboard');
      setTimeout(() => setPasteMsg(''), 2000);
    } catch {
      setPasteMsg('Clipboard access denied');
      setTimeout(() => setPasteMsg(''), 2000);
    }
  }

  const canPaste = typeof navigator !== 'undefined' && 'clipboard' in navigator && typeof (navigator.clipboard as Clipboard & { read?: unknown }).read === 'function';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
      <div className="row" style={{ gap: 8 }}>
        {/* Camera — opens camera directly on mobile */}
        <label
          className={`btn btn--lg capture ${variantCls}`}
          aria-disabled={disabled}
          style={{ flex: 3 }}
        >
          {children}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            disabled={disabled}
            onChange={handleFile}
          />
        </label>

        {/* Gallery — opens photo library without forcing camera */}
        <label
          className="btn btn--lg btn--ghost capture"
          aria-disabled={disabled}
          style={{ flex: 1, minWidth: 0 }}
        >
          📁
          <input
            type="file"
            accept="image/*"
            disabled={disabled}
            onChange={handleFile}
          />
        </label>

        {/* Paste — reads an image the player copied from a web search */}
        {canPaste && (
          <button
            type="button"
            className="btn btn--lg btn--ghost"
            disabled={disabled}
            onClick={handlePaste}
            aria-label="Paste image from clipboard"
            style={{ flex: 1, minWidth: 0 }}
          >
            📋
          </button>
        )}
      </div>

      {pasteMsg && (
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-danger)', textAlign: 'center' }}>
          {pasteMsg}
        </p>
      )}
    </div>
  );
}
