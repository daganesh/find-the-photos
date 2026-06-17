import { useCallback, useEffect, useRef, useState } from 'react';
import type { HuntSession, MatchVerdict, StepProgress } from '@ftp/shared';
import { api } from '../services/apiClient.js';
import { getCurrentLocation } from '../services/geolocation.js';

interface HuntController {
  session: HuntSession | undefined;
  /** The step currently being played, if any. */
  activeStep: StepProgress | undefined;
  loading: boolean;
  /** True while we are waiting for the player to click Start. */
  notStarted: boolean;
  busy: boolean;
  paused: boolean;
  error: string | undefined;
  /** Verdict from the most recent photo attempt (cleared on next action). */
  lastVerdict: MatchVerdict | undefined;
  /** Start the hunt (called when player clicks Start). */
  start: () => Promise<void>;
  submitPhoto: (photo: Blob) => Promise<void>;
  useHelp: () => Promise<void>;
  skip: () => Promise<void>;
  dispute: (description: string) => Promise<void>;
  submitRiddleAnswer: (answer: string) => Promise<void>;
  returnToSkipped: (itemId: string) => Promise<void>;
  pause: () => void;
  resume: () => void;
}

/** Owns a single play-through: waits for Start, then applies each action. */
export function useHunt(routeId: string): HuntController {
  const [session, setSession] = useState<HuntSession>();
  const [notStarted, setNotStarted] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string>();
  const [lastVerdict, setLastVerdict] = useState<MatchVerdict>();
  const cancelRef = useRef(false);

  // Cleanup on unmount.
  useEffect(() => () => { cancelRef.current = true; }, []);

  const activeStep = session?.steps.find((s) => s.status === 'active');

  /** Begin the hunt: create the session on the server (sets startedAt). */
  const start = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const location = await getCurrentLocation().catch(() => undefined);
      const { session: s } = await api.startHunt(routeId, location);
      if (!cancelRef.current) {
        setSession(s);
        setNotStarted(false);
      }
    } catch (e) {
      if (!cancelRef.current)
        setError(e instanceof Error ? e.message : 'Could not start the hunt');
    } finally {
      if (!cancelRef.current) setLoading(false);
    }
  }, [routeId]);

  /** Wrap an action: manage busy/error and apply the returned session. */
  const run = useCallback(
    async (action: (itemId: string) => Promise<{ session: HuntSession }>) => {
      if (!session || !activeStep) return;
      setBusy(true);
      setError(undefined);
      try {
        const { session: next } = await action(activeStep.itemId);
        setSession(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      } finally {
        setBusy(false);
      }
    },
    [session, activeStep],
  );

  const submitPhoto = useCallback(
    async (photo: Blob) => {
      if (!session || !activeStep) return;
      setBusy(true);
      setError(undefined);
      setLastVerdict(undefined);
      try {
        const res = await api.submitHuntPhoto(session.id, activeStep.itemId, photo);
        setSession(res.session);
        setLastVerdict(res.verdict);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setBusy(false);
      }
    },
    [session, activeStep],
  );

  const useHelp = useCallback(async () => {
    setLastVerdict(undefined);
    const location = await getCurrentLocation();
    await run((itemId) => api.useHelp(session!.id, itemId, location));
  }, [run, session]);

  const skip = useCallback(async () => {
    setLastVerdict(undefined);
    await run((itemId) => api.skipStep(session!.id, itemId));
  }, [run, session]);

  const dispute = useCallback(async (description: string) => {
    if (!session || !activeStep) return;
    setLastVerdict(undefined);
    setBusy(true);
    setError(undefined);
    try {
      const { session: next } = await api.disputeStep(session.id, activeStep.itemId, description);
      if (!cancelRef.current) setSession(next);
    } catch (e) {
      if (!cancelRef.current) setBusy(false);
      throw e;
    }
    if (!cancelRef.current) setBusy(false);
  }, [session, activeStep]);

  const submitRiddleAnswer = useCallback(async (answer: string) => {
    if (!session || !activeStep) return;
    setBusy(true);
    setError(undefined);
    try {
      const { session: next } = await api.solveRiddle(session.id, activeStep.itemId, answer);
      if (!cancelRef.current) setSession(next);
    } catch (e) {
      if (!cancelRef.current) setBusy(false);
      throw e;
    }
    if (!cancelRef.current) setBusy(false);
  }, [session, activeStep]);

  const returnToSkipped = useCallback(async (itemId: string) => {
    if (!session) return;
    setBusy(true);
    setError(undefined);
    try {
      const { session: next } = await api.returnToSkipped(session.id, itemId);
      setSession(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not return to item');
    } finally {
      setBusy(false);
    }
  }, [session]);

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => setPaused(false), []);

  return {
    session, activeStep, loading, notStarted, busy, paused, error, lastVerdict,
    start, submitPhoto, useHelp, skip, dispute, submitRiddleAnswer, returnToSkipped, pause, resume,
  };
}
