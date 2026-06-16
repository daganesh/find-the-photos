import fs from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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

// Build an S3 client only when credentials are configured.
const s3 = config.s3.bucket
  ? new S3Client({
      region: config.s3.region,
      endpoint: config.s3.endpoint || undefined,
      credentials: {
        accessKeyId: config.s3.accessKey,
        secretAccessKey: config.s3.secretKey,
      },
      // Path-style addressing required for R2 / MinIO / non-AWS endpoints.
      forcePathStyle: Boolean(config.s3.endpoint),
    })
  : null;

/**
 * Stores uploaded media and returns a public URL.
 *
 * When S3_BUCKET is set: uploads go to S3-compatible object storage
 * (AWS S3, Cloudflare R2, Backblaze B2, etc.) and are served from
 * S3_PUBLIC_URL.
 *
 * When not configured: files land in the local `uploads/` directory and
 * are served via Express static — suitable for development only (ephemeral
 * on any container platform).
 */
export class PhotoStore {
  async save(buffer: Buffer, mimeType: string): Promise<StoredImage> {
    const ext = EXT_BY_MIME[mimeType] ?? 'bin';
    const id = nanoid();
    const key = `${id}.${ext}`;

    if (s3 && config.s3.bucket) {
      await s3.send(new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }));
      const base = config.s3.publicUrl || `https://${config.s3.bucket}.s3.amazonaws.com`;
      return { id, url: `${base}/${key}` };
    }

    // Local filesystem fallback (dev / no S3 configured).
    await fs.mkdir(config.paths.uploadsDir, { recursive: true });
    await fs.writeFile(path.join(config.paths.uploadsDir, key), buffer);
    return { id, url: `/uploads/${key}` };
  }

  /**
   * Read raw bytes back for a stored URL (used to send reference photos to
   * Gemini). Absolute URLs (S3/R2 public links) are fetched over HTTP;
   * relative `/uploads/…` paths are read from the local filesystem.
   */
  async readByUrl(url: string): Promise<Buffer> {
    if (/^https?:\/\//.test(url)) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch photo: ${url} (${res.status})`);
      return Buffer.from(await res.arrayBuffer());
    }
    const fileName = path.basename(url);
    return fs.readFile(path.join(config.paths.uploadsDir, fileName));
  }
}
