/**
 * Browser-side file storage (IndexedDB) for documents uploaded in the portal.
 *
 * Stands in for the KeyGo server's object storage until the backend exists: files stay on this
 * device and browser profile only. Metadata about each file lives with the record that owns it
 * (for example `VehicleDocument.file`); only the bytes are kept here, keyed by that record's key.
 */

const DB_NAME = 'keygo-admin';
const STORE = 'files';
const VERSION = 1;

export const fileStoreAvailable = () => typeof indexedDB !== 'undefined';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!fileStoreAvailable()) {
      reject(new Error('File storage is not available in this browser'));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open file storage'));
  });
}

function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = op(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('File storage request failed'));
        tx.oncomplete = () => db.close();
        tx.onabort = () => {
          db.close();
          reject(tx.error ?? new Error('File storage transaction aborted'));
        };
      })
  );
}

export const putFile = (key: string, file: Blob) => run('readwrite', (s) => s.put(file, key)).then(() => undefined);
export const getFile = (key: string) => run<Blob | undefined>('readonly', (s) => s.get(key));
export const deleteFile = (key: string) => run('readwrite', (s) => s.delete(key)).then(() => undefined);

/** Opens a stored file in a new tab (PDFs and images render inline). */
export async function openStoredFile(key: string): Promise<boolean> {
  const blob = await getFile(key);
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener');
  // Give the new tab time to load before the URL is released.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return win !== null;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
