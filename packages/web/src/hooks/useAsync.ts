import { useCallback, useEffect, useState } from 'react';

interface AsyncState<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
  /** Re-run the loader. */
  reload: () => void;
}

/**
 * Run an async loader on mount (and on dependency change), tracking
 * loading/error/data. Keeps screens free of repetitive try/catch wiring.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    run()
      .then((result) => !cancelled && setData(result))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Something went wrong'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [run]);

  useEffect(reload, [reload]);

  return { data, error, loading, reload };
}
