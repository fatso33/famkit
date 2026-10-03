import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchFamilyMembership,
  fetchPhotoFromCloud,
  fetchRecipeVersion,
  movePhotosOutInCloud,
  saveRecipeToCloud,
  saveTranslationToCloud,
  subscribeToRecipes,
} from '../services/firestore';
import { Recipe, RecipeVersion } from '../types/recipe';
import { sourceHash } from '../utils/recipeTranslation';

vi.mock('../services/firebase', () => ({ isFirebaseConfigured: true, db: {} }));

// A stand-in for Firestore that behaves like the real thing where it matters here: a query
// ordered by a field leaves out every document that doesn't have that field.
const cloud = vi.hoisted(() => ({
  docs: [] as Recipe[],
  /** Whether snapshots come from the device's offline cache rather than the server. */
  fromCache: false,
  listeners: [] as { orderField?: string; next: (snap: unknown) => void }[],
  /** Documents stored by path, e.g. "recipes/babka/versions/v1-1000". */
  stored: {} as Record<string, unknown>,
  /** Every batch write: [path, data, options]. */
  writes: [] as [string, unknown, unknown][],
  /** How many batches were committed. */
  commits: 0,
  /** Offline: commits wait (in `queued`) until released. */
  holdCommits: false,
  queued: [] as [string, unknown, unknown][][],
  release: () => {},
  /** When set, getDoc fails with this Firestore error code (e.g. offline: 'unavailable'). */
  getDocErrorCode: null as string | null,
}));

vi.mock('firebase/firestore', () => {
  const snapshotFor = (orderField?: string) => {
    const docs = orderField
      ? cloud.docs.filter((d) => (d as unknown as Record<string, unknown>)[orderField] != null)
      : cloud.docs;
    const snaps = docs.map((d) => ({ data: () => d }));
    return {
      empty: docs.length === 0,
      metadata: { fromCache: cloud.fromCache },
      forEach: (fn: (d: { data: () => Recipe }) => void) => snaps.forEach(fn),
    };
  };
  // Firestore's bytes: a photo's JPEG.
  class Bytes {
    constructor(readonly bytes: Uint8Array) {}
    static fromUint8Array(bytes: Uint8Array) {
      return new Bytes(bytes);
    }
    toUint8Array() {
      return this.bytes;
    }
  }
  return {
    Bytes,
    collection: () => ({}),
    // Paths only: enough to see where each document goes.
    doc: (parent: { path?: string }, ...segments: string[]) => ({
      path: [...(parent.path ? [parent.path] : []), ...segments].join('/'),
    }),
    writeBatch: () => {
      const pending: [string, unknown, unknown][] = [];
      return {
        set: (ref: { path: string }, data: unknown, options?: unknown) =>
          pending.push([ref.path, data, options]),
        commit: () => {
          if (cloud.holdCommits) {
            cloud.queued.push(pending);
            return new Promise<void>((resolve) => {
              const before = cloud.release;
              cloud.release = () => {
                before();
                cloud.writes.push(...pending);
                cloud.commits++;
                resolve();
              };
            });
          }
          cloud.writes.push(...pending);
          cloud.commits++;
          return Promise.resolve();
        },
      };
    },
    getDoc: (ref: { path: string }) =>
      cloud.getDocErrorCode
        ? Promise.reject(
            Object.assign(new Error('Firestore failed'), { code: cloud.getDocErrorCode }),
          )
        : Promise.resolve({
            exists: () => ref.path in cloud.stored,
            data: () => cloud.stored[ref.path],
            get: (field: string) => (cloud.stored[ref.path] as Record<string, unknown>)[field],
          }),
    orderBy: (field: string) => ({ orderField: field }),
    query: (_col: unknown, ...constraints: { orderField?: string }[]) => ({
      orderField: constraints.find((c) => c.orderField)?.orderField,
    }),
    onSnapshot: (q: { orderField?: string }, next: (snap: unknown) => void) => {
      const listener = { orderField: q.orderField, next };
      cloud.listeners.push(listener);
      next(snapshotFor(q.orderField));
      return () => {};
    },
    runTransaction: (_db: unknown, run: (tx: unknown) => Promise<unknown>) =>
      run({
        get: (ref: { path: string }) =>
          Promise.resolve({
            exists: () => ref.path in cloud.stored,
            data: () => cloud.stored[ref.path],
          }),
        update: (ref: { path: string }, data: unknown) =>
          cloud.writes.push([ref.path, data, 'update']),
        set: (ref: { path: string }, data: unknown) => cloud.writes.push([ref.path, data, 'tx']),
      }),
    setDoc: () => Promise.resolve(),
    updateDoc: () => Promise.resolve(),
    deleteDoc: () => Promise.resolve(),
    deleteField: () => ({}),
    // Pushes the current cloud contents to every listener, like a remote change would.
    __emit: () => cloud.listeners.forEach((l) => l.next(snapshotFor(l.orderField))),
  };
});

