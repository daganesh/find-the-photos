import path from 'node:path';
import { nanoid } from 'nanoid';
import type {
  GeoPoint,
  HuntSession,
  Item,
  Route,
  StepProgress,
} from '@ftp/shared';
import {
  createStep,
  disputeStep,
  solveStep,
  escalateHelp,
  proximityTo,
  recordAttempt,
  returnSkippedStep,
  scoreSession,
  skipStep,
  stepLookedDifficult,
} from '@ftp/shared';
import type { AppContext } from '../context.js';
import type { InlineImage } from '../gemini/imageMatch.js';

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

const now = (): string => new Date().toISOString();

/** Build a fresh solo session: first item active, the rest locked (sequential play). */
export function buildSession(route: Route, hunterId: string, startLocation?: GeoPoint): HuntSession {
  const steps: StepProgress[] = route.items.map((item, index) => {
    const step = createStep(item.id, now());
    return index === 0 ? step : { ...step, status: 'locked', startedAt: undefined };
  });
  return {
    id: nanoid(12),
    routeId: route.id,
    hunterId,
    teamSize: 1,
    steps,
    startedAt: now(),
    startLocation,
    totalScore: 0,
  };
}

/** Build a team session: first N items active in parallel (N = team member count). */
export function buildTeamSession(
  route: Route,
  hunterId: string,
  teamId: string,
  teamSize: number,
  startLocation?: GeoPoint,
): HuntSession {
  const n = Math.max(1, Math.min(teamSize, route.items.length));
  const steps: StepProgress[] = route.items.map((item, index) => {
    const step = createStep(item.id, now());
    return index < n ? step : { ...step, status: 'locked', startedAt: undefined };
  });
  return {
    id: nanoid(12),
    routeId: route.id,
    hunterId,
    teamId,
    teamSize,
    steps,
    startedAt: now(),
    startLocation,
    totalScore: 0,
  };
}

/** Unlock locked steps until `teamSize` items are active simultaneously. Mutates in place. */
function advance(steps: StepProgress[], teamSize: number): void {
  let active = steps.filter((s) => s.status === 'active').length;
  while (active < teamSize) {
    const next = steps.findIndex((s) => s.status === 'locked');
    if (next === -1) break;
    steps[next] = { ...steps[next]!, status: 'active', startedAt: now() };
    active++;
  }
}

/** Replace a step by item id and keep the running total fresh. */
function withStep(session: HuntSession, itemId: string, next: StepProgress): HuntSession {
  const steps = session.steps.map((s) => (s.itemId === itemId ? next : s));
  advance(steps, session.teamSize);
  const updated: HuntSession = { ...session, steps };
  updated.totalScore = scoreSession(updated);
  if (steps.every((s) => s.status === 'found' || s.status === 'skipped')) {
    updated.finishedAt ??= now();
  }
  return updated;
}

/** Load an item's reference photos as inline base64 for the AI. */
async function loadReferences(ctx: AppContext, item: Item): Promise<InlineImage[]> {
  return Promise.all(
    item.photos.map(async (photo) => ({
      base64: (await ctx.photos.readByUrl(photo.url)).toString('base64'),
      mimeType: MIME_BY_EXT[path.extname(photo.url).slice(1).toLowerCase()] ?? 'image/jpeg',
    })),
  );
}

/** Flag the item as difficult on the route when a play-through struggled. */
async function maybeFlagDifficult(ctx: AppContext, route: Route, step: StepProgress): Promise<void> {
  if (!stepLookedDifficult(step)) return;
  const items = route.items.map((it) =>
    it.id === step.itemId ? { ...it, difficult: true } : it,
  );
  await ctx.routes.update(route.id, { items });
}

interface StepLookup {
  session: HuntSession;
  route: Route;
  item: Item;
  step: StepProgress;
}

/** Resolve and validate a session/step/item triplet, or explain what's wrong. */
export async function findActiveStep(
  ctx: AppContext,
  sessionId: string,
  itemId: string,
): Promise<StepLookup | { error: string; status: number }> {
  const session = await ctx.hunts.get(sessionId);
  if (!session) return { error: 'Hunt not found', status: 404 };
  const route = await ctx.routes.get(session.routeId);
  if (!route) return { error: 'Route not found', status: 404 };
  const item = route.items.find((i) => i.id === itemId);
  const step = session.steps.find((s) => s.itemId === itemId);
  if (!item || !step) return { error: 'Item not in this hunt', status: 404 };
  if (step.status !== 'active') return { error: 'That step is not active', status: 409 };
  return { session, route, item, step };
}

/** Resolve a skipped step for returning to it. */
async function findSkippedStep(
  ctx: AppContext,
  sessionId: string,
  itemId: string,
): Promise<StepLookup | { error: string; status: number }> {
  const session = await ctx.hunts.get(sessionId);
  if (!session) return { error: 'Hunt not found', status: 404 };
  const route = await ctx.routes.get(session.routeId);
  if (!route) return { error: 'Route not found', status: 404 };
  const item = route.items.find((i) => i.id === itemId);
  const step = session.steps.find((s) => s.itemId === itemId);
  if (!item || !step) return { error: 'Item not in this hunt', status: 404 };
  if (step.status !== 'skipped') return { error: 'That step is not skipped', status: 409 };
  return { session, route, item, step };
}

