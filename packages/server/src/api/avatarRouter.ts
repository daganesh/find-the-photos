import { Router } from 'express';
import multer from 'multer';
import type { AppContext } from '../context.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { FaceNotDetectedError } from '../gemini/cartoonService.js';

const MAX_GENERATIONS = 3;

/** Per-user cartoon generation count; resets on server restart. */
const generationCounts = new Map<string, number>();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

export function avatarRouter(ctx: AppContext): Router {
  const router = Router();

  router.post('/cartoon', requireAuth, upload.single('file'), async (req: AuthedRequest, res, next) => {
    try {
      if (!req.file) return void res.status(400).json({ error: 'No file uploaded' });

      const userId = req.user!.id;
      const used = generationCounts.get(userId) ?? 0;
      const retriesLeft = MAX_GENERATIONS - used;

      if (retriesLeft <= 0) {
        return void res.status(429).json({
          error: 'You have used all 3 cartoon avatar generations for this session.',
          retriesLeft: 0,
        });
      }

      let result;
      try {
        result = await ctx.cartoon.cartoonify({
          base64: req.file.buffer.toString('base64'),
          mimeType: req.file.mimetype,
        });
      } catch (err) {
        if (err instanceof FaceNotDetectedError) {
          // Face detection failures don't count against the budget
          return void res.status(422).json({ error: err.message, retriesLeft });
        }
        throw err;
      }

      // Only count attempts where generation was actually invoked
      generationCounts.set(userId, used + 1);

      res.json({
        imageDataUrl: `data:${result.mimeType};base64,${result.imageBase64}`,
        retriesLeft: retriesLeft - 1,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
