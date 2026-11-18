import { useCallback, useRef, useState } from 'react';

type Updater<T> = T[] | ((prev: T[]) => T[]);

interface SyncOptions<T> {
  /** Identity of a record. */
  keyOf: (item: T) => string;
  /** Writes one added or changed record to the server. */
  save: (item: T) => Promise<unknown>;
  /** Deletes one record on the server; lists without it never remove records. */
  remove?: (key: string) => Promise<unknown>;
  /** Shown when the server refuses a change; the change is undone on screen. */
  onError: (message: string) => void;
}

/**
 * State for a list of records that lives on the server.
 *
 * Use it like useState: the setter takes a new list or an updater. After each update it compares the new
 * list with the previous one, saves every record that was added or replaced, and deletes removed ones.
 * Saves for the same record run one after another, so the server always ends with the latest version.
 * If the server refuses a change (for example a double booking), that record goes back to how it was.
 *
 * The returned ref always holds the latest list, including changes made earlier in the same event handler.
 */
export function useSyncedList<T>(initial: T[], options: SyncOptions<T>) {
  const [items, setItems] = useState<T[]>(initial);
  const ref = useRef(items);
  const queues = useRef(new Map<string, Promise<unknown>>());
  const opts = useRef(options);
  opts.current = options;

  const setLocal = useCallback((next: T[]) => {
    ref.current = next;
    setItems(next);
  }, []);

  const enqueue = useCallback((key: string, task: () => Promise<unknown>) => {
    const previous = queues.current.get(key) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(task);
    queues.current.set(key, next);
    next.finally(() => {
      if (queues.current.get(key) === next) queues.current.delete(key);
    });
    return next;
  }, []);

  const set = useCallback(
    (update: Updater<T>) => {
      const { keyOf } = opts.current;
      const prev = ref.current;
      const next = typeof update === 'function' ? (update as (p: T[]) => T[])(prev) : update;
      if (next === prev) return;
      setLocal(next);

      const before = new Map(prev.map((x) => [keyOf(x), x]));
      const after = new Map(next.map((x) => [keyOf(x), x]));

      after.forEach((item, key) => {
        const old = before.get(key);
        if (old === item) return;
        enqueue(key, () => opts.current.save(item)).catch((e: Error) => {
          // Put back the version the server still has (or drop a record it never accepted)
          const current = ref.current;
          setLocal(old === undefined ? current.filter((x) => keyOf(x) !== key) : current.map((x) => (keyOf(x) === key ? old : x)));
          opts.current.onError(e.message);
        });
      });

      before.forEach((item, key) => {
        if (after.has(key) || !opts.current.remove) return;
        enqueue(key, () => opts.current.remove!(key)).catch((e: Error) => {
          setLocal([item, ...ref.current]);
          opts.current.onError(e.message);
        });
      });
    },
    [enqueue, setLocal]
  );

  return [items, set, ref] as const;
}
