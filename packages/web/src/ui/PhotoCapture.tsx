import type { CSSProperties, ReactNode } from 'react';

interface PhotoCaptureProps {
  /** Called with the chosen image file. */
  onCapture: (file: File) => void;
  children: ReactNode;
  variant?: 'primary' | 'accent' | 'happy' | 'ghost';
  disabled?: boolean;
  style?: CSSProperties;
}

/**
 * A big friendly button that opens the camera (or photo picker). Uses the
 * native file input with `capture` so it works on phones and desktops alike.
 */
export function PhotoCapture({ onCapture, children, variant = 'primary', disabled, style }: PhotoCaptureProps) {
  const variantCls = { accent: 'btn--accent', happy: 'btn--happy', ghost: 'btn--ghost', primary: '' }[variant];
  return (
    <label className={`btn btn--lg btn--block ${variantCls} capture`} aria-disabled={disabled} style={style}>
      {children}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onCapture(file);
          e.target.value = ''; // allow re-picking the same file
        }}
      />
    </label>
  );
}
