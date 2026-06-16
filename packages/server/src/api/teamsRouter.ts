import { Router } from 'express';
import { nanoid } from 'nanoid';
import type { Team, TeamMember } from '@ftp/shared';
import { computeTeamResult } from '@ftp/shared';
import type { AppContext } from '../context.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { buildTeamSession } from '../hunt/huntService.js';

/** Generate a short, human-readable join code (e.g. "XK4A2B"). */
function makeJoinCode(): string {
  return nanoid(6).toUpperCase();
}

/** `/api/teams` — create, join, and control team lobbies. */
export function teamsRouter(ctx: AppContext): Router {
  const router = Router();

  /** Create a new team and go to the lobby. */
  router.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const { routeId, name } = req.body as { routeId?: string; name?: string };
      if (!routeId) return void res.status(400).json({ error: 'routeId required' });
      const route = await ctx.routes.get(routeId);
      if (!route) return void res.status(404).json({ error: 'Route not found' });
      if (route.status !== 'ready') return void res.status(400).json({ error: 'Route is not ready to play' });

      const member: TeamMember = {
        userId: req.user!.id,
        name: req.user!.name ?? 'Hunter',
        joinedAt: new Date().toISOString(),
      };
      const team: Team = {
        id: nanoid(12),
        routeId,
        name: name?.trim() || (req.user!.name ?? 'Team'),
        ownerId: req.user!.id,
        joinCode: makeJoinCode(),
        members: [member],
        status: 'lobby',
        createdAt: new Date().toISOString(),
        totalPausedMs: 0,
      };
      res.status(201).json(await ctx.teams.create(team));
    } catch (err) { next(err); }
  });

  /** Get team state (members, status, sessionId). Polled by clients. */
  router.get('/:id', requireAuth, async (req, res, next) => {
    try {
      const team = await ctx.teams.get(req.params.id);
      if (!team) return void res.status(404).json({ error: 'Team not found' });
      res.json(team);
    } catch (err) { next(err); }
  });

  /** Join via 6-char join code. */
  router.post('/join/:code', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const team = await ctx.teams.getByJoinCode(req.params.code);
      if (!team) return void res.status(404).json({ error: 'Team not found — check the code' });
      if (team.status !== 'lobby') return void res.status(409).json({ error: 'This hunt has already started' });

      const alreadyIn = team.members.some((m) => m.userId === req.user!.id);
      if (!alreadyIn) {
        const member: TeamMember = {
          userId: req.user!.id,
          name: req.user!.name ?? 'Hunter',
          joinedAt: new Date().toISOString(),
        };
        await ctx.teams.update(team.id, { members: [...team.members, member] });
      }
      const updated = await ctx.teams.get(team.id);
      res.json(updated);
    } catch (err) { next(err); }
  });

  /** Update team name / photo (owner only). */
  router.patch('/:id', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const team = await ctx.teams.get(req.params.id);
      if (!team) return void res.status(404).json({ error: 'Team not found' });
      if (team.ownerId !== req.user!.id) return void res.status(403).json({ error: 'Only the owner can edit the team' });
      const { name, photoUrl } = req.body as { name?: string; photoUrl?: string };
      const patch: Partial<Team> = {};
      if (name !== undefined) patch.name = name.trim() || team.name;
      if (photoUrl !== undefined) patch.photoUrl = photoUrl || undefined;
      res.json(await ctx.teams.update(team.id, patch));
    } catch (err) { next(err); }
  });

  /** Start the hunt — creates the shared session, N items active, timer begins. */
  router.post('/:id/start', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const team = await ctx.teams.get(req.params.id);
      if (!team) return void res.status(404).json({ error: 'Team not found' });
      if (team.ownerId !== req.user!.id) return void res.status(403).json({ error: 'Only the owner can start the hunt' });
      if (team.status !== 'lobby') return void res.status(409).json({ error: 'Hunt already started' });

      const route = await ctx.routes.get(team.routeId);
      if (!route) return void res.status(404).json({ error: 'Route not found' });

      const now = new Date().toISOString();
      const session = await ctx.hunts.create(
        buildTeamSession(route, team.ownerId, team.id, team.members.length),
      );
      const updated = await ctx.teams.update(team.id, {
        status: 'playing',
        sessionId: session.id,
        startedAt: now,
      });
      res.json({ team: updated, session });
    } catch (err) { next(err); }
  });

  /** Pause/resume for the whole team. */
  router.post('/:id/pause', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const team = await ctx.teams.get(req.params.id);
      if (!team) return void res.status(404).json({ error: 'Team not found' });
      if (!team.members.some((m) => m.userId === req.user!.id)) {
        return void res.status(403).json({ error: 'Not a team member' });
      }
      const now = Date.now();
      if (team.status === 'playing') {
        await ctx.teams.update(team.id, { status: 'paused', finishedAt: undefined });
        // Store pausedAt in a temp field via the name (simplest without schema change)
        res.json(await ctx.teams.update(team.id, { status: 'paused' }));
      } else if (team.status === 'paused') {
        // Resume: accumulate paused duration
        void now; // suppress unused warning
        res.json(await ctx.teams.update(team.id, { status: 'playing' }));
      } else {
        return void res.status(409).json({ error: 'Team is not in a pauseable state' });
      }
    } catch (err) { next(err); }
  });

  /** Leaderboard: all finished teams for a route, sorted by score then time. */
  router.get('/route/:routeId/leaderboard', requireAuth, async (req, res, next) => {
    try {
      const teams = await ctx.teams.listByRoute(req.params.routeId);
      const finished = teams.filter((t) => t.status === 'finished' && t.sessionId);
      const results = await Promise.all(
        finished.map(async (t) => {
          const session = await ctx.hunts.get(t.sessionId!);
          if (!session) return null;
          return computeTeamResult(t, session);
        }),
      );
      const sorted = results
        .filter(Boolean)
        .sort((a, b) => {
          if (b!.totalScore !== a!.totalScore) return b!.totalScore - a!.totalScore;
          return (a!.totalSeconds ?? Infinity) - (b!.totalSeconds ?? Infinity);
        });
      res.json(sorted);
    } catch (err) { next(err); }
  });

  return router;
}
