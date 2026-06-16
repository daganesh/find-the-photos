import { describe, it, expect } from 'vitest';
import {
  createStep,
  recordAttempt,
  escalateHelp,
  suggestHelp,
  canSkip,
  skipStep,
  disputeStep,
  isHuntComplete,
} from './huntMachine.js';
import { HelpLevel, type MatchVerdict } from '../models/hunt.js';

const NOW = '2026-06-14T17:00:00.000Z';
const miss: MatchVerdict = { match: false, confidence: 0.2, reason: 'different object' };
const hit: MatchVerdict = { match: true, confidence: 0.95, reason: 'same object' };

describe('createStep', () => {
  it('starts active with no help and no attempts', () => {
    const step = createStep('item-1', NOW);
    expect(step.status).toBe('active');
    expect(step.helpLevel).toBe(HelpLevel.None);
    expect(step.photoAttempts).toHaveLength(0);
  });
});

describe('recordAttempt', () => {
  it('solves the step on a match', () => {
    const step = recordAttempt(createStep('i', NOW), hit, 'photo://1', NOW);
    expect(step.status).toBe('found');
    expect(step.finishedAt).toBe(NOW);
  });

  it('stays active on a miss and records the attempt', () => {
    const step = recordAttempt(createStep('i', NOW), miss, 'photo://1', NOW);
    expect(step.status).toBe('active');
    expect(step.photoAttempts).toHaveLength(1);
  });
});

describe('help escalation', () => {
  it('guides with the map first when far away', () => {
    let step = createStep('i', NOW);
    expect(suggestHelp(step, 'far')).toBe(HelpLevel.MapDot);
    step = escalateHelp(step, 'far');
    expect(step.helpLevel).toBe(HelpLevel.MapDot);
    expect(step.cluesUsed).toBe(1);
    step = escalateHelp(step, 'far');
    expect(step.helpLevel).toBe(HelpLevel.RouteLine);
  });

  it('describes the item first when GPS is unknown', () => {
    const step = createStep('i', NOW);
    expect(suggestHelp(step, 'unknown')).toBe(HelpLevel.Describe);
  });

  it('does not escalate past the maximum', () => {
    let step = createStep('i', NOW);
    for (let n = 0; n < 10; n++) step = escalateHelp(step, 'far');
    expect(step.helpLevel).toBe(HelpLevel.Surroundings);
  });
});

describe('skip', () => {
  it('is available for any active step', () => {
    const step = createStep('i', NOW);
    expect(canSkip(step)).toBe(true);
  });

  it('marks the step skipped', () => {
    const step = skipStep(createStep('i', NOW), NOW);
    expect(step.status).toBe('skipped');
  });
});

describe('dispute', () => {
  it('overrides a miss to found and flags it', () => {
    let step = recordAttempt(createStep('i', NOW), miss, 'p', NOW);
    step = disputeStep(step, NOW);
    expect(step.status).toBe('found');
    expect(step.disputed).toBe(true);
  });
});

describe('isHuntComplete', () => {
  it('is true only when all steps are found or skipped', () => {
    const a = recordAttempt(createStep('a', NOW), hit, 'p', NOW);
    const b = skipStep(
      (() => {
        let s = createStep('b', NOW);
        for (let n = 0; n < 3; n++) s = recordAttempt(s, miss, 'p', NOW);
        return s;
      })(),
      NOW,
    );
    expect(isHuntComplete([a, b])).toBe(true);
    expect(isHuntComplete([a, createStep('c', NOW)])).toBe(false);
  });
});
