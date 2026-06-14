import { HelpLevel, type StepProgress, type HuntSession } from '../models/hunt.js';

/** Tunable scoring constants. Kept in one place so the game feels fair. */
export const SCORING = {
  /** Points for finding an item with no help on the first photo. */
  base: 100,
  /** Points removed per help level unlocked. */
  perHelpLevel: 15,
  /** Points removed for each failed photo attempt. */
  perRetry: 10,
  /** A skipped item is worth nothing. */
  skipped: 0,
  /** Score can never go below this — effort still counts. */
  floor: 10,
} as const;

/** Highest score a single step can earn (for showing "x / max"). */
export const MAX_STEP_SCORE = SCORING.base;

/** Highest help level the game can reach. */
export const MAX_HELP_LEVEL: HelpLevel = HelpLevel.Surroundings;

/** Count photo attempts the AI rejected. */
function failedAttempts(step: StepProgress): number {
  return step.photoAttempts.filter((a) => !a.verdict.match).length;
}

/**
 * Score a single step. Pure: depends only on the step's recorded progress.
 * - skipped → 0
 * - found   → base, minus help and retry penalties, clamped to the floor.
 * - otherwise (locked/active) → 0
 */
export function scoreStep(step: StepProgress): number {
  if (step.status === 'skipped') return SCORING.skipped;
  if (step.status !== 'found') return 0;

  const helpPenalty = step.helpLevel * SCORING.perHelpLevel;
  const retryPenalty = failedAttempts(step) * SCORING.perRetry;

  return Math.max(SCORING.floor, SCORING.base - helpPenalty - retryPenalty);
}

/** Sum of all step scores in a session. */
export function scoreSession(session: HuntSession): number {
  return session.steps.reduce((total, step) => total + scoreStep(step), 0);
}

/** Friendly star rating (1..3) for a finished step, for kid-readable feedback. */
export function stepStars(step: StepProgress): 0 | 1 | 2 | 3 {
  if (step.status !== 'found') return 0;
  const score = scoreStep(step);
  if (score >= SCORING.base - SCORING.perRetry) return 3;
  if (score >= SCORING.base / 2) return 2;
  return 1;
}
