import { Router } from 'express';
import multer from 'multer';
import type { AppContext } from '../context.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { FaceNotDetectedError } from '../gemini/cartoonService.js';
import { isTransientGeminiError } from '../gemini/imageMatch.js';

const MAX_GENERATIONS = 5;
/** How long a user's generation count is remembered before resetting to MAX_GENERATIONS. */
const RESET_WINDOW_MS = 10 * 60 * 1000;

interface GenerationBudget {
  used: number;
  windowStart: number;
}

/** Per-user cartoon generation count; resets on server restart or after RESET_WINDOW_MS. */
const generationBudgets = new Map<string, GenerationBudget>();

/** Read the user's current used count, resetting the window if it has expired. */
function getUsedCount(userId: string): number {
  const budget = generationBudgets.get(userId);
  if (!budget || Date.now() - budget.windowStart >= RESET_WINDOW_MS) {
    return 0;
  }
  return budget.used;
}

function recordGeneration(userId: string, usedBeforeThisCall: number): void {
  const windowStart = usedBeforeThisCall === 0 ? Date.now() : (generationBudgets.get(userId)?.windowStart ?? Date.now());
  generationBudgets.set(userId, { used: usedBeforeThisCall + 1, windowStart });
}

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
      const used = getUsedCount(userId);
      const retriesLeft = MAX_GENERATIONS - used;

      if (retriesLeft <= 0) {
        return void res.status(429).json({
          error: `You have used all ${MAX_GENERATIONS} cartoon avatar generations. Try again in a few minutes.`,
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
        if (isTransientGeminiError(err)) {
          // Primary and fallback models were both under high demand — don't burn a retry.
          return void res.status(503).json({
            error: 'Gemini is very busy right now — please try again in a moment.',
            retriesLeft,
          });
        }
        throw err;
      }

      // Only count attempts where generation was actually invoked
      recordGeneration(userId, used);

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
