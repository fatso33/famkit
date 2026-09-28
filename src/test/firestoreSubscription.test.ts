import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchFamilyMembership,
  fetchRecipeVersion,
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
  return {
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
          cloud.writes.push(...pending);
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

  it("refuses to save this device's copy of a recipe whose photos were left out", async () => {
    const slim: Recipe = { ...babka, photosOmitted: { hero: true } };
    localStorage.setItem('wandas_recipes', JSON.stringify([babka]));

    await expect(saveRecipeToCloud(slim)).rejects.toThrow(/photos/);
    await expect(saveRecipeToCloud(babka, [{ ...v1, recipe: slim }])).rejects.toThrow(/photos/);
    expect(cloud.writes).toEqual([]);
    expect(JSON.parse(localStorage.getItem('wandas_recipes')!)).toEqual([babka]);
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
