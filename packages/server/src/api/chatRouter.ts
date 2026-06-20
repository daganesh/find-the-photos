import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { addMessage, getMessages } from '../chat/chatStore.js';

/** `POST/GET /api/teams/:teamId/chat` — in-memory team chat. */
export function chatRouter(): Router {
  const router = Router({ mergeParams: true });

  router.get('/', requireAuth, (req: AuthedRequest, res) => {
    const { teamId } = req.params as { teamId: string };
    const since = (req.query as { since?: string }).since;
    res.json({ messages: getMessages(teamId, since) });
  });

  router.post('/', requireAuth, (req: AuthedRequest, res) => {
    const { teamId } = req.params as { teamId: string };
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
  });

  return router;
}
