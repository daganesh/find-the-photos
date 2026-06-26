import { Router } from 'express';
import multer from 'multer';
import type { DisputeRequest, EscalateHelpRequest, SolveFinalItemRequest, SolveRiddleRequest, StepProgress, SubmitPhotoResponse } from '@ftp/shared';
import type { AppContext } from '../context.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import {
  buildSession,
  dispute,
  findActiveStep,
  returnSkipped,
  skip,
  solveFinalItem,
  solveRiddle,
  submitPhoto,
  useHelp,
} from '../hunt/huntService.js';
import { sanitizeUserText, detectPromptInjection } from '../utils/textSanitizer.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB — gameplay photos are downscaled to ≤1440px JPEG
});

const lastStep = (steps: StepProgress[], itemId: string): StepProgress =>
  steps.find((s) => s.itemId === itemId)!;

/** `/api/hunt` — start a play-through and act on each step. */
export function huntRouter(ctx: AppContext): Router {
  const router = Router();

  // Begin playing a route — auto-pauses any currently active session.
  router.post('/start', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const { routeId, location, reversed } = req.body as { routeId?: string; location?: import('@ftp/shared').GeoPoint; reversed?: boolean };
      const route = routeId ? await ctx.routes.get(routeId) : undefined;
      if (!route) return void res.status(404).json({ error: 'Route not found' });
      if (route.status !== 'ready') {
        return void res.status(400).json({ error: 'This route is not ready to play' });
      }
      // Enforce one active session at a time: auto-pause any playing session.
      const mine = await ctx.hunts.listByHunter(req.user!.id);
      const active = mine.find((s) => !s.finishedAt && !s.pausedAt);
      if (active) {
        await ctx.hunts.update(active.id, { pausedAt: new Date().toISOString() });
      }
      const session = await ctx.hunts.create(buildSession(route, req.user!.id, location, reversed));
      res.status(201).json({ session });
    } catch (err) {
      next(err);
    }
  });

  // List the caller's sessions.
  // ?finished=true includes completed sessions (for the history pane).
  // Registered before /:sessionId so Express doesn't treat "mine" as a session ID.
  router.get('/mine', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const all = await ctx.hunts.listByHunter(req.user!.id);
      const includeFinished = req.query.finished === 'true';
      const sessions = includeFinished ? all : all.filter((s) => !s.finishedAt);
      res.json({ sessions });
    } catch (err) {
      next(err);
    }
  });

  // Pause a session — persists pausedAt so it appears on the Home screen.
  router.post('/:sessionId/pause', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const session = await ctx.hunts.get(req.params.sessionId);
      if (!session) return void res.status(404).json({ error: 'Hunt not found' });
      if (session.hunterId !== req.user!.id) return void res.status(403).json({ error: 'Not your session' });
      if (session.finishedAt) return void res.status(400).json({ error: 'Hunt is already finished' });
      const updated = await ctx.hunts.update(req.params.sessionId, { pausedAt: new Date().toISOString() });
      res.json({ session: updated });
    } catch (err) {
      next(err);
    }
  });

  // Resume a paused session — clears pausedAt.
  router.post('/:sessionId/resume', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const session = await ctx.hunts.get(req.params.sessionId);
      if (!session) return void res.status(404).json({ error: 'Hunt not found' });
      if (session.hunterId !== req.user!.id) return void res.status(403).json({ error: 'Not your session' });
      const updated = await ctx.hunts.update(req.params.sessionId, { pausedAt: undefined });
      res.json({ session: updated });
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

  router.delete('/:sessionId', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const session = await ctx.hunts.get(req.params.sessionId);
      if (!session) return void res.status(404).json({ error: 'Hunt not found' });
      if (session.hunterId !== req.user!.id) return void res.status(403).json({ error: 'Not your session' });
      await ctx.hunts.delete(req.params.sessionId);
      res.status(204).end();
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
      const { description } = req.body as DisputeRequest;
      if (!description?.trim()) {
        return void res.status(400).json({ error: 'A description is required to dispute' });
      }
      if (description.length > 500) return void res.status(400).json({ error: 'Input too long' });
      const clean = sanitizeUserText(description, 500);
      if (detectPromptInjection(clean)) return void res.status(400).json({ error: 'Invalid input' });
      const found = await findActiveStep(ctx, req.params.sessionId, req.params.itemId);
      if ('error' in found) return void res.status(found.status).json({ error: found.error });
      const result = await dispute(ctx, found, clean);
      if ('error' in result) return void res.status(result.status).json({ error: result.error });
      res.json({ session: result, step: lastStep(result.steps, req.params.itemId) });
    } catch (err) {
      next(err);
    }
  });

  // Submit a text answer to a riddle item.
  router.post('/:sessionId/steps/:itemId/solve', requireAuth, async (req, res, next) => {
    try {
      const { answer } = req.body as SolveRiddleRequest;
      if (!answer?.trim()) {
        return void res.status(400).json({ error: 'An answer is required' });
      }
      if (answer.length > 200) return void res.status(400).json({ error: 'Input too long' });
      const clean = sanitizeUserText(answer, 200);
      if (detectPromptInjection(clean)) return void res.status(400).json({ error: 'Invalid input' });
      const found = await findActiveStep(ctx, req.params.sessionId, req.params.itemId);
      if ('error' in found) return void res.status(found.status).json({ error: found.error });
      const result = await solveRiddle(ctx, found, clean);
      if ('error' in result) return void res.status(result.status).json({ error: result.error });
      res.json({ session: result, step: lastStep(result.steps, req.params.itemId) });
    } catch (err) {
      next(err);
    }
  });

  // Submit an answer for the optional final item.
  router.post('/:sessionId/solve-final', requireAuth, async (req, res, next) => {
    try {
      const { answer } = req.body as SolveFinalItemRequest;
      if (!answer?.trim()) {
        return void res.status(400).json({ error: 'An answer is required' });
      }
      if (answer.length > 200) return void res.status(400).json({ error: 'Input too long' });
      const clean = sanitizeUserText(answer, 200);
      if (detectPromptInjection(clean)) return void res.status(400).json({ error: 'Invalid input' });
      const result = await solveFinalItem(ctx, req.params.sessionId, clean);
      if ('error' in result) return void res.status(result.status).json({ error: result.error });
      res.json({ session: result });
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
