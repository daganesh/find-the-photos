export type TeamStatus = 'lobby' | 'playing' | 'paused' | 'finished';

export interface TeamMember {
  userId: string;
  name: string;
  avatarEmoji?: string;
  joinedAt: string;
}

/** A group of players hunting the same route together. */
export interface Team {
  id: string;
  routeId: string;
  name: string;
  photoUrl?: string;
  ownerId: string;
  /** Short alphanumeric code shown in the lobby so friends can join easily. */
  joinCode: string;
  members: TeamMember[];
  status: TeamStatus;
  /** Set once the owner clicks Start — links everyone to the shared session. */
  sessionId?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  totalPausedMs: number;
}

/** Per-member score breakdown, computed for the results / leaderboard. */
export interface MemberScore {
  userId: string;
  name: string;
  avatarEmoji?: string;
  itemsFound: number;
  totalScore: number;
}

/** A team's final result used in the leaderboard. */
export interface TeamResult {
  teamId: string;
  teamName: string;
  teamPhotoUrl?: string;
  memberScores: MemberScore[];
  totalScore: number;
  totalSeconds?: number;
  mvpUserId?: string;
}
