import { describe, it, expect } from 'vitest';
import { Recipe } from '../types/recipe';
import {
  DEFAULT_SORT,
  NO_FILTER,
  authorKey,
  categoryOf,
  filterCounts,
  filterEntries,
  findMatch,
  foldText,
  formatVaultSort,
  groupEntries,
  parseVaultSort,
  recipePhoto,
  sortEntries,
  vaultCounts,
  type VaultEntry,
} from '../utils/vault';

const recipe = (id: string, extra: Partial<Recipe> = {}): Recipe => ({
  id,
  name: id,
  author: 'Ola',
  category: 'other',
  heroImage: '',
  yieldHeader: 'For 1 batch:',
  ingredients: [{ text: 'Flour - 2 cups' }],
  steps: [{ num: 1, text: 'Mix.' }],
  ...extra,
});

const entry = (r: Recipe, shown: Partial<Recipe> = {}, seen = false): VaultEntry => ({
  recipe: r,
  shown: { ...r, ...shown },
  seen,
});

const names = (entries: VaultEntry[]) => entries.map((e) => e.shown.name);

describe('vault categories', () => {
  it('files older records, and anything unknown, under Other', () => {
    expect(categoryOf({ category: 'soups' })).toBe('soups');
    expect(categoryOf({ category: 'family' })).toBe('other');
    expect(categoryOf({ category: 'heirloom' })).toBe('other');
    expect(categoryOf({ category: '' })).toBe('other');
  });
});

describe('vault search', () => {
  it('ignores case and Polish accents, keeping positions', () => {
    expect(foldText('Żurek Łódzki')).toBe('zurek lodzki');
    expect(foldText('Żurek Łódzki')).toHaveLength('Żurek Łódzki'.length);
    expect(findMatch('Niedzielny żurek', 'ZUREK')).toEqual({ start: 11, end: 16 });
    expect(findMatch('Babka', 'pierogi')).toBeNull();
    expect(findMatch('Babka', '   ')).toBeNull();
  });

  it('finds recipes by name, cook or ingredient, in the language shown', () => {
    const entries = [
      entry(recipe('zurek'), { name: 'Niedzielny żurek', author: 'Kasia' }),
      entry(recipe('babka', { author: 'Babcia Zosia' })),
      entry(recipe('kompot', { ingredients: [{ text: 'Śliwki - 1 kg' }] })),
    ];
    const search = (query: string) => names(filterEntries(entries, { ...NO_FILTER, query }));
    expect(search('zurek')).toEqual(['Niedzielny żurek']);
    expect(search('zosia')).toEqual(['babka']);
    expect(search('sliwki')).toEqual(['kompot']);
    expect(search('')).toHaveLength(3);
  });
});

describe('vault filter', () => {
  const entries = [
    entry(recipe('babka', { category: 'cakes', author: 'Babcia Zosia' })),
    entry(recipe('sernik', { category: 'cakes' }), {}, true),
    entry(recipe('zurek', { category: 'soups', author: 'babcia zosia ' })),
    entry(recipe('old', { category: 'family', author: 'Kasia' }), {}, true),
  ];
  const zosia = authorKey({ author: 'Babcia Zosia' });

  it('narrows by category, author and unseen, together', () => {
    const shown = (filter: Partial<typeof NO_FILTER>) =>
      names(filterEntries(entries, { ...NO_FILTER, ...filter }));
    expect(shown({ category: 'cakes' })).toEqual(['babka', 'sernik']);
    expect(shown({ category: 'other' })).toEqual(['old']);
    // The same author, however their name was typed.
    expect(shown({ author: zosia })).toEqual(['babka', 'zurek']);
    expect(shown({ unseen: true })).toEqual(['babka', 'zurek']);
    expect(shown({ category: 'cakes', unseen: true })).toEqual(['babka']);
    expect(shown({ author: authorKey({ author: 'Kasia' }), unseen: true })).toEqual([]);
  });

  it('counts what each choice would show under the rest of the filter', () => {
    const counts = filterCounts(
      entries,
      { ...NO_FILTER, category: 'soups', author: zosia, unseen: true },
      'en',
    );
    // Categories: Zosia's unseen recipes.
    expect(counts.categories.all).toBe(2);
    expect(counts.categories.cakes).toBe(1);
    expect(counts.categories.soups).toBe(1);
    expect(counts.categories.other).toBe(0);
    // Authors: unseen soups. Every author is listed, A to Z, by their capitalised spelling.
    expect(counts.authors).toEqual([
      { key: zosia, name: 'Babcia Zosia', count: 1 },
      { key: 'kasia', name: 'Kasia', count: 0 },
      { key: 'ola', name: 'Ola', count: 0 },
    ]);
    expect(counts.allAuthors).toBe(1);
    // Unseen: Zosia's soups not yet opened.
    expect(counts.unseen).toBe(1);
  });
});

