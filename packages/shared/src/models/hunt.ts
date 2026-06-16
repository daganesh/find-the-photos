import type { GeoPoint } from './geo.js';

/**
 * How much help the hunter has unlocked for the current step.
 * Higher levels make the step easier but lower its achievable score.
 */
export enum HelpLevel {
  /** No help yet — just the hint. */
  None = 0,
  /** Show a dot on the map at the target location. */
  MapDot = 1,
  /** Draw the route/line from the hunter to the target. */
  RouteLine = 2,
  /** Reveal the item's text description. */
  Describe = 3,
  /** Describe the immediate surroundings (closest, last-resort hint). */
  Surroundings = 4,
}

export type StepStatus = 'locked' | 'active' | 'found' | 'skipped';

/** The verdict from the AI image comparison for one submitted photo. */
export interface MatchVerdict {
  match: boolean;
  /** 0..1 confidence reported by the model. */
  confidence: number;
  /** Short human-readable reason, shown when it's NOT a match. */
  reason: string;
}

/** One attempt to find an item by submitting a photo. */
export interface PhotoAttempt {
  photoUrl: string;
  verdict: MatchVerdict;
  at: string; // ISO timestamp
  /** In team play: which member submitted this photo. */
  submittedBy?: string;
}

/** The hunter's progress on a single item. */
export interface StepProgress {
  itemId: string;
  status: StepStatus;
  photoAttempts: PhotoAttempt[];
  /** Number of clues/help reveals used (drives scoring). */
  cluesUsed: number;
  helpLevel: HelpLevel;
  startedAt?: string;
  finishedAt?: string;
  /** True when the hunter overrode a "no match" verdict. */
  disputed: boolean;
  /** In team play: userId of the member who found this item. */
  foundBy?: string;
}

/** A single play-through of a route — solo or shared by a team. */
export interface HuntSession {
  id: string;
  routeId: string;
  /** Solo: the player's userId. Team: the owner's userId. */
  hunterId: string;
  /** Set when this session belongs to a team. */
  teamId?: string;
  /** Number of items unlocked in parallel (1 = sequential solo play). */
  teamSize: number;
  steps: StepProgress[];
  startedAt: string;
  /** Device location captured when the hunt started (for filtering/map later). */
  startLocation?: GeoPoint;
  finishedAt?: string;
  totalScore: number;
}
