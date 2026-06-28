import { Router } from 'express';
import type { GoogleSignInRequest, SessionResponse } from '@ftp/shared';
import type { User } from '@ftp/shared';
import { issueSession, verifyGoogleCredential } from '../auth/auth.js';
import { isGoogleAuthConfigured, config } from '../config.js';

/** `/api/auth` — exchange a Google credential for a session token. */
export function authRouter(): Router {
  const router = Router();

  // Lets the web app know whether to render the real Google button or the dev
  // sign-in form.
  router.get('/config', (_req, res) => {
    res.json({ googleConfigured: isGoogleAuthConfigured() });
  });

  router.post('/google', async (req, res, next) => {
    try {
      const { credential } = req.body as GoogleSignInRequest;
      if (!credential) {
        res.status(400).json({ error: 'Missing credential' });
        return;
      }
      const userBase = await verifyGoogleCredential(credential);
      const user: User = { ...userBase, isAdmin: config.adminEmails.includes(userBase.email.toLowerCase()) };
      const body: SessionResponse = { token: issueSession(user), user };
      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