describe('vault sort', () => {
  const entries = [
    entry(
      recipe('b', {
        name: 'Żurek',
        author: 'Kasia',
        category: 'soups',
        createdAt: 1,
        updatedAt: 9,
        steps: [{ num: 1, text: 'Simmer for 3 hours.' }],
      }),
    ),
    entry(
      recipe('a', {
        name: 'Babka',
        author: 'Zosia',
        category: 'cakes',
        createdAt: 3,
        steps: [{ num: 1, text: 'Bake for 2 hours.' }],
      }),
    ),
    entry(
      recipe('c', {
        name: 'Zapiekanka',
        author: 'kasia ',
        category: 'mains',
        createdAt: 2,
        steps: [{ num: 1, text: 'Bake for 20 minutes.' }],
      }),
    ),
  ];
  type Key = (typeof DEFAULT_SORT)['by'];
  const sorted = (by: Key, reversed = false, lang: 'en' | 'pl' = 'pl') =>
    names(sortEntries(entries, { by, reversed }, lang));

  it('sorts by name in the viewer’s alphabet (Polish Ż after Z), either way', () => {
    expect(sorted('name')).toEqual(['Babka', 'Zapiekanka', 'Żurek']);
    expect(sorted('name', true)).toEqual(['Żurek', 'Zapiekanka', 'Babka']);
  });

  it('sorts by the estimated time, quickest or longest first', () => {
    expect(sorted('time')).toEqual(['Zapiekanka', 'Babka', 'Żurek']);
    expect(sorted('time', true)).toEqual(['Żurek', 'Babka', 'Zapiekanka']);
  });

  it('sorts by category by default', () => {
    expect(DEFAULT_SORT).toEqual({ by: 'category', reversed: false });
    expect(names(sortEntries(entries, DEFAULT_SORT, 'pl'))).toEqual([
      'Żurek',
      'Zapiekanka',
      'Babka',
    ]);
  });

  it('puts the last added first, counting a new version of a recipe as added', () => {
    expect(sorted('changed')).toEqual(['Żurek', 'Babka', 'Zapiekanka']);
    expect(sorted('changed', true)).toEqual(['Zapiekanka', 'Babka', 'Żurek']);
  });

  it('groups by cook, however their name was typed, keeping each cook’s recipes A to Z', () => {
    const byCook = (reversed: boolean) =>
      groupEntries(sortEntries(entries, { by: 'cook', reversed }, 'pl'), 'cook').map((g) => [
        g.key,
        names(g.entries),
      ]);
    expect(byCook(false)).toEqual([
      ['Kasia', ['Zapiekanka', 'Żurek']],
      ['Zosia', ['Babka']],
    ]);
    expect(byCook(true)).toEqual([
      ['Zosia', ['Babka']],
      ['Kasia', ['Zapiekanka', 'Żurek']],
    ]);
  });

  it('groups by category in the filter’s order, either way, with Other always last', () => {
    const withOther = [...entries, entry(recipe('d', { name: 'Kisiel', category: 'family' }))];
    const byCategory = (reversed: boolean) =>
      groupEntries(sortEntries(withOther, { by: 'category', reversed }, 'pl'), 'category').map(
        (g) => g.key,
      );
    expect(byCategory(false)).toEqual(['soups', 'mains', 'cakes', 'other']);
    expect(byCategory(true)).toEqual(['cakes', 'mains', 'soups', 'other']);
  });

  it('has no headings for the other sorts', () => {
    const byName = sortEntries(entries, { by: 'name', reversed: false }, 'pl');
    expect(groupEntries(byName, 'name')).toEqual([{ key: '', entries: byName }]);
  });

  it('keeps a sort on the device as text, reading the first version’s sorts too', () => {
    expect(formatVaultSort(DEFAULT_SORT)).toBe('category');
    expect(formatVaultSort({ by: 'time', reversed: true })).toBe('time:reversed');
    expect(parseVaultSort('time:reversed')).toEqual({ by: 'time', reversed: true });
    expect(parseVaultSort('az')).toEqual({ by: 'name', reversed: false });
    expect(parseVaultSort('quickest')).toEqual({ by: 'time', reversed: false });
    expect(parseVaultSort('updated')).toEqual({ by: 'changed', reversed: false });
    // Date added became part of last added.
    expect(parseVaultSort('added')).toEqual({ by: 'changed', reversed: false });
    expect(parseVaultSort('added:reversed')).toEqual({ by: 'changed', reversed: true });
    expect(parseVaultSort('newest')).toEqual({ by: 'changed', reversed: false });
    expect(parseVaultSort('cook')).toEqual({ by: 'cook', reversed: false });
    expect(parseVaultSort('by-colour')).toBeNull();
    expect(parseVaultSort('name:sideways')).toBeNull();
    expect(parseVaultSort(null)).toBeNull();
  });
});

