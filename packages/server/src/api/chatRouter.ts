import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { addMessage, getMessages } from '../chat/chatStore.js';
import type { AppContext } from '../context.js';

/** `POST/GET /api/teams/:teamId/chat` — in-memory team chat. */
export function chatRouter(ctx: AppContext): Router {
  const router = Router({ mergeParams: true });

  router.get('/', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const { teamId } = req.params as { teamId: string };
      const team = await ctx.teams.get(teamId);
      if (!team) return void res.status(404).json({ error: 'Team not found' });
      if (!team.members.some((m) => m.userId === req.user!.id))
        return void res.status(403).json({ error: 'Not a team member' });
      const since = (req.query as { since?: string }).since;
      res.json({ messages: getMessages(teamId, since) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const { teamId } = req.params as { teamId: string };
      const team = await ctx.teams.get(teamId);
      if (!team) return void res.status(404).json({ error: 'Team not found' });
      if (!team.members.some((m) => m.userId === req.user!.id))
        return void res.status(403).json({ error: 'Not a team member' });

      const { text } = req.body as { text?: string };
      const user = req.user!;

      if (!text?.trim()) {
        res.status(400).json({ error: 'text is required' });
        return;
      }

      const msg = {
        id: randomUUID(),
        userId: user.id,
        name: user.name,
        text: text.trim(),
        at: new Date().toISOString(),
      };
      addMessage(teamId, msg);
      res.status(201).json({ message: msg });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
