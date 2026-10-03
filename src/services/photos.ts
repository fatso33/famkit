import { fetchPhotoFromCloud, hasCloud } from './firestore';
import {
  PhotoUpload,
  dataUrlBytes,
  isEmbeddedPhoto,
  mapRecipePhotos,
  newPhotoId,
  photoRef,
} from '../utils/photoRefs';

/**
 * The recipes' photos, each kept in the cloud on its own (`photos/{id}`, see utils/photoRefs).
 * A phone fetches each photo once and keeps it in IndexedDB, so after that it shows straight
 * away, offline too. Photos on screen are fetched first; the rest are filled in when the phone
 * is idle, so the whole box works offline. Without IndexedDB they're kept in memory only, and
 * fetched again next time.
 */
const DB_NAME = 'famkit_photo_files';
const STORE = 'files';
// Fetches from the cloud at once: enough to fill a screen quickly without crowding out the rest.
const FETCHES_AT_ONCE = 4;

export type PhotoState =
  | { status: 'ready'; url: string }
  | { status: 'loading' }
  /** Not on this phone and not to be had now (offline, or gone): shown as no photo. */
  | { status: 'missing' };

interface StoredFile {
  id: string;
  bytes: ArrayBuffer;
  type: string;
}

const LOADING: PhotoState = { status: 'loading' };
const MISSING: PhotoState = { status: 'missing' };

const states = new Map<string, PhotoState>();
const blobs = new Map<string, Blob>();
const listeners = new Map<string, Set<() => void>>();
// Photos the cloud is known to have: never written again.
const committed = new Set<string>();
// Photos added here that the cloud may not have yet, by id: written with each save that uses them.
const unsent = new Map<string, Uint8Array<ArrayBuffer>>();
// A photo added here, by its data URL, so saving the same picture twice gives it one id.
const idsByDataUrl = new Map<string, string>();
const REMEMBERED_PICTURES = 32;

// --- Listening ---------------------------------------------------------------------------------

function setState(id: string, state: PhotoState) {
  states.set(id, state);
  listeners.get(id)?.forEach((listener) => listener());
}

/** The photo's state now, for useSyncExternalStore. Undefined until it's asked for. */
export function photoState(id: string): PhotoState | undefined {
  return states.get(id);
}

export function subscribePhoto(id: string, listener: () => void): () => void {
  let set = listeners.get(id);
  if (!set) listeners.set(id, (set = new Set()));
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(id);
  };
}

function ready(id: string, blob: Blob) {
  blobs.set(id, blob);
  setState(id, { status: 'ready', url: urlFor(blob, id) });
}

function urlFor(blob: Blob, id: string): string {
  if (typeof URL.createObjectURL === 'function') return URL.createObjectURL(blob);
  // No object URLs (tests): the photo's place is still marked, with nothing to draw.
  return `blob:photo-${id}`;
}

// --- IndexedDB ---------------------------------------------------------------------------------

let available = typeof indexedDB !== 'undefined';
let opened: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  opened ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => {
      const database = request.result;
      // Another tab upgrading it, or the browser closing it (iOS in the background): reopen later.
      database.onversionchange = () => {
        database.close();
        opened = null;
      };
      database.onclose = () => {
        opened = null;
      };
      resolve(database);
    };
    request.onerror = () => reject(request.error ?? new Error('IndexedDB would not open'));
  });
  opened.catch(() => {
    opened = null;
  });
  return opened;
}

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

const isStoredFile = (value: unknown): value is StoredFile => {
  const f = value as StoredFile | null;
  return typeof f?.id === 'string' && f.bytes instanceof ArrayBuffer && typeof f.type === 'string';
};

/** Reads these photos from this phone's store. Resolves to the ids it didn't have. */
async function readFiles(ids: string[]): Promise<string[]> {
  if (!available || ids.length === 0) return ids;
  try {
    const database = await openDb();
    const store = database.transaction(STORE).objectStore(STORE);
    const files = await Promise.all(ids.map((id) => done(store.get(id))));
    const missing: string[] = [];
    files.forEach((file: unknown, i) => {
      if (isStoredFile(file) && file.id === ids[i]) {
        ready(file.id, new Blob([file.bytes], { type: file.type }));
      } else {
        missing.push(ids[i]);
      }
    });
    return missing;
  } catch (e) {
    console.warn('Photos kept on this phone are unavailable; they come from the cloud:', e);
    available = false;
    return ids;
  }
}

