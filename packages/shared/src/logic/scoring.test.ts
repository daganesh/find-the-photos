import { describe, it, expect } from 'vitest';
import { scoreStep, scoreSession, stepStars, SCORING } from './scoring.js';
import { createStep, recordAttempt, escalateHelp } from './huntMachine.js';
import type { HuntSession, MatchVerdict, StepProgress } from '../models/hunt.js';

const NOW = '2026-06-14T17:00:00.000Z';
const miss: MatchVerdict = { match: false, confidence: 0.2, reason: 'no' };
const hit: MatchVerdict = { match: true, confidence: 0.95, reason: 'yes' };

const foundFirstTry = (): StepProgress =>
  recordAttempt(createStep('i', NOW), hit, 'p', NOW);

describe('scoreStep', () => {
  it('awards the full base for a clean find', () => {
    expect(scoreStep(foundFirstTry())).toBe(SCORING.base);
    expect(stepStars(foundFirstTry())).toBe(3);
  });

  it('penalises retries and help, with a floor', () => {
    let step = createStep('i', NOW);
    step = recordAttempt(step, miss, 'p', NOW);
    step = escalateHelp(step, 'far'); // one help level
    step = recordAttempt(step, hit, 'p', NOW);
    expect(scoreStep(step)).toBe(SCORING.base - SCORING.perRetry - SCORING.perHelpLevel);
  });

  it('scores a skipped step as zero', () => {
    const skipped: StepProgress = { ...createStep('i', NOW), status: 'skipped' };
    expect(scoreStep(skipped)).toBe(0);
  });

  it('never drops below the floor', () => {
    let step = createStep('i', NOW);
    for (let n = 0; n < 8; n++) step = recordAttempt(step, miss, 'p', NOW);
    for (let n = 0; n < 8; n++) step = escalateHelp(step, 'far');
    step = recordAttempt(step, hit, 'p', NOW);
    expect(scoreStep(step)).toBe(SCORING.floor);
  });
});

describe('scoreSession', () => {
  it('sums step scores', () => {
    const session: HuntSession = {
      id: 's', routeId: 'r', hunterId: 'h', startedAt: NOW, totalScore: 0,
      steps: [foundFirstTry(), { ...createStep('j', NOW), status: 'skipped' }],
    };
    expect(scoreSession(session)).toBe(SCORING.base);
  });

  it('adds the final item bonus when finalItemSolved is true', () => {
    const session: HuntSession = {
      id: 's', routeId: 'r', hunterId: 'h', startedAt: NOW, totalScore: 0,
      steps: [foundFirstTry()],
      finalItemSolved: true,
    };
    expect(scoreSession(session)).toBe(SCORING.base + SCORING.finalItemBonus);
  });

  it('does not add the bonus when finalItemSolved is false', () => {
    const session: HuntSession = {
      id: 's', routeId: 'r', hunterId: 'h', startedAt: NOW, totalScore: 0,
      steps: [foundFirstTry()],
      finalItemSolved: false,
    };
    expect(scoreSession(session)).toBe(SCORING.base);
  });
});
