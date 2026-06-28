import { describe, it, expect } from 'vitest';
import { computeTeamResult, findBestBlooper } from './teamScoring.js';
import { createStep, recordAttempt } from './huntMachine.js';
import type { HuntSession } from '../models/hunt.js';
import type { Team } from '../models/team.js';

const NOW = '2026-06-28T10:00:00.000Z';
const PHOTO = 'photo.jpg';
const miss = (confidence: number) => ({ match: false as const, confidence, reason: 'no match' });
const hit = { match: true as const, confidence: 0.95, reason: 'matched' };

function makeSession(steps: HuntSession['steps']): HuntSession {
  return {
    id: 's1',
    routeId: 'r1',
    hunterId: 'u1',
    teamSize: 1,
    steps,
    startedAt: NOW,
    totalScore: 0,
  };
}

function makeTeam(memberIds: string[]): Team {
  return {
    id: 't1',
    routeId: 'r1',
    name: 'Test Team',
    ownerId: memberIds[0] ?? 'u1',
    joinCode: 'ABC123',
    members: memberIds.map((id) => ({ userId: id, name: `User ${id}`, joinedAt: NOW })),
    status: 'finished',
    createdAt: NOW,
    startedAt: NOW,
    finishedAt: NOW,
    totalPausedMs: 0,
  };
}

describe('findBestBlooper', () => {
  it('returns undefined when there are no photo attempts', () => {
    const step = createStep('item1', NOW);
    const session = makeSession([step]);
    expect(findBestBlooper(session)).toBeUndefined();
  });

  it('returns undefined when all attempts matched', () => {
    const step = recordAttempt(createStep('item1', NOW), hit, PHOTO, NOW);
    const session = makeSession([step]);
    expect(findBestBlooper(session)).toBeUndefined();
  });

  it('returns the failed attempt with highest confidence', () => {
    let step = createStep('item1', NOW);
    step = recordAttempt(step, miss(0.3), 'low.jpg', NOW);
    step = recordAttempt(step, miss(0.7), 'high.jpg', NOW);
    step = recordAttempt(step, hit, PHOTO, NOW);
    const session = makeSession([step]);

    const blooper = findBestBlooper(session);
    expect(blooper).toBeDefined();
    expect(blooper?.photoUrl).toBe('high.jpg');
    expect(blooper?.itemId).toBe('item1');
  });

  it('finds the best blooper across multiple steps', () => {
    let step1 = createStep('item1', NOW);
    step1 = recordAttempt(step1, miss(0.4), 'low.jpg', NOW, 'u1');

    let step2 = createStep('item2', NOW);
    step2 = recordAttempt(step2, miss(0.8), 'high.jpg', NOW, 'u2');

    const session = makeSession([step1, step2]);
    const blooper = findBestBlooper(session);

    expect(blooper?.photoUrl).toBe('high.jpg');
    expect(blooper?.itemId).toBe('item2');
    expect(blooper?.memberName).toBe('u2');
  });

  it('includes submittedBy from the best failing attempt', () => {
    let step = createStep('item1', NOW);
    step = recordAttempt(step, miss(0.6), 'fail.jpg', NOW, 'alice');
    const session = makeSession([step]);

    const blooper = findBestBlooper(session);
    expect(blooper?.memberName).toBe('alice');
  });
});

describe('computeTeamResult', () => {
  it('returns zero scores when no items are found', () => {
    const step = createStep('item1', NOW);
    const session = makeSession([step]);
    const team = makeTeam(['u1', 'u2']);

    const result = computeTeamResult(team, session);
    expect(result.totalScore).toBe(0);
    expect(result.memberScores).toHaveLength(2);
    expect(result.memberScores.every((ms) => ms.totalScore === 0)).toBe(true);
    expect(result.mvpUserId).toBeUndefined();
  });

  it('credits the founding member for a found item', () => {
    // recordAttempt with a hit sets status:'found' and foundBy automatically
    const step = recordAttempt(createStep('item1', NOW), hit, PHOTO, NOW, 'u2');

    const session = makeSession([step]);
    const team = makeTeam(['u1', 'u2']);

    const result = computeTeamResult(team, session);
    const u2 = result.memberScores.find((ms) => ms.userId === 'u2');
    expect(u2?.itemsFound).toBe(1);
    expect(u2?.totalScore).toBeGreaterThan(0);
    expect(result.mvpUserId).toBe('u2');
  });

  it('names the highest-scoring member as MVP when one member found more items', () => {
    const step1 = recordAttempt(createStep('item1', NOW), hit, PHOTO, NOW, 'u1');
    const step2 = recordAttempt(createStep('item2', NOW), hit, PHOTO, NOW, 'u1');
    const step3 = recordAttempt(createStep('item3', NOW), hit, PHOTO, NOW, 'u2');

    const session = makeSession([step1, step2, step3]);
    const team = makeTeam(['u1', 'u2']);

    const result = computeTeamResult(team, session);
    expect(result.mvpUserId).toBe('u1');
  });
});
