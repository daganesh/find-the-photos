import { describe, it, expect } from 'vitest';
import { issueSession, readSession } from './auth.js';
import { config } from '../config.js';

function roundtrip(email: string) {
  const user = { id: `uid:${email}`, name: 'Test User', email };
  const token = issueSession(user);
  return readSession(token);
}

describe('readSession', () => {
  it('returns undefined for an invalid token', () => {
    expect(readSession('not-a-token')).toBeUndefined();
  });

  it('restores id, name, email and pictureUrl from a valid token', () => {
    const user = { id: 'u1', name: 'Alice', email: 'alice@example.com', pictureUrl: 'https://example.com/pic.jpg' };
    const token = issueSession(user);
    const restored = readSession(token);
    expect(restored).toMatchObject({ id: 'u1', name: 'Alice', email: 'alice@example.com', pictureUrl: 'https://example.com/pic.jpg' });
  });

  it('sets isAdmin: true for an email in the admin list', () => {
    const adminEmail = config.adminEmails[0];
    if (!adminEmail) return; // no admin configured — skip
    const restored = roundtrip(adminEmail);
    expect(restored?.isAdmin).toBe(true);
  });

  it('sets isAdmin: false for an email not in the admin list', () => {
    const restored = roundtrip('not-an-admin@example.com');
    expect(restored?.isAdmin).toBe(false);
  });
});
