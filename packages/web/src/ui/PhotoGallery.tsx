import type { Photo } from '@ftp/shared';
import { mediaUrl } from '../services/media.js';

interface PhotoGalleryProps {
  photos: Photo[];
  /** When provided, each photo shows a remove (×) button. */
  onRemove?: (photoId: string) => void;
}

/** A responsive grid of item photos. */
export function PhotoGallery({ photos, onRemove }: PhotoGalleryProps) {
  if (photos.length === 0) return null;
  return (
    <div className="gallery">
      {photos.map((p) => (
        <div className="gallery__item" key={p.id}>
          <img src={mediaUrl(p.url)} alt={p.angleLabel ?? 'item photo'} />
          {onRemove && (
            <button className="gallery__remove" onClick={() => onRemove(p.id)} aria-label="Remove photo">
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
