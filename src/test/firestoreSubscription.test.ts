import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adoptLegacyRecipes, subscribeToRecipes } from '../services/firestore';
import { Recipe } from '../types/recipe';
import { WANDAS_CHEESE_BREAD_SEED } from '../data/wandasCheeseBread';
import { needsTranslation } from '../utils/recipeTranslation';

vi.mock('../services/firebase', () => ({ isFirebaseConfigured: true, db: {} }));

// A stand-in for Firestore that behaves like the real thing where it matters here: a query
// ordered by a field leaves out every document that doesn't have that field.
const cloud = vi.hoisted(() => ({
  docs: [] as Recipe[],
  /** Whether snapshots come from the device's offline cache rather than the server. */
  fromCache: false,
  listeners: [] as { orderField?: string; next: (snap: unknown) => void }[],
  batches: [] as { sets: [string, Recipe][]; updates: [string, object][]; committed: boolean }[],
}));

vi.mock('../utils/imageCompression', () => ({
  compressImage: (src: string) => Promise.resolve(`data:image/jpeg;base64,${src}`),
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
      docs: snaps,
      forEach: (fn: (d: { data: () => Recipe }) => void) => snaps.forEach(fn),
    };
  };
  return {
    collection: () => ({}),
    doc: (_db: unknown, _col: string, id: string) => ({ id }),
    getDocsFromServer: () => Promise.resolve(snapshotFor()),
    writeBatch: () => {
      const batch = { sets: [], updates: [], committed: false } as (typeof cloud.batches)[0];
      cloud.batches.push(batch);
      return {
        set: (ref: { id: string }, data: Recipe) => batch.sets.push([ref.id, data]),
        update: (ref: { id: string }, data: object) => batch.updates.push([ref.id, data]),
        commit: () => {
          batch.committed = true;
          return Promise.resolve();
        },
      };
    },
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

describe('adoptLegacyRecipes', () => {
  const peter = { email: 'p.gzowski33@gmail.com', name: 'Peter Gzowski' };
  // Wanda's record as the old app stored it: bundled photos, no owner, no date.
  const legacyWanda = { ...WANDAS_CHEESE_BREAD_SEED, isDefault: true } as Recipe;

  beforeEach(() => {
    cloud.docs = [];
    cloud.fromCache = false;
    cloud.batches = [];
  });

  it("makes Wanda's Cheese Bread an ordinary recipe Peter added, first in the vault", async () => {
    cloud.docs = [legacyWanda, { ...recipe('test-recipe', 2000), author: 'Peter Gzowski' }];
    await expect(adoptLegacyRecipes(peter)).resolves.toBe(true);

    const [batch] = cloud.batches;
    expect(batch.committed).toBe(true);
    const [[id, wanda]] = batch.sets;
    expect(id).toBe('wandas-cheese-bread');
    expect(wanda).toMatchObject({
      name: "Wanda's Cheese Bread",
      author: 'Wanda G.',
      authorMode: 'custom',
      ownerEmail: peter.email,
      ownerName: peter.name,
      sourceLanguage: 'en',
    });
    expect(wanda).not.toHaveProperty('isDefault');
    expect(wanda.createdAt).toBeLessThan(2000);
    // Photos are embedded like a phone upload, not links to files bundled with the site.
    expect(wanda.heroImage).toMatch(/^data:image\/jpeg/);
    expect(wanda.steps.find((st) => st.hasImage)?.imageSrc).toMatch(/^data:image\/jpeg/);
    expect(wanda.translations?.pl?.steps?.some((st) => st.imageSrc)).toBe(false);
    // The hand-written Polish is current, so it's never replaced by a machine translation.
    expect(wanda.translations?.pl?.name).toBe('Chleb Serowy Wandy');
    expect(needsTranslation(wanda)).toBe(false);
    // The verbatim text is untouched.
    expect(wanda.steps.map((st) => st.text)).toEqual(
      WANDAS_CHEESE_BREAD_SEED.steps.map((st) => st.text),
    );

    expect(batch.updates).toEqual([
      ['test-recipe', { ownerEmail: peter.email, ownerName: peter.name, authorMode: 'auto' }],
    ]);
  });

  it("recreates Wanda's Cheese Bread if the vault has lost it", async () => {
    cloud.docs = [{ ...recipe('someone-elses', 2000), ownerEmail: 'ola@example.com' }];
    await adoptLegacyRecipes(peter);

    const [batch] = cloud.batches;
    expect(batch.sets.map(([id]) => id)).toEqual(['wandas-cheese-bread']);
    expect(batch.updates).toEqual([]);
  });

  it('keeps the version history of the stored record', async () => {
    const history = [{ version: 1, savedAt: 1, recipe: { ...legacyWanda, tips: 'Old tip' } }];
    cloud.docs = [{ ...legacyWanda, version: 2, history }];
    await adoptLegacyRecipes(peter);

    expect(cloud.batches[0].sets[0][1]).toMatchObject({ version: 2, history });
  });

  it('does nothing once everything has an owner', async () => {
    cloud.docs = [{ ...legacyWanda, ownerEmail: peter.email, ownerName: peter.name }];
    await expect(adoptLegacyRecipes(peter)).resolves.toBe(false);
    expect(cloud.batches).toEqual([]);
  });
});
