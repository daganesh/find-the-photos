import { Router } from 'express';
import type { CleanupResult, StorageStats, TableStats } from '@ftp/shared';
import type { AppContext } from '../context.js';
import { requireAdmin } from '../auth/middleware.js';
import { config } from '../config.js';
import { getPool } from '../storage/db.js';

/** `/api/admin` — storage monitoring and cleanup. Admin-only. */
export function adminRouter(ctx: AppContext): Router {
  const router = Router();

  /** Storage stats: DB table sizes, photo count, warnings. */
  router.get('/storage', requireAdmin, async (_req, res, next) => {
    try {
      const warnings: string[] = [];
      const stats: StorageStats = { mode: 'local', photos: { count: 0, totalMb: 0 }, warnings };

      if (config.s3.bucket) {
        stats.mode = 's3';
        // S3 photos — we only know count from the photos table (not used in S3 mode).
        stats.photos = { count: 0, totalMb: 0 };
      } else if (config.databaseUrl) {
        stats.mode = 'postgres';
        const pool = getPool();

        // Total DB size.
        const { rows: [dbSize] } = await pool.query<{ bytes: string }>(
          `SELECT pg_database_size(current_database()) AS bytes`,
        );
        const totalMb = Number(dbSize.bytes) / (1024 * 1024);
        if (totalMb > 800) warnings.push(`Database is ${totalMb.toFixed(0)} MB — approaching Railway's 1 GB free limit`);

        // Per-table size + row count.
        const { rows: tableRows } = await pool.query<{ name: string; bytes: string }>(
          `SELECT tablename AS name, pg_total_relation_size(quote_ident(tablename)) AS bytes
           FROM pg_tables WHERE schemaname = 'public' ORDER BY bytes DESC`,
        );
        const tables: Record<string, TableStats> = {};
        for (const t of tableRows) {
          const { rows: [cnt] } = await pool.query<{ n: string }>(`SELECT COUNT(*) AS n FROM ${t.name}`);
          tables[t.name] = { rows: Number(cnt.n), sizeMb: Number(t.bytes) / (1024 * 1024) };
        }
        stats.db = { totalMb, tables };
        stats.photos = { count: tables['photos']?.rows ?? 0, totalMb: tables['photos']?.sizeMb ?? 0 };
        if ((tables['photos']?.sizeMb ?? 0) > 500) warnings.push('Photos table is over 500 MB — consider cleanup');
      } else {
        // Local filesystem: sum uploads dir.
        try {
          const { readdir, stat } = await import('node:fs/promises');
          const files = await readdir(config.paths.uploadsDir).catch(() => [] as string[]);
          let totalBytes = 0;
          for (const f of files) {
            const s = await stat(`${config.paths.uploadsDir}/${f}`).catch(() => null);
            if (s) totalBytes += s.size;
          }
          const totalMb = totalBytes / (1024 * 1024);
          stats.photos = { count: files.length, totalMb };
          if (totalMb > 900) warnings.push('Uploads directory is over 900 MB — disk may fill up');
        } catch { /* ignore */ }
      }

      res.json(stats);
    } catch (err) { next(err); }
  });

  /** Delete photos not referenced by any route or session. */
  router.delete('/cleanup/orphaned-photos', requireAdmin, async (_req, res, next) => {
    try {
      const result: CleanupResult = { deleted: 0, freedMb: 0 };

      if (config.databaseUrl && !config.s3.bucket) {
        const pool = getPool();

        // Collect all photo IDs referenced in routes and sessions.
        const { rows: routes } = await pool.query<{ data: Record<string, unknown> }>('SELECT data FROM routes');
        const { rows: sessions } = await pool.query<{ data: Record<string, unknown> }>('SELECT data FROM hunt_sessions');

        const referenced = new Set<string>();
        for (const { data } of routes) {
          if (typeof data.coverPhotoUrl === 'string') referenced.add(key(data.coverPhotoUrl));
          const items = (data.items as { photos?: { url: string }[] }[] | undefined) ?? [];
          for (const item of items)
            for (const p of item.photos ?? [])
              referenced.add(key(p.url));
        }
        for (const { data } of sessions) {
          const steps = (data.steps as { photoAttempts?: { photoUrl: string }[] }[] | undefined) ?? [];
          for (const step of steps)
            for (const a of step.photoAttempts ?? [])
              referenced.add(key(a.photoUrl));
        }

        // Find and delete unreferenced photos.
        const { rows: allPhotos } = await pool.query<{ id: string; data: Buffer }>('SELECT id, octet_length(data) AS data FROM photos');
        const toDelete = allPhotos.filter((p) => !referenced.has(p.id));
        if (toDelete.length > 0) {
          const ids = toDelete.map((p) => p.id);
          await pool.query(`DELETE FROM photos WHERE id = ANY($1)`, [ids]);
          result.deleted = toDelete.length;
          result.freedMb = (toDelete as unknown as { data: number }[]).reduce((s, p) => s + (p as unknown as { data: number }).data, 0) / (1024 * 1024);
        }
      } else if (!config.databaseUrl) {
        // Local filesystem cleanup.
        const { readdir } = await import('node:fs/promises');
        const allFiles = await readdir(config.paths.uploadsDir).catch(() => [] as string[]);
        // Build referenced set from all JSON data files.
        // For local mode, just skip — it's dev only.
        result.deleted = 0;
        void allFiles;
      }

      res.json(result);
    } catch (err) { next(err); }
  });

  /** Delete finished sessions and teams older than 30 days. */
  router.delete('/cleanup/old-sessions', requireAdmin, async (req, res, next) => {
    try {
      const days = Number((req.query as { days?: string }).days ?? 30);
      const result: CleanupResult = { deleted: 0, freedMb: 0 };

      if (config.databaseUrl) {
        const pool = getPool();
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        const { rowCount: sc } = await pool.query(
          `DELETE FROM hunt_sessions WHERE data->>'finishedAt' IS NOT NULL AND data->>'finishedAt' < $1`,
          [cutoff],
        );
        const { rowCount: tc } = await pool.query(
          `DELETE FROM teams WHERE data->>'finishedAt' IS NOT NULL AND data->>'finishedAt' < $1`,
          [cutoff],
        );
        result.deleted = (sc ?? 0) + (tc ?? 0);
      }

      res.json(result);
    } catch (err) { next(err); }
  });

  void ctx; // ctx reserved for future use (e.g., photos store integration)
  return router;
}

/** Extract filename key from a /uploads/key or https://cdn.../key URL. */
function key(url: string): string {
  return url.split('/').at(-1) ?? url;
}
