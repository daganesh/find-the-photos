import { describe, it, expect } from 'vitest';
import type { HuntSession, MatchVerdict, Route } from '@ftp/shared';
import type { AppContext } from '../context.js';
import {
  buildSession,
  findActiveStep,
  submitPhoto,
  dispute,
  skip,
  returnSkipped,
  solveRiddle,
  solveFinalItem,
} from './huntService.js';

// ── Fake context factory ───────────────────────────────────────────────────

interface FakeMatchService {
  compareResult?: MatchVerdict;
  verifyResult?: MatchVerdict;
}

function fakeContext(
  route: Route,
  match: FakeMatchService = {},
): { ctx: AppContext; sessions: Map<string, HuntSession> } {
  const sessions = new Map<string, HuntSession>();
  const routes = new Map([[route.id, structuredClone(route)]]);

  const compareResult: MatchVerdict = match.compareResult ?? { match: true, confidence: 0.9, reason: 'yes' };
  const verifyResult: MatchVerdict = match.verifyResult ?? { match: true, confidence: 0.9, reason: 'yes' };

  const ctx = {
    routes: {
      list: async () => [...routes.values()],
      get: async (id: string) => routes.get(id),
      create: async (r: Route) => (routes.set(r.id, r), r),
      update: async (id: string, patch: Partial<Route>) => {
        const next = { ...routes.get(id)!, ...patch } as Route;
        routes.set(id, next);
        return next;
      },
      remove: async () => true,
    },
    hunts: {
      get: async (id: string) => sessions.get(id),
      create: async (s: HuntSession) => (sessions.set(s.id, s), s),
      update: async (id: string, patch: Partial<HuntSession>) => {
        const next = { ...sessions.get(id)!, ...patch } as HuntSession;
        sessions.set(id, next);
        return next;
      },
      listByRoute: async () => [],
    },
    photos: {
      save: async () => ({ id: 'p', url: '/uploads/p.jpg' }),
      readByUrl: async () => Buffer.from('ref'),
    },
    imageMatch: {
      compare: async () => compareResult,
      verifyDispute: async () => verifyResult,
      scoreTask: async () => compareResult,
    },
  } as unknown as AppContext;

  return { ctx, sessions };
}

// ── Test fixtures ──────────────────────────────────────────────────────────

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

const riddleRoute: Route = {
  ...route,
  id: 'r2',
  items: [
    { id: 'ri1', kind: 'riddle', name: 'Clock', hint: { kind: 'text', text: 'Has hands but no arms' }, photos: [], difficult: false },
    { id: 'ri2', kind: 'riddle', name: 'Mirror', hint: { kind: 'text', text: 'Shows you yourself' }, photos: [], difficult: false },
  ],
};

const codeRoute: Route = {
  ...route,
  id: 'r3',
  finalItem: { kind: 'code', answer: 'CASTLE', difficulty: 1 },
};

const riddleFinalRoute: Route = {
  ...route,
  id: 'r4',
  finalItem: { kind: 'riddle', answer: 'FOUNTAIN', riddleQuestion: 'Water flows here' },
};

// ── buildSession ───────────────────────────────────────────────────────────

describe('buildSession', () => {
  it('activates the first step and locks the rest', () => {
    const s = buildSession(route, 'hunter');
    expect(s.steps[0]!.status).toBe('active');
    expect(s.steps[1]!.status).toBe('locked');
  });
});

// ── submitPhoto ────────────────────────────────────────────────────────────

describe('submitPhoto', () => {
  it('solves a step and unlocks the next on a match', async () => {
    const { ctx } = fakeContext(route);
    const session = await ctx.hunts.create(buildSession(route, 'hunter'));

    const found = await findActiveStep(ctx, session.id, 'i1');
    if ('error' in found) throw new Error('expected step');

    const next = await submitPhoto(ctx, found, { base64: 'YWJj', mimeType: 'image/jpeg' });
    expect(next.steps[0]!.status).toBe('found');
    expect(next.steps[1]!.status).toBe('active');
    expect(next.totalScore).toBeGreaterThan(0);
  });

  it('keeps the step active on a miss', async () => {
    const { ctx } = fakeContext(route, { compareResult: { match: false, confidence: 0.2, reason: 'no' } });
    const session = await ctx.hunts.create(buildSession(route, 'hunter'));
    const found = await findActiveStep(ctx, session.id, 'i1');
    if ('error' in found) throw new Error('expected step');

    const next = await submitPhoto(ctx, found, { base64: 'YWJj', mimeType: 'image/jpeg' });
    expect(next.steps[0]!.status).toBe('active');
    expect(next.steps[0]!.photoAttempts).toHaveLength(1);
  });
});

// ── dispute ────────────────────────────────────────────────────────────────

