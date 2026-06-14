import type { StepProgress } from '../models/hunt.js';

/** Signals that mark an item as "difficult" once enough hunters struggle. */
export const DIFFICULTY = {
  /** A single skip is a strong signal the item is too hard. */
  skipIsDifficult: true,
  /** This many failed photo attempts in one play marks it difficult. */
  failedAttemptsThreshold: 4,
  /** Reaching this help level in one play marks it difficult. */
  helpLevelThreshold: 3,
} as const;

/**
 * Decide from a single play-through whether the item looked difficult.
 * Pure: callers aggregate this across sessions to set `Item.difficult`.
 */
export function stepLookedDifficult(step: StepProgress): boolean {
  if (step.status === 'skipped' && DIFFICULTY.skipIsDifficult) return true;

  const failed = step.photoAttempts.filter((a) => !a.verdict.match).length;
  if (failed >= DIFFICULTY.failedAttemptsThreshold) return true;

  return step.helpLevel >= DIFFICULTY.helpLevelThreshold;
}
