import { Router } from 'express';
import multer from 'multer';
import type { DisputeRequest, EscalateHelpRequest, SolveRiddleRequest, StepProgress, SubmitPhotoResponse } from '@ftp/shared';
import type { AppContext } from '../context.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import {
  buildSession,
  dispute,
  findActiveStep,
  returnSkipped,
  skip,
  solveRiddle,
  submitPhoto,
  useHelp,
} from '../hunt/huntService.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const lastStep = (steps: StepProgress[], itemId: string): StepProgress =>
  steps.find((s) => s.itemId === itemId)!;

/** `/api/hunt` — start a play-through and act on each step. */
export function huntRouter(ctx: AppContext): Router {
  const router = Router();

  // Begin playing a route.
  router.post('/start', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const { routeId, location } = req.body as { routeId?: string; location?: import('@ftp/shared').GeoPoint };
      const route = routeId ? await ctx.routes.get(routeId) : undefined;
      if (!route) return void res.status(404).json({ error: 'Route not found' });
      if (route.status !== 'ready') {
        return void res.status(400).json({ error: 'This route is not ready to play' });
      }
      const session = await ctx.hunts.create(buildSession(route, req.user!.id, location));
      res.status(201).json({ session });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:sessionId', requireAuth, async (req, res, next) => {
    try {
      const session = await ctx.hunts.get(req.params.sessionId);
      if (!session) return void res.status(404).json({ error: 'Hunt not found' });
      res.json({ session });
    } catch (err) {
      next(err);
    }
  });

  // Submit a photo for the active item; the AI judges it.
  router.post(
    '/:sessionId/steps/:itemId/photo',
    requireAuth,
    upload.single('file'),
    async (req: AuthedRequest, res, next) => {
      try {
        if (!req.file) return void res.status(400).json({ error: 'No photo uploaded' });
        const found = await findActiveStep(ctx, req.params.sessionId, req.params.itemId);
        if ('error' in found) return void res.status(found.status).json({ error: found.error });

        const session = await submitPhoto(ctx, found, {
          base64: req.file.buffer.toString('base64'),
          mimeType: req.file.mimetype,
        }, req.user!.id);
        const step = lastStep(session.steps, req.params.itemId);
        const body: SubmitPhotoResponse = {
          verdict: step.photoAttempts[step.photoAttempts.length - 1]!.verdict,
          step,
          session,
        };
        res.json(body);
      } catch (err) {
        next(err);
      }
    },
  );

  // Ask for the next level of help.
  router.post('/:sessionId/steps/:itemId/help', requireAuth, async (req, res, next) => {
    try {
      const found = await findActiveStep(ctx, req.params.sessionId, req.params.itemId);
      if ('error' in found) return void res.status(found.status).json({ error: found.error });
      const { hunterLocation } = req.body as EscalateHelpRequest;
      const session = await useHelp(ctx, found, hunterLocation);
      res.json({ session, step: lastStep(session.steps, req.params.itemId) });
    } catch (err) {
      next(err);
    }
  });

  // Give up on this item.
  router.post('/:sessionId/steps/:itemId/skip', requireAuth, async (req, res, next) => {
    try {
      const found = await findActiveStep(ctx, req.params.sessionId, req.params.itemId);
      if ('error' in found) return void res.status(found.status).json({ error: found.error });
      const session = await skip(ctx, found);
      res.json({ session, step: lastStep(session.steps, req.params.itemId) });
    } catch (err) {
      next(err);
    }
  });

  // Hunter insists the AI was wrong — override to found.
  router.post('/:sessionId/steps/:itemId/dispute', requireAuth, async (req, res, next) => {
    try {
      const found = await findActiveStep(ctx, req.params.sessionId, req.params.itemId);
      if ('error' in found) return void res.status(found.status).json({ error: found.error });
      const { description } = req.body as DisputeRequest;
      if (!description?.trim()) {
        return void res.status(400).json({ error: 'A description is required to dispute' });
      }
      const result = await dispute(ctx, found, description);
      if ('error' in result) return void res.status(result.status).json({ error: result.error });
      res.json({ session: result, step: lastStep(result.steps, req.params.itemId) });
    } catch (err) {
      next(err);
    }
  });

  // Submit a text answer to a riddle item.
  router.post('/:sessionId/steps/:itemId/solve', requireAuth, async (req, res, next) => {
    try {
      const found = await findActiveStep(ctx, req.params.sessionId, req.params.itemId);
      if ('error' in found) return void res.status(found.status).json({ error: found.error });
      const { answer } = req.body as SolveRiddleRequest;
      if (!answer?.trim()) {
        return void res.status(400).json({ error: 'An answer is required' });
      }
      const result = await solveRiddle(ctx, found, answer.trim());
      if ('error' in result) return void res.status(result.status).json({ error: result.error });
      res.json({ session: result, step: lastStep(result.steps, req.params.itemId) });
    } catch (err) {
      next(err);
    }
  });

  // Return to a previously skipped item (with scoring penalty).
  router.post('/:sessionId/steps/:itemId/return', requireAuth, async (req, res, next) => {
    try {
      const result = await returnSkipped(ctx, req.params.sessionId, req.params.itemId);
      if ('error' in result) return void res.status(result.status).json({ error: result.error });
      res.json({ session: result, step: lastStep(result.steps, req.params.itemId) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
