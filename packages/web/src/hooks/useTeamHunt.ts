import { useCallback, useEffect, useRef, useState } from 'react';
import type { HuntSession, MatchVerdict, Team } from '@ftp/shared';
import { api } from '../services/apiClient.js';
import { getCurrentLocation } from '../services/geolocation.js';

const POLL_MS = 3000;

interface TeamHuntController {
  session: HuntSession | undefined;
  team: Team | undefined;
  busy: boolean;
  error: string | undefined;
  /** Verdict from the most recent photo attempt for a specific item. */
  lastVerdict: { itemId: string; verdict: MatchVerdict } | undefined;
  submitPhoto: (itemId: string, photo: Blob) => Promise<void>;
  submitRiddleAnswer: (itemId: string, answer: string) => Promise<void>;
  useHelp: (itemId: string) => Promise<void>;
  skip: (itemId: string) => Promise<void>;
  dispute: (itemId: string, description: string) => Promise<void>;
  returnToSkipped: (itemId: string) => Promise<void>;
  pauseOrResume: () => Promise<void>;
}

/** Manages a shared team hunt session: polls for updates and exposes actions. */
export function useTeamHunt(teamId: string, sessionId: string): TeamHuntController {
  const [session, setSession] = useState<HuntSession>();
  const [team, setTeam] = useState<Team>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [lastVerdict, setLastVerdict] = useState<{ itemId: string; verdict: MatchVerdict }>();
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;

    async function poll() {
      try {
        const [{ session: s }, t] = await Promise.all([
          api.getHunt(sessionId),
          api.getTeam(teamId),
        ]);
        if (!cancelRef.current) {
          setSession(s);
          setTeam(t);
        }
      } catch { /* network hiccup — keep polling */ }
      if (!cancelRef.current) timerRef.current = setTimeout(poll, POLL_MS);
    }

    poll();
    return () => {
      cancelRef.current = true;
      clearTimeout(timerRef.current);
    };
  }, [teamId, sessionId]);

  const run = useCallback(
    async (itemId: string, action: () => Promise<{ session: HuntSession }>) => {
      setBusy(true);
      setError(undefined);
      try {
        const { session: s } = await action();
        if (!cancelRef.current) setSession(s);
      } catch (e) {
        if (!cancelRef.current) setError(e instanceof Error ? e.message : 'Something went wrong');
      } finally {
        if (!cancelRef.current) setBusy(false);
      }
    },
    [],
  );

  const submitPhoto = useCallback(async (itemId: string, photo: Blob) => {
    setBusy(true);
    setError(undefined);
    setLastVerdict(undefined);
    try {
      const res = await api.submitHuntPhoto(sessionId, itemId, photo);
      if (!cancelRef.current) {
        setSession(res.session);
        setLastVerdict({ itemId, verdict: res.verdict });
      }
    } catch (e) {
      if (!cancelRef.current) setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      if (!cancelRef.current) setBusy(false);
    }
  }, [sessionId]);

  const submitRiddleAnswer = useCallback(async (itemId: string, answer: string) => {
    await run(itemId, () => api.solveRiddle(sessionId, itemId, answer));
  }, [sessionId, run]);

  const useHelp = useCallback(async (itemId: string) => {
    const location = await getCurrentLocation().catch(() => undefined);
    await run(itemId, () => api.useHelp(sessionId, itemId, location));
  }, [sessionId, run]);

  const skip = useCallback(async (itemId: string) => {
    await run(itemId, () => api.skipStep(sessionId, itemId));
  }, [sessionId, run]);

  const dispute = useCallback(async (itemId: string, description: string) => {
    await run(itemId, () => api.disputeStep(sessionId, itemId, description));
  }, [sessionId, run]);

  const returnToSkipped = useCallback(async (itemId: string) => {
    await run(itemId, () => api.returnToSkipped(sessionId, itemId));
  }, [sessionId, run]);

  const pauseOrResume = useCallback(async () => {
    setError(undefined);
    try {
      const t = await api.pauseOrResumeTeam(teamId);
      if (!cancelRef.current) setTeam(t);
    } catch (e) {
      if (!cancelRef.current) setError(e instanceof Error ? e.message : 'Could not pause');
    }
  }, [teamId]);

  return { session, team, busy, error, lastVerdict, submitPhoto, submitRiddleAnswer, useHelp, skip, dispute, returnToSkipped, pauseOrResume };
}
