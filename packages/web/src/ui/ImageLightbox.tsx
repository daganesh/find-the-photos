import { useEffect } from 'react';

interface ImageLightboxProps {
  onClose: () => void;
  children: React.ReactNode;
}

/** Full-screen overlay that enlarges any content. Close with ✕ button, backdrop click, or Escape. */
export function ImageLightbox({ onClose, children }: ImageLightboxProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Enlarged puzzle view"
      className="lightbox"
      onClick={onClose}
    >
      <button
        className="lightbox__close"
        aria-label="Close"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        ✕
      </button>
      <div className="lightbox__content" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
