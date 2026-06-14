import { describe, it, expect } from 'vitest';
import type { HuntSession, MatchVerdict, Route } from '@ftp/shared';
import type { AppContext } from '../context.js';
import { buildSession, findActiveStep, submitPhoto } from './huntService.js';

/** Minimal in-memory context for testing the hunt orchestration. */
function fakeContext(route: Route, verdict: MatchVerdict): { ctx: AppContext; sessions: Map<string, HuntSession> } {
  const sessions = new Map<string, HuntSession>();
  const routes = new Map([[route.id, structuredClone(route)]]);
  const ctx = {
    routes: {
      list: async () => [...routes.values()],
      get: async (id: string) => routes.get(id),
      create: async (r: Route) => (routes.set(r.id, r), r),
      update: async (id: string, patch) => {
        const next = { ...routes.get(id)!, ...patch } as Route;
        routes.set(id, next);
        return next;
      },
      remove: async () => true,
    },
    hunts: {
      get: async (id: string) => sessions.get(id),
      create: async (s: HuntSession) => (sessions.set(s.id, s), s),
      update: async (id: string, patch) => {
        const next = { ...sessions.get(id)!, ...patch } as HuntSession;
        sessions.set(id, next);
        return next;
      },
      listByRoute: async () => [],
    },
    photos: {
      save: async (_buf: Buffer, mime: string) => ({ id: 'p', url: `/uploads/p.jpg` }),
      readByUrl: async () => Buffer.from('ref'),
    },
    imageMatch: { compare: async () => verdict },
  } as unknown as AppContext;
  return { ctx, sessions };
}

const route: Route = {
  id: 'r1',
  title: 'Park loop',
  authorId: 'a',
  status: 'ready',
  createdAt: '2026-06-14T00:00:00Z',
  ratings: [],
  items: [
    { id: 'i1', name: 'Red bench', hint: { kind: 'text', text: 'Sit down' }, photos: [{ id: 'x', url: '/uploads/x.jpg' }], difficult: false },
    { id: 'i2', name: 'Oak tree', hint: { kind: 'text', text: 'Look up' }, photos: [{ id: 'y', url: '/uploads/y.jpg' }], difficult: false },
  ],
};

describe('buildSession', () => {
  it('activates the first step and locks the rest', () => {
    const s = buildSession(route, 'hunter');
    expect(s.steps[0]!.status).toBe('active');
    expect(s.steps[1]!.status).toBe('locked');
  });
});

describe('submitPhoto', () => {
  it('solves a step and unlocks the next on a match', async () => {
    const { ctx } = fakeContext(route, { match: true, confidence: 0.9, reason: 'yes' });
    const session = await ctx.hunts.create(buildSession(route, 'hunter'));

    const found = await findActiveStep(ctx, session.id, 'i1');
    expect('error' in found).toBe(false);
    if ('error' in found) return;

    const next = await submitPhoto(ctx, found, { base64: 'YWJj', mimeType: 'image/jpeg' });
    expect(next.steps[0]!.status).toBe('found');
    expect(next.steps[1]!.status).toBe('active'); // advanced
    expect(next.totalScore).toBeGreaterThan(0);
  });

  it('keeps the step active on a miss', async () => {
    const { ctx } = fakeContext(route, { match: false, confidence: 0.2, reason: 'no' });
    const session = await ctx.hunts.create(buildSession(route, 'hunter'));
    const found = await findActiveStep(ctx, session.id, 'i1');
    if ('error' in found) throw new Error('expected step');

    const next = await submitPhoto(ctx, found, { base64: 'YWJj', mimeType: 'image/jpeg' });
    expect(next.steps[0]!.status).toBe('active');
    expect(next.steps[0]!.photoAttempts).toHaveLength(1);
  });
});