export { findSkippedStep };

/** Submit a candidate photo and judge it with the image-match service. */
export async function submitPhoto(
  ctx: AppContext,
  found: StepLookup,
  candidate: InlineImage,
  submittedBy?: string,
): Promise<HuntSession> {
  let verdict;
  if (found.item.kind === 'task') {
    verdict = await ctx.imageMatch.scoreTask(candidate, found.item.taskInstruction ?? found.item.name);
  } else {
    const references = await loadReferences(ctx, found.item);
    verdict = await ctx.imageMatch.compare(candidate, references, found.item.name);
  }
  // The candidate is stored so the attempt has a viewable photo.
  const stored = await ctx.photos.save(Buffer.from(candidate.base64, 'base64'), candidate.mimeType);
  const nextStep = recordAttempt(found.step, verdict, stored.url, now(), submittedBy);
  if (found.item.kind !== 'task') {
    await maybeFlagDifficult(ctx, found.route, nextStep);
  }
  const session = withStep(found.session, found.item.id, nextStep);
  return ctx.hunts.update(session.id, session) as Promise<HuntSession>;
}

/** Unlock the next help level, choosing map vs description by GPS proximity. */
export async function useHelp(
  ctx: AppContext,
  found: StepLookup,
  hunterLocation?: GeoPoint,
): Promise<HuntSession> {
  const proximity = proximityTo(hunterLocation, found.item.location);
  const nextStep = escalateHelp(found.step, proximity);
  const session = withStep(found.session, found.item.id, nextStep);
  return ctx.hunts.update(session.id, session) as Promise<HuntSession>;
}

/** Give up on the current item (scored 0, flagged difficult). */
export async function skip(ctx: AppContext, found: StepLookup): Promise<HuntSession> {
  const nextStep = skipStep(found.step, now());
  await maybeFlagDifficult(ctx, found.route, nextStep);
  const session = withStep(found.session, found.item.id, nextStep);
  return ctx.hunts.update(session.id, session) as Promise<HuntSession>;
}

/** Hunter overrides the AI: verify description and count the item as found. */
export async function dispute(
  ctx: AppContext,
  found: StepLookup,
  description: string,
): Promise<HuntSession | { error: string; status: number }> {
  const verification = await ctx.imageMatch.verifyDispute(description, found.item.name);
  if (!verification.match) {
    return { error: verification.reason, status: 409 };
  }
  const nextStep = disputeStep(found.step, now());
  const session = withStep(found.session, found.item.id, nextStep);
  return ctx.hunts.update(session.id, session) as Promise<HuntSession>;
}

/** Verify the optional final item answer; mark session as solved on success. */
export async function solveFinalItem(
  ctx: AppContext,
  sessionId: string,
  answer: string,
): Promise<HuntSession | { error: string; status: number }> {
  const session = await ctx.hunts.get(sessionId);
  if (!session) return { error: 'Hunt not found', status: 404 };
  const route = await ctx.routes.get(session.routeId);
  if (!route) return { error: 'Route not found', status: 404 };
  if (!route.finalItem) return { error: 'This hunt has no final item', status: 400 };
  if (session.finalItemSolved) return { error: 'Final item already solved', status: 409 };

  const finalItem = route.finalItem;
  if (finalItem.kind === 'code') {
    const norm = (s: string) => s.toLowerCase().replace(/[\s\-]/g, '');
    if (norm(answer) !== norm(finalItem.answer)) {
      return { error: 'Wrong code — try again!', status: 409 };
    }
  } else {
    const verification = await ctx.imageMatch.verifyDispute(answer, finalItem.answer);
    if (!verification.match) {
      return { error: verification.reason, status: 409 };
    }
  }

  const updated: HuntSession = { ...session, finalItemSolved: true };
  return ctx.hunts.update(session.id, updated) as Promise<HuntSession>;
}

/** Verify a riddle answer and mark found on match (no disputed flag). */
export async function solveRiddle(
  ctx: AppContext,
  found: StepLookup,
  answer: string,
): Promise<HuntSession | { error: string; status: number }> {
  const verification = await ctx.imageMatch.verifyDispute(answer, found.item.name);
  if (!verification.match) {
    return { error: verification.reason, status: 409 };
  }
  const nextStep = solveStep(found.step, now());
  const session = withStep(found.session, found.item.id, nextStep);
  return ctx.hunts.update(session.id, session) as Promise<HuntSession>;
}

/** Re-activate a skipped step with a scoring penalty. */
export async function returnSkipped(ctx: AppContext, sessionId: string, itemId: string): Promise<HuntSession | { error: string; status: number }> {
  const found = await findSkippedStep(ctx, sessionId, itemId);
  if ('error' in found) return found;
  const nextStep = returnSkippedStep(found.step, now());
  // Clear finishedAt so the hunt isn't considered complete yet.
  const session: HuntSession = {
    ...found.session,
    finishedAt: undefined,
    steps: found.session.steps.map((s) => (s.itemId === itemId ? nextStep : s)),
  };
  session.totalScore = scoreSession(session);
  return ctx.hunts.update(session.id, session) as Promise<HuntSession>;
}
