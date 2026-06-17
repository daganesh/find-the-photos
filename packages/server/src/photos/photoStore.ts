import fs from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config.js';
import { getPool } from '../storage/db.js';

const MAX_DIM = 1440;

/**
 * Downscale any image buffer whose longest side exceeds MAX_DIM, re-encoding
 * as JPEG. Non-image buffers (audio) pass through unchanged.
 * Returns { buffer, mimeType } always.
 */
export async function resizeIfNeeded(
  buffer: Buffer,
  mimeType: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!mimeType.startsWith('image/')) return { buffer, mimeType };
  try {
    const img = sharp(buffer, { failOn: 'none' });
    const meta = await img.metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w <= MAX_DIM && h <= MAX_DIM) return { buffer, mimeType };
    const resized = await img
      .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    return { buffer: resized, mimeType: 'image/jpeg' };
  } catch {
    // If sharp can't parse the image (e.g. unknown format), store as-is.
    return { buffer, mimeType };
  }
}

/** A stored image: bytes on disk/db plus the public URL the client uses. */
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

const MIME_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(EXT_BY_MIME).map(([m, e]) => [e, m]),
);

// S3 client — only created when S3_BUCKET is explicitly configured.
const s3 = config.s3.bucket
  ? new S3Client({
      region: config.s3.region,
      endpoint: config.s3.endpoint || undefined,
      credentials: { accessKeyId: config.s3.accessKey, secretAccessKey: config.s3.secretKey },
      forcePathStyle: Boolean(config.s3.endpoint),
    })
  : null;

/**
 * Stores uploaded media with a three-tier priority:
 *
 * 1. S3-compatible object storage  — when S3_BUCKET is set (most scalable)
 * 2. PostgreSQL bytea              — when DATABASE_URL is set (simplest; fine
 *                                    for small/medium scale at ~200 KB/photo)
 * 3. Local filesystem              — dev fallback only (ephemeral on Railway)
 */
export class PhotoStore {
  async save(rawBuffer: Buffer, rawMimeType: string): Promise<StoredImage> {
    const { buffer, mimeType } = await resizeIfNeeded(rawBuffer, rawMimeType);
    const ext = EXT_BY_MIME[mimeType] ?? 'bin';
    const id = nanoid();
    const key = `${id}.${ext}`;

    // ── Tier 1: S3 ──────────────────────────────────────────────────────────
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

    // ── Tier 2: PostgreSQL ───────────────────────────────────────────────────
    if (config.databaseUrl) {
      await getPool().query(
        'INSERT INTO photos (id, mime_type, data) VALUES ($1, $2, $3)',
        [key, mimeType, buffer],
      );
      return { id, url: `/uploads/${key}` };
    }

    // ── Tier 3: local filesystem (dev only) ──────────────────────────────────
    await fs.mkdir(config.paths.uploadsDir, { recursive: true });
    await fs.writeFile(path.join(config.paths.uploadsDir, key), buffer);
    return { id, url: `/uploads/${key}` };
  }

  /**
   * Read raw bytes back for a stored URL (used when feeding reference photos
   * to Gemini).
   *
   * - Absolute URLs (S3/CDN) → plain HTTP fetch
   * - /uploads/:key with DB configured → PostgreSQL bytea query
   * - /uploads/:key otherwise → local file
   */
  async readByUrl(url: string): Promise<Buffer> {
    if (/^https?:\/\//.test(url)) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch photo ${url} (${res.status})`);
      return Buffer.from(await res.arrayBuffer());
    }

    const key = path.basename(url);

    if (config.databaseUrl) {
      const { rows } = await getPool().query<{ data: Buffer; mime_type: string }>(
        'SELECT data FROM photos WHERE id = $1',
        [key],
      );
      if (rows[0]) return Buffer.from(rows[0].data);
    }

    return fs.readFile(path.join(config.paths.uploadsDir, key));
  }

  /**
   * Serve a photo by key — used by the dynamic /uploads/:key route.
   * Returns null when the key is not found in the database.
   */
  async getForServing(key: string): Promise<{ data: Buffer; mimeType: string } | null> {
    if (config.databaseUrl && !config.s3.bucket) {
      const { rows } = await getPool().query<{ data: Buffer; mime_type: string }>(
        'SELECT data, mime_type FROM photos WHERE id = $1',
        [key],
      );
      if (rows[0]) return { data: Buffer.from(rows[0].data), mimeType: rows[0].mime_type };
    }
    // Not using DB serving — caller falls through to static file middleware.
    return null;
  }

  /** True when photos are served dynamically (i.e. stored in PostgreSQL). */
  get needsDynamicServing(): boolean {
    return Boolean(config.databaseUrl) && !config.s3.bucket;
  }
}
