import { PhotoEntry, PhotoSet, photoChanges } from '../utils/deviceCopy';

/**
 * This device's photos of the recipes and makes, kept in IndexedDB so the copy of the words in
 * localStorage stays small (see services/storage). Read once at launch into memory; changes are
 * written a few at a time when the phone is idle, so nothing large is ever written while the
 * family is using the app. If IndexedDB is unavailable, nothing is kept here and photos come
 * from the cloud, as they did before.
 */
const DB_NAME = 'famkit_photos';
const STORE = 'photos';
// Writes per idle moment: each copies its photos (up to a few hundred KB) on the main thread.
const WRITES_PER_TURN = 3;

// What IndexedDB holds, as far as this device knows.
const known = new Map<string, PhotoEntry>();
let loaded = false;
let available = typeof indexedDB !== 'undefined';
let loading: Promise<void> | null = null;
let opened: Promise<IDBDatabase> | null = null;
// Sets saved before the read finished, by kind: they are caught up with once it has.
const early = new Map<PhotoSet['kind'], PhotoSet>();
// Writes waiting for an idle moment: key → photos to put, or null to remove.
const pending = new Map<string, PhotoEntry | null>();
// A write under way, and the cancel for one waiting for an idle moment.
let writing = false;
let cancelIdle: (() => void) | null = null;

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function openDb(): Promise<IDBDatabase> {
  opened ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'key' });
    request.onsuccess = () => {
      const db = request.result;
      // Another tab upgrading or deleting it, or the browser closing the connection (iOS does in
      // the background): open again next time. Closing it ourselves fires no `close` event.
      db.onversionchange = () => {
        db.close();
        opened = null;
      };
      db.onclose = () => {
        opened = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error('IndexedDB would not open'));
  });
  opened.catch(() => {
    opened = null;
  });
  return opened;
}

const isEntry = (value: unknown): value is PhotoEntry => {
  const e = value as PhotoEntry | null;
  return (
    typeof e?.key === 'string' &&
    typeof e.at === 'string' &&
    typeof e.sig === 'string' &&
    typeof e.photos === 'object' &&
    e.photos !== null &&
    Object.values(e.photos).every((src) => typeof src === 'string')
  );
};

/**
 * Reads the photos kept on this device, once. Resolves when they're in memory (devicePhotos), or
 * when it turns out there are none to read. Never rejects.
 */
export function loadDevicePhotos(): Promise<void> {
  loading ??= (async () => {
    if (available) {
      try {
        const db = await openDb();
        const all = await done(db.transaction(STORE).objectStore(STORE).getAll());
        all.filter(isEntry).forEach((entry) => known.set(entry.key, entry));
      } catch (e) {
        console.warn('Photos kept on this device are unavailable; they come from the cloud:', e);
        available = false;
        known.clear();
      }
    }
    loaded = true;
    early.forEach(catchUp);
    early.clear();
  })();
  return loading;
}

/** Calls `listener` once the photos kept on this device are read. Returns a cancel function. */
export function whenDevicePhotosLoad(listener: () => void): () => void {
  let active = true;
  void loadDevicePhotos().then(() => {
    if (active) listener();
  });
  return () => {
    active = false;
  };
}

/** The photos kept on this device under `key`, once they are read. */
export function devicePhotos(key: string): PhotoEntry | undefined {
  return known.get(key);
}

/** Keeps exactly `set`'s photos of its kind on this device, writing only what changed. */
export function keepDevicePhotos(set: PhotoSet): void {
  if (!available) return;
  if (!loaded) {
    early.set(set.kind, set);
    void loadDevicePhotos();
    return;
  }
  catchUp(set);
}

function catchUp(set: PhotoSet) {
  if (!available) return;
  const { put, remove } = photoChanges(known, set);
  for (const entry of put) {
    known.set(entry.key, entry);
    pending.set(entry.key, entry);
  }
  for (const key of remove) {
    known.delete(key);
    pending.set(key, null);
  }
  if (pending.size > 0) scheduleFlush();
}

function scheduleFlush() {
  if (writing || cancelIdle) return;
  const run = () => {
    cancelIdle = null;
    void flush(WRITES_PER_TURN);
  };
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(run, { timeout: 2000 });
    cancelIdle = () => cancelIdleCallback(id);
  } else {
    // Safari has no idle callback.
    const id = setTimeout(run, 200);
    cancelIdle = () => clearTimeout(id);
  }
}

/** Writes up to `limit` waiting changes in one transaction, then waits for the next idle moment. */
async function flush(limit: number): Promise<void> {
  writing = true;
  const batch = [...pending].slice(0, limit);
  batch.forEach(([key]) => pending.delete(key));
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const [key, entry] of batch) {
      if (entry) store.put(entry);
      else store.delete(key);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write failed'));
    });
  } catch (e) {
    console.warn('Could not keep photos on this device (they stay in the cloud):', e);
    // Not written: forget them, so the next save tries again. Until then the words' copy
    // simply waits for the cloud's photos at launch.
    for (const [key, entry] of batch) {
      if (entry && known.get(key) === entry) known.delete(key);
    }
  }
  writing = false;
  if (pending.size === 0) return;
  if (document.visibilityState === 'hidden') void flush(pending.size);
  else scheduleFlush();
}

// Leaving the app (switching away, locking the phone): write everything waiting now, without
// waiting for the idle moment, since the app may not get one before it's closed. A write already
// under way carries on with the rest when it's done.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && pending.size > 0 && !writing) {
      cancelIdle?.();
      cancelIdle = null;
      void flush(pending.size);
    }
  });
}
