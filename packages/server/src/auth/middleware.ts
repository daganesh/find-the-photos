import type { NextFunction, Request, Response } from 'express';
import type { User } from '@ftp/shared';
import { readSession } from './auth.js';
import { config } from '../config.js';

/** Express request augmented with the signed-in user. */
export interface AuthedRequest extends Request {
  user?: User;
}

/** Pull a Bearer token off the Authorization header. */
function bearer(req: Request): string | undefined {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice('Bearer '.length);
}

/**
 * Require a valid session. Per the spec, Google sign-in is needed to create a
 * route or play, so the mutating endpoints sit behind this.
 */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = bearer(req);
  const user = token ? readSession(token) : undefined;
  if (!user) {
    res.status(401).json({ error: 'Sign in to continue' });
    return;
  }
  req.user = user;
  next();
}

/** Attach the user when present, but don't require it (for public reads). */
export function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const token = bearer(req);
  req.user = token ? readSession(token) : undefined;
  next();
}

/** Require the signed-in user to be in the admin list. */
export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = bearer(req);
  const user = token ? readSession(token) : undefined;
  if (!user) { res.status(401).json({ error: 'Sign in to continue' }); return; }
  if (!config.adminEmails.includes(user.email)) { res.status(403).json({ error: 'Admin access required' }); return; }
  req.user = user;
  next();
}
