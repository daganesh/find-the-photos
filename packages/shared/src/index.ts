// Public surface of the shared package: domain models, pure game logic, and
// the client/server API contracts. Reused by the server and the web app (and a
// future mobile client).

// Models
export type { GeoPoint, ProximityBucket } from './models/geo.js';
export type {
  Hint,
  Photo,
  Item,
  ItemKind,
  FinalItem,
  RouteStatus,
  Rating,
  Route,
} from './models/route.js';
export {
  HelpLevel,
} from './models/hunt.js';
export type {
  StepStatus,
  MatchVerdict,
  PhotoAttempt,
  StepProgress,
  HuntSession,
} from './models/hunt.js';
export type { User } from './models/user.js';
export type {
  TeamStatus,
  TeamMember,
  Team,
  MemberScore,
  TeamResult,
} from './models/team.js';

// Logic
export { distanceMeters, proximityTo, PROXIMITY_THRESHOLDS } from './logic/geo.js';
export {
  SCORING,
  MAX_STEP_SCORE,
  MAX_HELP_LEVEL,
  scoreStep,
  scoreSession,
  stepStars,
} from './logic/scoring.js';
export { DIFFICULTY, stepLookedDifficult } from './logic/difficulty.js';
export {
  HUNT_RULES,
  createStep,
  recordAttempt,
  failedAttempts,
  suggestHelp,
  escalateHelp,
  canSkip,
  skipStep,
  returnSkippedStep,
  disputeStep,
  solveStep,
  isHuntComplete,
} from './logic/huntMachine.js';
export { isRoutePlayable, averageRating } from './logic/route.js';
export { getJigsawGridSize, getFinalItemPositions } from './logic/finalItem.js';
export { computeTeamResult, findBestBlooper } from './logic/teamScoring.js';

// Contracts
export type * from './contracts/api.js';