describe('dispute', () => {
  it('marks the step found when description matches', async () => {
    const { ctx } = fakeContext(route, { verifyResult: { match: true, confidence: 0.85, reason: 'yes' } });
    const session = await ctx.hunts.create(buildSession(route, 'hunter'));
    const found = await findActiveStep(ctx, session.id, 'i1');
    if ('error' in found) throw new Error('expected step');

    const result = await dispute(ctx, found, 'a red bench');
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.steps[0]!.status).toBe('found');
    expect(result.steps[0]!.disputed).toBe(true);
  });

  it('returns an error when description does not match', async () => {
    const { ctx } = fakeContext(route, { verifyResult: { match: false, confidence: 0.1, reason: 'different' } });
    const session = await ctx.hunts.create(buildSession(route, 'hunter'));
    const found = await findActiveStep(ctx, session.id, 'i1');
    if ('error' in found) throw new Error('expected step');

    const result = await dispute(ctx, found, 'a blue door');
    expect('error' in result).toBe(true);
    if (!('error' in result)) return;
    expect(result.status).toBe(409);
    expect(result.error).toBe('different');
  });
});

// ── skip / returnSkipped ───────────────────────────────────────────────────

describe('skip + returnSkipped', () => {
  it('skips a step then re-activates it', async () => {
    const { ctx } = fakeContext(route);
    const session = await ctx.hunts.create(buildSession(route, 'hunter'));
    const found = await findActiveStep(ctx, session.id, 'i1');
    if ('error' in found) throw new Error('expected step');

    const afterSkip = await skip(ctx, found);
    expect(afterSkip.steps[0]!.status).toBe('skipped');

    const afterReturn = await returnSkipped(ctx, session.id, 'i1');
    expect('error' in afterReturn).toBe(false);
    if ('error' in afterReturn) return;
    expect(afterReturn.steps[0]!.status).toBe('active');
    expect(afterReturn.finishedAt).toBeUndefined();
  });

  it('errors when item is not skipped', async () => {
    const { ctx } = fakeContext(route);
    const session = await ctx.hunts.create(buildSession(route, 'hunter'));
    const result = await returnSkipped(ctx, session.id, 'i1'); // still active
    expect('error' in result).toBe(true);
  });
});

// ── solveRiddle ────────────────────────────────────────────────────────────

describe('solveRiddle', () => {
  it('marks the step found when the answer is correct', async () => {
    const { ctx } = fakeContext(riddleRoute, { verifyResult: { match: true, confidence: 0.9, reason: 'correct' } });
    const session = await ctx.hunts.create(buildSession(riddleRoute, 'hunter'));
    const found = await findActiveStep(ctx, session.id, 'ri1');
    if ('error' in found) throw new Error('expected step');

    const result = await solveRiddle(ctx, found, 'clock');
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.steps[0]!.status).toBe('found');
    expect(result.steps[0]!.disputed).toBe(false);
  });

  it('returns an error on a wrong answer without revealing the real answer', async () => {
    const { ctx } = fakeContext(riddleRoute, { verifyResult: { match: false, confidence: 0.1, reason: 'think bigger' } });
    const session = await ctx.hunts.create(buildSession(riddleRoute, 'hunter'));
    const found = await findActiveStep(ctx, session.id, 'ri1');
    if ('error' in found) throw new Error('expected step');

    const result = await solveRiddle(ctx, found, 'table');
    expect('error' in result).toBe(true);
    if (!('error' in result)) return;
    expect(result.status).toBe(409);
    expect(result.error).toBe('think bigger');
  });
});

// ── solveFinalItem ─────────────────────────────────────────────────────────

describe('solveFinalItem — code kind', () => {
  it('accepts an exact code (case-insensitive, ignores spaces and dashes)', async () => {
    const { ctx } = fakeContext(codeRoute);
    const s = await ctx.hunts.create(buildSession(codeRoute, 'hunter'));

    const result = await solveFinalItem(ctx, s.id, 'castle');
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.finalItemSolved).toBe(true);
  });

  it('rejects a wrong code', async () => {
    const { ctx } = fakeContext(codeRoute);
    const s = await ctx.hunts.create(buildSession(codeRoute, 'hunter'));

    const result = await solveFinalItem(ctx, s.id, 'PALACE');
    expect('error' in result).toBe(true);
    if (!('error' in result)) return;
    expect(result.status).toBe(409);
  });

  it('rejects a second solve attempt', async () => {
    const { ctx } = fakeContext(codeRoute);
    const s = await ctx.hunts.create(buildSession(codeRoute, 'hunter'));
    await solveFinalItem(ctx, s.id, 'castle');
    const result = await solveFinalItem(ctx, s.id, 'castle');
    expect('error' in result).toBe(true);
  });
});

describe('solveFinalItem — riddle kind', () => {
  it('marks solved when AI confirms the answer', async () => {
    const { ctx } = fakeContext(riddleFinalRoute, { verifyResult: { match: true, confidence: 0.9, reason: 'yes' } });
    const s = await ctx.hunts.create(buildSession(riddleFinalRoute, 'hunter'));

    const result = await solveFinalItem(ctx, s.id, 'the old fountain');
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.finalItemSolved).toBe(true);
  });

  it('returns error when AI rejects the answer', async () => {
    const { ctx } = fakeContext(riddleFinalRoute, { verifyResult: { match: false, confidence: 0.1, reason: 'not right' } });
    const s = await ctx.hunts.create(buildSession(riddleFinalRoute, 'hunter'));

    const result = await solveFinalItem(ctx, s.id, 'a pond');
    expect('error' in result).toBe(true);
    if (!('error' in result)) return;
    expect(result.status).toBe(409);
  });
});