describe('vault counts', () => {
  it('counts recipes and the different cooks behind them', () => {
    const recipes = [
      recipe('a', { author: 'Wanda G.' }),
      recipe('b', { author: 'wanda g. ' }),
      recipe('c', { author: 'Kasia' }),
    ];
    expect(vaultCounts(recipes)).toEqual({ recipes: 3, cooks: 2 });
    expect(vaultCounts([])).toEqual({ recipes: 0, cooks: 0 });
  });

  // Cloud records aren't checked on the way in: one saved without a cook mustn't take the vault
  // down with it.
  it('copes with a record that has no cook', () => {
    const noCook = recipe('b', { author: undefined as unknown as string });
    const entries = [entry(recipe('a', { author: 'Kasia' })), entry(noCook)];
    expect(vaultCounts([noCook, recipe('a')])).toEqual({ recipes: 2, cooks: 1 });
    const byCook = sortEntries(entries, { by: 'cook', reversed: false }, 'en');
    expect(names(byCook)).toEqual(['b', 'a']);
    expect(groupEntries(byCook, 'cook').map((g) => g.key)).toEqual(['', 'Kasia']);
  });
});

describe('recipe photos', () => {
  it('counts no photo, and the stock photos older versions saved in its place, as none', () => {
    expect(recipePhoto({ heroImage: 'data:image/jpeg;base64,AAAA' })).toBe(
      'data:image/jpeg;base64,AAAA',
    );
    expect(recipePhoto({ heroImage: '' })).toBe('');
    expect(recipePhoto({} as Pick<Recipe, 'heroImage'>)).toBe('');
    // Cloud records aren't checked on the way in: a broken photo field mustn't take the vault down.
    expect(recipePhoto({ heroImage: 42 } as unknown as Pick<Recipe, 'heroImage'>)).toBe('');
    expect(
      recipePhoto({
        heroImage:
          'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=1200&q=80',
      }),
    ).toBe('');
    expect(
      recipePhoto({
        heroImage:
          'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&w=1200&q=80',
      }),
    ).toBe('');
  });
});
