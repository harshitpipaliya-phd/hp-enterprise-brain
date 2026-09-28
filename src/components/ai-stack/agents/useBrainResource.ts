import { useCallback, useEffect, useState } from 'react';

/**
 * Load-once-per-key fetch with an explicit refresh, shared by every Agent
 * Management screen so they report failure the same way.
 *
 * Errors are surfaced, never swallowed into an empty result: a screen showing
 * "no rows" when the request actually 404'd is the failure mode this whole
 * integration was brought in to remove.
 *
 * HP BRAIN PORT: G2G's copy carried LMS_K12's academic-year key as an empty
 * string. HP Brain has no academic year at all, so it is gone rather than kept
 * as a constant; the key is the caller's deps alone. The organisation is scoped
 * by the bearer token on the backend, never by this key.
 */
export function useBrainResource<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // The dependency list is the caller's, so it cannot be an array literal here;
  // that is the whole point of a shared loader hook.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);

  const fetchNow = useCallback(
    async (isRefresh: boolean) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        // A non-refresh load means the KEY changed — a different module filter —
        // so what is held is an answer to a question nobody is asking any more.
        // Dropping it makes the screen say "loading" rather than show another
        // module's rows under this module's heading. An explicit refresh keeps
        // its data, which is what makes it a refresh.
        setData(null);
        setLoading(true);
      }
      setError('');
      try {
        setData(await run());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'The HP Brain request failed.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [run],
  );

  // Fetching on mount is exactly the "subscribe to an external system" case;
  // the setState calls are the loading flag and the resolved payload, which is
  // what a data hook is for.
  useEffect(() => {
    void fetchNow(false);
  }, [fetchNow]);

  return {
    data,
    error,
    loading,
    refreshing,
    refresh: () => void fetchNow(true),
    setData,
  };
}