const recipe = (id: string, createdAt?: number): Recipe => ({
  id,
  name: id,
  author: 'Peter',
  category: 'family',
  heroImage: '',
  yieldHeader: 'For 1 batch:',
  ingredients: [{ text: 'Flour - 2 cups' }],
  steps: [{ num: 1, text: 'Mix.' }],
  ...(createdAt !== undefined && { createdAt }),
});

describe('subscribeToRecipes', () => {
  beforeEach(() => {
    localStorage.clear();
    cloud.docs = [];
    cloud.fromCache = false;
    cloud.listeners = [];
  });

  it('keeps recipes saved without a createdAt after another recipe is added', async () => {
    // An early recipe was saved before createdAt existed on every record.
    cloud.docs = [recipe('early-recipe')];
    const updates: Recipe[][] = [];
    subscribeToRecipes((r) => updates.push(r));

    cloud.docs = [...cloud.docs, recipe('new-recipe', 2000)];
    const firestore = (await import('firebase/firestore')) as unknown as { __emit: () => void };
    firestore.__emit();

    const latest = updates[updates.length - 1].map((r) => r.id);
    expect(latest).toContain('early-recipe');
    expect(latest).toContain('new-recipe');
  });

  it('lists recipes newest first, with undated ones last', () => {
    cloud.docs = [recipe('undated'), recipe('older', 1000), recipe('newer', 3000)];
    const updates: Recipe[][] = [];
    subscribeToRecipes((r) => updates.push(r));

    const ids = updates[updates.length - 1].map((r) => r.id);
    expect(ids.indexOf('newer')).toBeLessThan(ids.indexOf('older'));
    expect(ids.indexOf('older')).toBeLessThan(ids.indexOf('undated'));
  });

  it("keeps showing this phone's recipes when the offline cache is still empty", () => {
    localStorage.setItem('wandas_recipes', JSON.stringify([recipe('saved-here', 1000)]));
    cloud.fromCache = true;
    const updates: Recipe[][] = [];
    subscribeToRecipes((r) => updates.push(r));

    expect(updates[updates.length - 1].map((r) => r.id)).toEqual(['saved-here']);
    expect(JSON.parse(localStorage.getItem('wandas_recipes')!)).toHaveLength(1);
  });

  it('shows an empty vault when the server really has no recipes', () => {
    localStorage.setItem('wandas_recipes', JSON.stringify([recipe('deleted-elsewhere', 1000)]));
    const updates: Recipe[][] = [];
    subscribeToRecipes((r) => updates.push(r));

    expect(updates[updates.length - 1]).toEqual([]);
  });
});

