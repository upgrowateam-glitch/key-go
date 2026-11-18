import { useCallback, useEffect, useState } from 'react';

/**
 * Wraps a value or a synchronous read of server-backed data in a promise, so screens can load it with
 * useResource the same way as data fetched over the network.
 */
export function mockRequest<T>(produce: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      resolve(produce());
    } catch (e) {
      reject(e);
    }
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