/** Keeps a photo on this phone. Failing only means fetching it again another time. */
async function writeFile(file: StoredFile): Promise<void> {
  if (!available) return;
  try {
    const database = await openDb();
    const tx = database.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(file);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write failed'));
    });
    void keptIds?.then((kept) => kept.add(file.id));
  } catch (e) {
    console.warn('Could not keep a photo on this phone (it stays in the cloud):', e);
  }
}

/**
 * Removes from this phone's store the photos nothing here points at any more (a photo replaced,
 * a recipe's draft discarded). Never rejects.
 */
export async function forgetPhotosExcept(keep: ReadonlySet<string>): Promise<void> {
  if (!available) return;
  try {
    const database = await openDb();
    const keys = await done(database.transaction(STORE).objectStore(STORE).getAllKeys());
    const stale = keys.filter((key) => typeof key === 'string' && !keep.has(key));
    if (stale.length === 0) return;
    const tx = database.transaction(STORE, 'readwrite');
    stale.forEach((key) => tx.objectStore(STORE).delete(key));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('IndexedDB delete failed'));
    });
    void keptIds?.then((kept) => stale.forEach((key) => kept.delete(key as string)));
  } catch (e) {
    console.warn('Could not tidy the photos kept on this phone:', e);
  }
}

// --- Fetching ----------------------------------------------------------------------------------

// Waiting to be fetched from the cloud: those on screen first, then the background filling.
const soon: string[] = [];
const later: string[] = [];
const inFlight = new Set<string>();
// Not fetched for want of a connection: tried again when the phone is back online.
const offline = new Set<string>();
// Fetched (or found missing) this session: the background filling doesn't ask for it again,
// even when it couldn't be kept on this phone.
const fetched = new Set<string>();

function pump() {
  while (inFlight.size < FETCHES_AT_ONCE) {
    const id = soon.shift() ?? later.shift();
    if (!id) return;
    inFlight.add(id);
    void fetchOne(id).finally(() => {
      inFlight.delete(id);
      pump();
    });
  }
}

/** Fetches a photo and keeps it here; shown only if someone asked for it meanwhile. */
async function fetchOne(id: string) {
  const asked = () => states.get(id) === LOADING;
  try {
    const bytes = await fetchPhotoFromCloud(id);
    fetched.add(id);
    if (!bytes) {
      if (asked()) setState(id, MISSING);
      return;
    }
    committed.add(id);
    const file: StoredFile = { id, bytes: copyOf(bytes), type: 'image/jpeg' };
    if (asked()) ready(id, new Blob([file.bytes], { type: file.type }));
    await writeFile(file);
  } catch (e) {
    console.warn(`Could not fetch photo ${id} (tried again when back online):`, e);
    offline.add(id);
    if (asked()) setState(id, MISSING);
  }
}

const copyOf = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

/** Puts a photo in line to fetch, unless it's already on its way. */
function enqueue(id: string, onScreen: boolean) {
  if (inFlight.has(id)) return;
  const waiting = later.indexOf(id);
  if (waiting !== -1) {
    if (!onScreen) return;
    later.splice(waiting, 1);
  }
  if (onScreen) {
    if (!soon.includes(id)) soon.push(id);
  } else {
    later.push(id);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    const retry = [...offline];
    offline.clear();
    for (const id of retry) {
      if (states.get(id) === MISSING) {
        states.delete(id);
        if (listeners.has(id)) requestPhoto(id);
      } else if (!states.has(id)) {
        enqueue(id, false);
      }
    }
    pump();
  });
}

// --- Asking for photos -------------------------------------------------------------------------

// Asked for in this moment: read from this phone's store together.
let asked: string[] = [];

/** Starts loading a photo someone wants to see, if it isn't already: from here, else the cloud. */
export function requestPhoto(id: string): void {
  const state = states.get(id);
  if (state === LOADING) {
    // Waiting behind the background filling: it goes first now.
    if (later.includes(id)) enqueue(id, true);
    return;
  }
  if (state && (state !== MISSING || !offline.has(id))) return;
  setState(id, LOADING);
  if (asked.length === 0) queueMicrotask(() => void readAsked());
  asked.push(id);
}

