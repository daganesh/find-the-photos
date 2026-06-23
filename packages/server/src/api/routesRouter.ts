import { Router } from 'express';
import { nanoid } from 'nanoid';
import type {
  CreateRouteRequest,
  ModerationResult,
  RateRouteRequest,
  Rating,
  Route,
  RouteSummary,
  UpdateRouteRequest,
} from '@ftp/shared';
import { averageRating, isRoutePlayable } from '@ftp/shared';
import type { AppContext } from '../context.js';
import { optionalAuth, requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { config } from '../config.js';

function toSummary(route: Route): RouteSummary {
  const located = route.items.filter((i) => i.location);
  return {
    id: route.id,
    title: route.title,
    description: route.description,
    coverPhotoUrl: route.coverPhotoUrl,
    authorId: route.authorId,
    authorName: route.authorName,
    itemCount: route.items.length,
    status: route.status,
    visibility: route.visibility,
    avgRating: route.avgRating,
    createdAt: route.createdAt,
    startLocation: located[0]?.location,
    endLocation: located.length > 1 ? located[located.length - 1]?.location : undefined,
  };
}

/** Return true when a photo URL in an item's photos array is safe to store.
 *  Must be either a relative /uploads/ path or a URL under the configured S3 public base. */
function isAllowedPhotoUrl(url: string): boolean {
  if (url.startsWith('/uploads/')) return true;
  const s3Base = config.s3.publicUrl;
  if (s3Base && url.startsWith(s3Base)) return true;
  return false;
}

/** `/api/routes` — create, edit, finalise, list, and rate routes. */
export function routesRouter(ctx: AppContext): Router {
  const router = Router();

  // Browse: all finalised public routes, plus the caller's own routes (any visibility).
  router.get('/', optionalAuth, async (req: AuthedRequest, res, next) => {
    try {
      const all = await ctx.routes.list();
      const userId = req.user?.id;
      const visible = all.filter((r) => {
        if (r.authorId === userId) return true; // always see your own (drafts + private)
        if (r.status !== 'ready') return false;  // others can't see drafts
        return (r.visibility ?? 'public') === 'public'; // others see only public
      });
      res.json(visible.map(toSummary));
    } catch (err) {
      next(err);
    }
  });

  router.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const { title, description, visibility } = req.body as CreateRouteRequest;
      if (!title?.trim()) {
        res.status(400).json({ error: 'A route needs a title' });
        return;
      }
      const route: Route = {
        id: nanoid(10),
        title: title.trim(),
        description: description?.trim() || undefined,
        authorId: req.user!.id,
        authorName: req.user!.name,
        items: [],
        status: 'draft',
        visibility: visibility === 'private' ? 'private' : 'public',
        createdAt: new Date().toISOString(),
        ratings: [],
      };
      res.status(201).json(await ctx.routes.create(route));
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', optionalAuth, async (req: AuthedRequest, res, next) => {
    try {
      const route = await ctx.routes.get(req.params.id);
      if (!route) {
        res.status(404).json({ error: 'Route not found' });
        return;
      }
      // Drafts are private to their author.
      if (route.status === 'draft' && route.authorId !== req.user?.id) {
        res.status(403).json({ error: 'This route is not ready yet' });
        return;
      }
      // Private routes require authentication (return 404 to avoid enumeration).
      if ((route.visibility ?? 'public') === 'private' && !req.user) {
        res.status(404).json({ error: 'Route not found' });
        return;
      }
      res.json(route);
    } catch (err) {
      next(err);
    }
  });

  // Edit title/description/items/visibility (full ordered replace).
  router.patch('/:id', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const route = await ctx.routes.get(req.params.id);
      if (!route) return void res.status(404).json({ error: 'Route not found' });
      if (route.authorId !== req.user!.id) {
        return void res.status(403).json({ error: 'Not your route' });
      }
      const body = req.body as UpdateRouteRequest;
      const patch: Partial<Route> = {};
      if (body.title !== undefined) patch.title = body.title.trim();
      if (body.description !== undefined) patch.description = body.description.trim() || undefined;
      if (body.coverPhotoUrl !== undefined) patch.coverPhotoUrl = body.coverPhotoUrl || undefined;
      if (body.visibility !== undefined) {
        patch.visibility = body.visibility === 'private' ? 'private' : 'public';
      }
      if (body.items !== undefined) {
        // Validate photo URLs to prevent SSRF via Gemini photo fetching.
        for (const item of body.items) {
          for (const photo of item.photos) {
            if (!isAllowedPhotoUrl(photo.url)) {
              return void res.status(400).json({ error: `Photo URL not allowed: ${photo.url}` });
            }
          }
        }
        patch.items = body.items;
      }
      if (body.finalItem !== undefined) patch.finalItem = body.finalItem ?? undefined;
      res.json(await ctx.routes.update(route.id, patch));
    } catch (err) {
      next(err);
    }
  });

  // Moderate: check all route texts for inappropriate content.
  router.post('/:id/moderate', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const route = await ctx.routes.get(req.params.id);
      if (!route) return void res.status(404).json({ error: 'Route not found' });
      if (route.authorId !== req.user!.id) {
        return void res.status(403).json({ error: 'Not your route' });
      }
      const checks: Array<{ field: string; text: string }> = [];
      if (route.title) checks.push({ field: 'route.title', text: route.title });
      if (route.description) checks.push({ field: 'route.description', text: route.description });
      route.items.forEach((item, i) => {
        if (item.name) checks.push({ field: `item[${i}].name`, text: item.name });
        if (item.description) checks.push({ field: `item[${i}].description`, text: item.description });
        if (item.hint.text) checks.push({ field: `item[${i}].hint.text`, text: item.hint.text });
        item.extraHints?.forEach((h, j) => {
          if (h.text) checks.push({ field: `item[${i}].extraHints[${j}].text`, text: h.text });
        });
        if (item.taskInstruction) checks.push({ field: `item[${i}].taskInstruction`, text: item.taskInstruction });
      });
      const issues = await ctx.moderation.checkTexts(checks);
      const result: ModerationResult = { flagged: issues.length > 0, issues };
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Finalise: mark a draft as ready to play.
  router.post('/:id/finalize', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const route = await ctx.routes.get(req.params.id);
      if (!route) return void res.status(404).json({ error: 'Route not found' });
      if (route.authorId !== req.user!.id) {
        return void res.status(403).json({ error: 'Not your route' });
      }
      if (!isRoutePlayable(route)) {
        return void res
          .status(400)
          .json({ error: 'Add a title and at least one item before finishing' });
      }
      const { flagOverride } = req.body as { flagOverride?: string };
      if (flagOverride && flagOverride.trim()) {
        console.warn('[moderation] override by author %s for route %s: %s', req.user!.id, route.id, flagOverride);
      }
      res.json(await ctx.routes.update(route.id, { status: 'ready' }));
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const route = await ctx.routes.get(req.params.id);
      if (!route) return void res.status(404).json({ error: 'Route not found' });
      if (route.authorId !== req.user!.id) {
        return void res.status(403).json({ error: 'Not your route' });
      }
      await ctx.routes.remove(route.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // Rate a route you played.
  router.post('/:id/ratings', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const route = await ctx.routes.get(req.params.id);
      if (!route) return void res.status(404).json({ error: 'Route not found' });

      const { stars, comment } = req.body as RateRouteRequest;
      if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
        return void res.status(400).json({ error: 'Stars must be 1 to 5' });
      }
      // One rating per hunter — replace any previous one.
      const others = route.ratings.filter((r) => r.hunterId !== req.user!.id);
      const rating: Rating = {
        hunterId: req.user!.id,
        stars,
        comment: comment?.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      const ratings = [...others, rating];
      await ctx.routes.update(route.id, { ratings, avgRating: averageRating(ratings) });
      res.status(201).json(rating);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
