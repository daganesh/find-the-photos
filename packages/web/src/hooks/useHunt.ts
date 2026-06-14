import { useCallback, useEffect, useState } from 'react';
import type { HuntSession, MatchVerdict, StepProgress } from '@ftp/shared';
import { api } from '../services/apiClient.js';
import { getCurrentLocation } from '../services/geolocation.js';

interface HuntController {
  session: HuntSession | undefined;
  /** The step currently being played, if any. */
  activeStep: StepProgress | undefined;
  loading: boolean;
  busy: boolean;
  error: string | undefined;
  /** Verdict from the most recent photo attempt (cleared on next action). */
  lastVerdict: MatchVerdict | undefined;
  submitPhoto: (photo: Blob) => Promise<void>;
  useHelp: () => Promise<void>;
  skip: () => Promise<void>;
  dispute: () => Promise<void>;
}

/** Owns a single play-through: starts the session and applies each action. */
export function useHunt(routeId: string): HuntController {
  const [session, setSession] = useState<HuntSession>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [lastVerdict, setLastVerdict] = useState<MatchVerdict>();

  useEffect(() => {
    let cancelled = false;
    api
      .startHunt(routeId)
      .then((r) => !cancelled && setSession(r.session))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Could not start'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [routeId]);

  const activeStep = session?.steps.find((s) => s.status === 'active');

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

  const dispute = useCallback(async () => {
    setLastVerdict(undefined);
    await run((itemId) => api.disputeStep(session!.id, itemId));
  }, [run, session]);

  return { session, activeStep, loading, busy, error, lastVerdict, submitPhoto, useHelp, skip, dispute };
}
