import { Router } from 'express';
import multer from 'multer';
import type { UploadedPhotoResponse } from '@ftp/shared';
import type { AppContext } from '../context.js';
import { requireAuth } from '../auth/middleware.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB — images are downscaled to ≤1440px JPEG anyway
});

/** `/api/photos` — upload item photos and audio hints. */
export function photosRouter(ctx: AppContext): Router {
  const router = Router();

  router.post('/', requireAuth, upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }
      if (req.file.mimetype.startsWith('image/')) {
        try {
          const issues = await ctx.moderation.checkImage({
            base64: req.file.buffer.toString('base64'),
            mimeType: req.file.mimetype,
          });
          if (issues.length > 0) {
            return void res.status(422).json({ error: 'This image cannot be uploaded: ' + issues[0]!.reason });
          }
        } catch (err) {
          console.warn('[photos] moderation check failed, proceeding:', err instanceof Error ? err.message : err);
        }
      }
      const stored = await ctx.photos.save(req.file.buffer, req.file.mimetype);
      const body: UploadedPhotoResponse = stored;
      res.status(201).json(body);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