describe('saving versions', () => {
  const babka = { ...recipe('babka', 1000), version: 2 };
  const v1: RecipeVersion = {
    id: 'v1-1000',
    version: 1,
    savedAt: 1000,
    hasPhotos: true,
    recipe: { ...babka, name: 'Old Babka', version: 1 },
  };

  beforeEach(() => {
    localStorage.clear();
    cloud.writes = [];
    cloud.commits = 0;
    cloud.queued = [];
    cloud.release = () => {};
    cloud.stored = {};
  });

  it('writes the recipe whole, with the version it replaces, in one batch', async () => {
    await saveRecipeToCloud(babka, [v1]);

    expect(cloud.writes).toEqual([
      // No merge: a field cleared in the editor (e.g. a removed tip) must be cleared in the cloud.
      ['recipes/babka', babka, undefined],
      ['recipes/babka/versions/v1-1000', v1, undefined],
    ]);
  });

  it('queues every write of a big save at once, so an offline save is kept whole', async () => {
    const big = (n: number) => ({ id: String(n).repeat(32), bytes: new Uint8Array(4_000_000) });
    cloud.holdCommits = true;
    const saving = saveRecipeToCloud(babka, [], [big(5), big(6), big(7)]);
    await Promise.resolve();
    // Offline: no commit has settled, yet the recipe's write is already handed over.
    expect(cloud.queued.flat().map(([path]) => path)).toContain('recipes/babka');
    cloud.holdCommits = false;
    cloud.release();
    await saving;
  });

  it('writes its new photos, each a document of its own, in the same batch', async () => {
    const photo = { id: 'a'.repeat(32), bytes: new Uint8Array([0xff, 0xd8, 1]) };
    const withPhoto = { ...babka, heroImage: `photo:${photo.id}` };
    await saveRecipeToCloud(withPhoto, [v1], [photo]);

    expect(cloud.commits).toBe(1);
    expect(cloud.writes.map(([path]) => path)).toEqual([
      `photos/${photo.id}`,
      'recipes/babka',
      'recipes/babka/versions/v1-1000',
    ]);
    const [, data] = cloud.writes[0] as unknown as [
      string,
      { jpeg: { toUint8Array(): Uint8Array } },
    ];
    expect(Object.keys(data)).toEqual(['jpeg']);
    expect([...data.jpeg.toUint8Array()]).toEqual([0xff, 0xd8, 1]);
  });

  it('sends very many new photos ahead in writes of their own, the recipe with the last', async () => {
    const big = (n: number) => ({ id: String(n).repeat(32), bytes: new Uint8Array(2_500_000) });
    await saveRecipeToCloud(babka, [], [big(1), big(2), big(3), big(4)]);

    // 6 MB a write at most: two photos, then two more with the recipe.
    expect(cloud.commits).toBe(2);
    // Handed over at once, in order (offline, all wait in the cloud's queue together).
    expect(cloud.writes.map(([path]) => path)).toEqual([
      `photos/${'1'.repeat(32)}`,
      `photos/${'2'.repeat(32)}`,
      `photos/${'3'.repeat(32)}`,
      `photos/${'4'.repeat(32)}`,
      'recipes/babka',
    ]);
  });

  it("refuses to save this device's copy of a recipe whose photos were left out", async () => {
    const slim: Recipe = { ...babka, photosOmitted: { hero: true } };
    localStorage.setItem('wandas_recipes', JSON.stringify([babka]));

    await expect(saveRecipeToCloud(slim)).rejects.toThrow(/photos/);
    await expect(saveRecipeToCloud(babka, [{ ...v1, recipe: slim }])).rejects.toThrow(/photos/);
    expect(cloud.writes).toEqual([]);
    expect(JSON.parse(localStorage.getItem('wandas_recipes')!)).toEqual([babka]);
  });

  it("moves an older recipe's photos out without a new version, if it's still the same", async () => {
    const moved = { ...babka, updatedAt: 5, heroImage: `photo:${'b'.repeat(32)}` };
    const photo = { id: 'b'.repeat(32), bytes: new Uint8Array([1]) };

    // Edited on another phone meanwhile: left for next time.
    cloud.stored['recipes/babka'] = { ...babka, updatedAt: 6 };
    await expect(movePhotosOutInCloud(moved, [photo])).resolves.toBe(false);
    expect(cloud.writes).toEqual([]);

    cloud.stored['recipes/babka'] = { ...babka, updatedAt: 5 };
    await expect(movePhotosOutInCloud(moved, [photo])).resolves.toBe(true);
    expect(cloud.writes.map(([path, , how]) => [path, how])).toEqual([
      [`photos/${'b'.repeat(32)}`, 'tx'],
      ['recipes/babka', 'update'],
    ]);
    // Only the photo fields: the version, the time and the words stay as they were.
    expect(Object.keys(cloud.writes[1][1] as object)).toEqual(['heroImage', 'steps']);
  });

  it('fetches a photo, and finds none where there is none or it holds no bytes', async () => {
    const { Bytes } = await import('firebase/firestore');
    cloud.stored[`photos/${'c'.repeat(32)}`] = { jpeg: Bytes.fromUint8Array(new Uint8Array([7])) };
    cloud.stored[`photos/${'d'.repeat(32)}`] = { jpeg: 'not bytes' };

    await expect(fetchPhotoFromCloud('c'.repeat(32))).resolves.toEqual(new Uint8Array([7]));
    await expect(fetchPhotoFromCloud('d'.repeat(32))).resolves.toBeNull();
    await expect(fetchPhotoFromCloud('e'.repeat(32))).resolves.toBeNull();
  });

  it('loads one version, and refuses a missing or malformed one', async () => {
    cloud.stored['recipes/babka/versions/v1-1000'] = v1;
    cloud.stored['recipes/babka/versions/broken'] = { ...v1, id: 'broken', recipe: 'nope' };

    await expect(fetchRecipeVersion('babka', 'v1-1000')).resolves.toMatchObject({
      version: 1,
      recipe: { name: 'Old Babka' },
    });
    await expect(fetchRecipeVersion('babka', 'broken')).rejects.toThrow(/malformed/);
    await expect(fetchRecipeVersion('babka', 'v9-9')).rejects.toThrow(/missing/);
  });
});

