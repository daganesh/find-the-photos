import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import type { User } from '@ftp/shared';
import { config, isGoogleAuthConfigured } from '../config.js';

const googleClient = new OAuth2Client(config.google.clientId);
const SESSION_TTL = '30d';

/**
 * Verify a Google ID token (the credential from Google Identity Services) and
 * return the family member it represents.
 *
 * When Google sign-in isn't configured (local dev), accept a base64 JSON
 * "dev token" so the app is still usable without credentials.
 */
export async function verifyGoogleCredential(credential: string): Promise<User> {
  if (!isGoogleAuthConfigured()) {
    return decodeDevCredential(credential);
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: config.google.clientId,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new Error('Google token missing required fields');
  }
  return {
    id: payload.sub,
    name: payload.name ?? payload.email,
    email: payload.email,
    pictureUrl: payload.picture,
  };
}

/** Issue a signed session token the client sends back on each request. */
export function issueSession(user: User): string {
  return jwt.sign(user, config.sessionSecret, { expiresIn: SESSION_TTL, algorithm: 'HS256' });
}

/** Verify a session token and return the user, or undefined if invalid. */
export function readSession(token: string): User | undefined {
  try {
    const decoded = jwt.verify(token, config.sessionSecret, { algorithms: ['HS256'] }) as jwt.JwtPayload & User;
    return {
      id: decoded.id,
      name: decoded.name,
      email: decoded.email,
      pictureUrl: decoded.pictureUrl,
      isAdmin: config.adminEmails.includes(decoded.email),
    };
  } catch {
    return undefined;
  }
}

/** Dev-only: the web app sends `btoa(JSON.stringify({name,email}))`. */
function decodeDevCredential(credential: string): User {
  try {
    const json = JSON.parse(Buffer.from(credential, 'base64').toString('utf8'));
    const email = String(json.email ?? 'player@example.com');
    return {
      id: `dev:${email}`,
      name: String(json.name ?? 'Player'),
      email,
      pictureUrl: json.pictureUrl,
    };
  } catch {
    return { id: 'dev:anon', name: 'Player', email: 'player@example.com' };
  }
}
