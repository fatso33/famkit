import { describe, it, expect } from 'vitest';
import { Recipe } from '../types/recipe';
import {
  NO_FILTER,
  categoryCounts,
  categoryOf,
  filterEntries,
  findMatch,
  foldText,
  groupEntries,
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

const entry = (r: Recipe, shown: Partial<Recipe> = {}): VaultEntry => ({
  recipe: r,
  shown: { ...r, ...shown },
});

const names = (entries: VaultEntry[]) => entries.map((e) => e.shown.name);

// Credited to someone outside the app (utils/ownership), e.g. a grandmother.
const heirloom = { authorMode: 'custom' as const, ownerName: 'Peter' };

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
    entry(recipe('babka', { category: 'cakes', ...heirloom })),
    entry(recipe('sernik', { category: 'cakes' })),
    entry(recipe('zurek', { category: 'soups', ...heirloom })),
    entry(recipe('old', { category: 'family' })),
  ];

  it('narrows by category and to heirlooms, together', () => {
    const shown = (filter: Partial<typeof NO_FILTER>) =>
      names(filterEntries(entries, { ...NO_FILTER, ...filter }));
    expect(shown({ category: 'cakes' })).toEqual(['babka', 'sernik']);
    expect(shown({ category: 'other' })).toEqual(['old']);
    expect(shown({ heirloomsOnly: true })).toEqual(['babka', 'zurek']);
    expect(shown({ category: 'cakes', heirloomsOnly: true })).toEqual(['babka']);
  });

  it("counts each category's recipes under the rest of the filter", () => {
    const counts = categoryCounts(entries, {
      ...NO_FILTER,
      category: 'soups',
      heirloomsOnly: true,
    });
    expect(counts.all).toBe(2);
    expect(counts.cakes).toBe(1);
    expect(counts.soups).toBe(1);
    expect(counts.other).toBe(0);
    expect(counts.drinks).toBe(0);
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
  const sorted = (sort: Parameters<typeof sortEntries>[1], lang: 'en' | 'pl' = 'pl') =>
    names(sortEntries(entries, sort, lang));

  it('puts the newest first by default', () => {
    expect(sorted('newest')).toEqual(['Babka', 'Zapiekanka', 'Żurek']);
  });

  it('sorts A to Z in the viewer’s alphabet (Polish Ż after Z)', () => {
    expect(sorted('az')).toEqual(['Babka', 'Zapiekanka', 'Żurek']);
  });

  it('sorts by the estimated time, quickest first', () => {
    expect(sorted('quickest')).toEqual(['Zapiekanka', 'Babka', 'Żurek']);
  });

  it('puts the most recently changed first, counting a new recipe as changed when added', () => {
    expect(sorted('updated')).toEqual(['Żurek', 'Babka', 'Zapiekanka']);
  });

  it('groups by cook, however their name was typed, and by category in the filter’s order', () => {
    const byCook = groupEntries(sortEntries(entries, 'cook', 'pl'), 'cook');
    expect(byCook.map((g) => [g.key, names(g.entries)])).toEqual([
      ['Kasia', ['Zapiekanka', 'Żurek']],
      ['Zosia', ['Babka']],
    ]);
    const byCategory = groupEntries(sortEntries(entries, 'category', 'pl'), 'category');
    expect(byCategory.map((g) => g.key)).toEqual(['soups', 'mains', 'cakes']);
  });

  it('has no headings for the other sorts', () => {
    expect(groupEntries(sortEntries(entries, 'az', 'pl'), 'az')).toEqual([
      { key: '', entries: sortEntries(entries, 'az', 'pl') },
    ]);
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
    const byCook = sortEntries(entries, 'cook', 'en');
    expect(names(byCook)).toEqual(['b', 'a']);
    expect(groupEntries(byCook, 'cook').map((g) => g.key)).toEqual(['', 'Kasia']);
  });
});
