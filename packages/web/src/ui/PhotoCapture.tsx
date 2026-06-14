import type { ReactNode } from 'react';

interface PhotoCaptureProps {
  /** Called with the chosen image file. */
  onCapture: (file: File) => void;
  children: ReactNode;
  variant?: 'primary' | 'accent' | 'happy';
  disabled?: boolean;
}

/**
 * A big friendly button that opens the camera (or photo picker). Uses the
 * native file input with `capture` so it works on phones and desktops alike.
 */
export function PhotoCapture({ onCapture, children, variant = 'primary', disabled }: PhotoCaptureProps) {
  const cls = variant === 'accent' ? 'btn--accent' : variant === 'happy' ? 'btn--happy' : '';
  return (
    <label className={`btn btn--lg btn--block ${cls} capture ${disabled ? '' : ''}`} aria-disabled={disabled}>
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