describe('saving translations', () => {
  const babka = recipe('babka', 1000);
  const polish = { name: 'Babka', sourceHash: sourceHash(babka) };

  beforeEach(() => {
    cloud.writes = [];
    cloud.stored = { 'recipes/babka': babka };
  });

  it('writes only the translation fields while the cloud text is what was translated', async () => {
    await expect(saveTranslationToCloud('babka', 'en', polish)).resolves.toBe(true);
    expect(cloud.writes).toHaveLength(1);
    expect(cloud.writes[0][0]).toBe('recipes/babka');
    expect(Object.keys(cloud.writes[0][1] as object).sort()).toEqual([
      'sourceLanguage',
      'translations.en',
      'translations.pl',
    ]);
  });

  it('writes nothing once the cloud text has changed, or the recipe is gone', async () => {
    cloud.stored['recipes/babka'] = { ...babka, name: 'Chocolate Babka' };
    await expect(saveTranslationToCloud('babka', 'en', polish)).resolves.toBe(false);
    delete cloud.stored['recipes/babka'];
    await expect(saveTranslationToCloud('babka', 'en', polish)).resolves.toBe(false);
    expect(cloud.writes).toEqual([]);
  });
});

describe('fetchFamilyMembership', () => {
  beforeEach(() => {
    cloud.stored = {};
    cloud.getDocErrorCode = null;
  });

  it('finds a family member by their lowercase email, whatever case they signed in with', async () => {
    cloud.stored['family_members/mom@example.com'] = {};
    await expect(fetchFamilyMembership(' Mom@Example.com ')).resolves.toEqual({
      isMember: true,
      name: null,
    });
  });

  it('reads the name the family list gives someone, ignoring anything unusable', async () => {
    cloud.stored['family_members/k@example.com'] = { name: '  Babcia ' };
    await expect(fetchFamilyMembership('k@example.com')).resolves.toEqual({
      isMember: true,
      name: 'Babcia',
    });

    cloud.stored['family_members/k@example.com'] = { name: ['<b>Babcia</b>'] };
    await expect(fetchFamilyMembership('k@example.com')).resolves.toEqual({
      isMember: true,
      name: null,
    });
  });

  it('says no for an email not on the list', async () => {
    await expect(fetchFamilyMembership('stranger@example.com')).resolves.toEqual({
      isMember: false,
      name: null,
    });
  });

  it('says no when the rules refuse the lookup (an unverified email)', async () => {
    cloud.getDocErrorCode = 'permission-denied';
    await expect(fetchFamilyMembership('mom@example.com')).resolves.toEqual({
      isMember: false,
      name: null,
    });
  });

  it("fails rather than answering no when the list can't be reached", async () => {
    cloud.getDocErrorCode = 'unavailable';
    await expect(fetchFamilyMembership('mom@example.com')).rejects.toThrow('Firestore failed');
  });
});
