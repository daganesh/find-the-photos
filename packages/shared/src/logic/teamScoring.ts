import type { TeamMember, MemberScore, TeamResult, Team } from '../models/team.js';
import type { HuntSession } from '../models/hunt.js';
import { scoreStep } from './scoring.js';

/** Compute per-member scores and MVP from a shared team session. */
export function computeTeamResult(team: Team, session: HuntSession): TeamResult {
  const memberMap = new Map<string, TeamMember>(team.members.map((m) => [m.userId, m]));

  const scoreByMember = new Map<string, number>();
  const foundByMember = new Map<string, number>();

  for (const member of team.members) {
    scoreByMember.set(member.userId, 0);
    foundByMember.set(member.userId, 0);
  }

  for (const step of session.steps) {
    if (step.status === 'found' && step.foundBy) {
      const prev = scoreByMember.get(step.foundBy) ?? 0;
      scoreByMember.set(step.foundBy, prev + scoreStep(step));
      foundByMember.set(step.foundBy, (foundByMember.get(step.foundBy) ?? 0) + 1);
    }
  }

  const memberScores: MemberScore[] = team.members.map((m) => ({
    userId: m.userId,
    name: m.name,
    avatarEmoji: m.avatarEmoji,
    avatarImageUrl: m.avatarImageUrl,
    itemsFound: foundByMember.get(m.userId) ?? 0,
    totalScore: scoreByMember.get(m.userId) ?? 0,
  }));

  memberScores.sort((a, b) => b.totalScore - a.totalScore);

  const mvp = memberScores[0];
  const mvpUserId = mvp && mvp.itemsFound > 0 ? mvp.userId : undefined;

  const totalSeconds =
    team.startedAt && team.finishedAt
      ? (new Date(team.finishedAt).getTime() - new Date(team.startedAt).getTime()) / 1000 -
        team.totalPausedMs / 1000
      : undefined;

  return {
    teamId: team.id,
    teamName: team.name,
    teamPhotoUrl: team.photoUrl,
    memberScores,
    totalScore: session.totalScore,
    totalSeconds,
    mvpUserId,
  };
}

/** Find the "best blooper": the photo attempt with highest confidence that still failed. */
export function findBestBlooper(
  session: HuntSession,
): { photoUrl: string; reason: string; memberName?: string; itemId: string } | undefined {
  let best: { confidence: number; photoUrl: string; reason: string; submittedBy?: string; itemId: string } | undefined;

  for (const step of session.steps) {
    for (const attempt of step.photoAttempts) {
      if (!attempt.verdict.match && attempt.verdict.confidence > (best?.confidence ?? 0)) {
        best = {
          confidence: attempt.verdict.confidence,
          photoUrl: attempt.photoUrl,
          reason: attempt.verdict.reason,
          submittedBy: attempt.submittedBy,
          itemId: step.itemId,
        };
      }
    }
  }

  return best ? { photoUrl: best.photoUrl, reason: best.reason, memberName: best.submittedBy, itemId: best.itemId } : undefined;
}