async function readAsked() {
  const batch = asked;
  asked = [];
  const missing = await readFiles(batch);
  for (const id of missing) {
    if (hasCloud) enqueue(id, true);
    else setState(id, MISSING);
  }
  pump();
}

/**
 * Reads these photos from this phone's store, for the first screen to open with them. Those not
 * kept here are left for the screen to ask for, or fetched now if it already has. Never rejects.
 */
export async function readPhotosFirst(ids: readonly string[]): Promise<void> {
  const fresh = ids.filter((id) => !states.has(id));
  fresh.forEach((id) => states.set(id, LOADING));
  const missing = await readFiles(fresh);
  for (const id of missing) {
    states.delete(id);
    // Shown while this was reading (its ask found it already loading): fetch it now.
    if (listeners.has(id)) requestPhoto(id);
  }
}

// The ids this phone's store holds, once listed: filling needs only those, not the photos.
let keptIds: Promise<Set<string>> | null = null;

function listKept(): Promise<Set<string>> {
  keptIds ??= (async () => {
    if (!available) return new Set<string>();
    try {
      const database = await openDb();
      const keys = await done(database.transaction(STORE).objectStore(STORE).getAllKeys());
      return new Set(keys.filter((key): key is string => typeof key === 'string'));
    } catch (e) {
      console.warn('Could not list the photos kept on this phone:', e);
      return new Set<string>();
    }
  })();
  return keptIds;
}

/**
 * Fetches every one of these photos this phone doesn't keep yet, behind those on screen, so the
 * whole box can be opened offline. They're kept here, not held in memory. Never rejects.
 */
export async function fillPhotos(ids: Iterable<string>): Promise<void> {
  if (!hasCloud) return;
  const kept = await listKept();
  for (const id of ids) {
    if (!states.has(id) && !kept.has(id) && !offline.has(id) && !fetched.has(id)) {
      enqueue(id, false);
    }
  }
  pump();
}

/** The photo itself (for a PDF), once loaded; null when it can't be had. */
export function loadPhotoBlob(id: string): Promise<Blob | null> {
  requestPhoto(id);
  return new Promise((resolve) => {
    const check = () => {
      const state = states.get(id);
      if (state?.status === 'ready') resolve(blobs.get(id) ?? null);
      else if (state?.status === 'missing') resolve(null);
      else return false;
      return true;
    };
    if (check()) return;
    const stop = subscribePhoto(id, () => {
      if (check()) stop();
    });
  });
}

// --- Saving ------------------------------------------------------------------------------------

/**
 * The recipe (or version, or draft) as the cloud keeps it: each photo it holds itself moved out
 * to a photo of its own, pointed at with `photo:<id>`. The new photos are shown from this phone
 * at once, and kept here; `uploads` are those to write beside the recipe (none the cloud has
 * already). Without the cloud the recipe is kept whole, photos and all, as it's the only copy.
 */
export function withPhotosApart<T extends Parameters<typeof mapRecipePhotos>[0]>(
  recipe: T,
): { recipe: T; uploads: PhotoUpload[] } {
  if (!hasCloud) return { recipe, uploads: [] };
  const uploads = new Map<string, PhotoUpload>();
  const apart = mapRecipePhotos(recipe, (src) => {
    if (!isEmbeddedPhoto(src)) return src;
    let id = idsByDataUrl.get(src);
    if (!id) {
      const decoded = dataUrlBytes(src);
      if (!decoded) return src;
      id = newPhotoId();
      idsByDataUrl.set(src, id);
      // Only the latest few are remembered: enough for an editor's draft and save.
      if (idsByDataUrl.size > REMEMBERED_PICTURES) {
        idsByDataUrl.delete(idsByDataUrl.keys().next().value!);
      }
      unsent.set(id, decoded.bytes);
      const file: StoredFile = { id, bytes: decoded.bytes.buffer, type: decoded.type };
      ready(id, new Blob([file.bytes], { type: file.type }));
      void writeFile(file);
    }
    const bytes = unsent.get(id);
    if (bytes && !committed.has(id)) uploads.set(id, { id, bytes });
    return photoRef(id);
  });
  return { recipe: apart, uploads: [...uploads.values()] };
}

/** The cloud has these photos now: they're never written again. */
export function photosCommitted(uploads: readonly PhotoUpload[]): void {
  uploads.forEach((u) => {
    committed.add(u.id);
    unsent.delete(u.id);
  });
}
