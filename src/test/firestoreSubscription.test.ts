import { describe, it, expect, vi, beforeEach } from 'vitest';
import { subscribeToRecipes } from '../services/firestore';
import { Recipe } from '../types/recipe';

vi.mock('../services/firebase', () => ({ isFirebaseConfigured: true, db: {} }));

// A stand-in for Firestore that behaves like the real thing where it matters here: a query
// ordered by a field leaves out every document that doesn't have that field.
const cloud = vi.hoisted(() => ({
  docs: [] as Recipe[],
  /** Whether snapshots come from the device's offline cache rather than the server. */
  fromCache: false,
  listeners: [] as { orderField?: string; next: (snap: unknown) => void }[],
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
    doc: () => ({}),
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
