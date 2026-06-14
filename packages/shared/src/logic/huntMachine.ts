import {
  HelpLevel,
  type MatchVerdict,
  type PhotoAttempt,
  type StepProgress,
} from '../models/hunt.js';
import type { ProximityBucket } from '../models/geo.js';

/** Behaviour knobs for the hunt flow. */
export const HUNT_RULES = {
  /** Failed attempts required before the "skip" option appears. */
  skipAfterFailedAttempts: 3,
} as const;

/** A fresh, ready-to-play step for an item. */
export function createStep(itemId: string, now: string): StepProgress {
  return {
    itemId,
    status: 'active',
    photoAttempts: [],
    cluesUsed: 0,
    helpLevel: HelpLevel.None,
    startedAt: now,
    disputed: false,
  };
}

/**
 * Record a photo attempt. On a match, the step is solved. On a miss, the step
 * stays active so the hunter can get help and try again.
 */
export function recordAttempt(
  step: StepProgress,
  verdict: MatchVerdict,
  photoUrl: string,
  now: string,
): StepProgress {
  const attempt: PhotoAttempt = { photoUrl, verdict, at: now };
  const photoAttempts = [...step.photoAttempts, attempt];

  if (verdict.match) {
    return { ...step, photoAttempts, status: 'found', finishedAt: now };
  }
  return { ...step, photoAttempts };
}

/** Number of attempts the AI rejected so far. */
export function failedAttempts(step: StepProgress): number {
  return step.photoAttempts.filter((a) => !a.verdict.match).length;
}

/**
 * The next help level to unlock, given how close the hunter is.
 * - Far away → guide them with the map first (dot, then route line).
 * - Near / mid / no-GPS → describe the item, then its surroundings.
 * Returns the *current* level when nothing more can be unlocked.
 */
export function suggestHelp(
  step: StepProgress,
  proximity: ProximityBucket,
): HelpLevel {
  const mapFirst = proximity === 'far' || proximity === 'mid';

  if (mapFirst) {
    if (step.helpLevel < HelpLevel.MapDot) return HelpLevel.MapDot;
    if (step.helpLevel < HelpLevel.RouteLine) return HelpLevel.RouteLine;
  }
  if (step.helpLevel < HelpLevel.Describe) return HelpLevel.Describe;
  if (step.helpLevel < HelpLevel.Surroundings) return HelpLevel.Surroundings;
  return step.helpLevel;
}

/**
 * Unlock the next help level. Raises `helpLevel` and counts a clue used
 * (which lowers the achievable score). No-op once fully escalated.
 */
export function escalateHelp(
  step: StepProgress,
  proximity: ProximityBucket,
): StepProgress {
  const next = suggestHelp(step, proximity);
  if (next <= step.helpLevel) return step;
  return { ...step, helpLevel: next, cluesUsed: step.cluesUsed + 1 };
}

/** Whether the hunter has earned the option to skip this item. */
export function canSkip(step: StepProgress): boolean {
  return (
    step.status === 'active' &&
    failedAttempts(step) >= HUNT_RULES.skipAfterFailedAttempts
  );
}

/** Give up on this item. Scored as 0 and flags the item as difficult later. */
export function skipStep(step: StepProgress, now: string): StepProgress {
  if (step.status !== 'active') return step;
  return { ...step, status: 'skipped', finishedAt: now };
}

/**
 * Hunter insists they found it after a "no match" verdict. Override to found
 * and flag as disputed so we can review/tune the AI later.
 */
export function disputeStep(step: StepProgress, now: string): StepProgress {
  if (step.status !== 'active') return step;
  return { ...step, status: 'found', disputed: true, finishedAt: now };
}

/** True when every step has been finished (found or skipped). */
export function isHuntComplete(steps: StepProgress[]): boolean {
  return steps.length > 0 && steps.every((s) => s.status === 'found' || s.status === 'skipped');
}
