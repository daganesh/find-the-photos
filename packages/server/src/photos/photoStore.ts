import fs from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { config } from '../config.js';

/** A stored image: bytes on disk plus the public URL the client uses. */
export interface StoredImage {
  id: string;
  url: string;
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'audio/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
};

/**
 * Saves uploaded media to the local uploads dir and serves it back under
 * `/uploads`. The seam (id + url) means a move to S3/GCS is a drop-in later.
 */
export class PhotoStore {
  async save(buffer: Buffer, mimeType: string): Promise<StoredImage> {
    const ext = EXT_BY_MIME[mimeType] ?? 'bin';
    const id = nanoid();
    const fileName = `${id}.${ext}`;
    await fs.mkdir(config.paths.uploadsDir, { recursive: true });
    await fs.writeFile(path.join(config.paths.uploadsDir, fileName), buffer);
    return { id, url: `/uploads/${fileName}` };
  }

  /** Read raw bytes back for a stored url (used to feed Gemini). */
  async readByUrl(url: string): Promise<Buffer> {
    const fileName = path.basename(url);
    return fs.readFile(path.join(config.paths.uploadsDir, fileName));
  }
}
