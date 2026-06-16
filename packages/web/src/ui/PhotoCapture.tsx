import type { CSSProperties, ReactNode } from 'react';

interface PhotoCaptureProps {
  /** Called with the chosen image file. */
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
 * On desktop both fall back to the system file picker.
 */
export function PhotoCapture({ onCapture, children, variant = 'primary', disabled, style }: PhotoCaptureProps) {
  const variantCls = { accent: 'btn--accent', happy: 'btn--happy', ghost: 'btn--ghost', primary: '' }[variant];

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onCapture(file);
    e.target.value = ''; // allow re-picking the same file
  }

  return (
    <div className="row" style={{ gap: 8, ...style }}>
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
    </div>
  );
}
