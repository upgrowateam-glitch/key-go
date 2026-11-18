import { useCallback, useEffect, useState } from 'react';

const LATENCY_MS = 250;

/**
 * Every mock service goes through this, so swapping one for a real NestJS call only changes the service file.
 * Add `?simulate=error` to any portal URL to exercise the error states.
 */
export function mockRequest<T>(produce: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('simulate') === 'error') {
        reject(new Error('The KeyGo server could not be reached (simulated).'));
        return;
      }
      try {
        resolve(produce());
      } catch (e) {
        reject(e);
      }
    }, LATENCY_MS);
  });
}

export function useResource<T>(load: () => Promise<T>) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: undefined }));
    load().then(
      (data) => setState({ data, loading: false }),
      (e: Error) => setState({ error: e.message, loading: false })
    );
    // `load` is expected to be a stable, module-level service function
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(reload, [reload]);
  return { ...state, reload, setData: (data: T) => setState({ data, loading: false }) };
}
