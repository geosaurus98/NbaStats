import { useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data?: T;
  error?: Error;
  loading: boolean;
}

/**
 * Runs `fn` whenever `deps` change. If `refreshMs(data)` returns a number, the
 * request is repeated on that interval (used to poll live games); `fn`
 * receives `fresh = true` on those polls so the cache is bypassed.
 */
export function useAsync<T>(
  fn: (fresh: boolean) => Promise<T>,
  deps: unknown[],
  refreshMs?: (data: T) => number | undefined,
): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ loading: true });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const refreshRef = useRef(refreshMs);
  refreshRef.current = refreshMs;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setState({ loading: true });

    const run = (fresh: boolean) => {
      fnRef.current(fresh).then(
        (data) => {
          if (cancelled) return;
          setState({ data, loading: false });
          const ms = refreshRef.current?.(data);
          if (ms) timer = setTimeout(() => run(true), ms);
        },
        (error: Error) => {
          if (!cancelled) setState((s) => ({ data: s.data, error, loading: false }));
        },
      );
    };
    run(false);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
