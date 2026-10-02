import { describe, it, expect } from 'vitest';
import { Make, MakesSort } from '../types/make';
import {
  DEFAULT_MAKES_SORT,
  NO_MAKES_FILTER,
  canEditMake,
  filterMakes,
  formatMakesSort,
  isDefaultMakesSort,
  isMakesFiltered,
  makesFilterCounts,
  parseMakesSort,
  sortMakes,
  type MakesEntry,
  hasHearted,
  heartCount,
  isoDay,
  madeOnLabel,
  makeCounts,
  makesOf,
  parseIsoDay,
  parseMake,
  searchMakes,
  shownMakes,
  withHeart,
} from '../utils/makes';

const make = (over: Partial<Make> = {}): Make => ({
  id: 'make-1',
  recipeId: 'recipe-1',
  photo: 'data:image/jpeg;base64,AAAA',
  ownerEmail: 'ola@example.com',
  createdAt: 100,
  updatedAt: 100,
  ...over,
});

const words = { today: 'Today', yesterday: 'Yesterday' };

describe('makes', () => {
  it('shows makes newest first, without deleted ones, and counts them per recipe', () => {
    const makes = [
      make({ id: 'a', createdAt: 1 }),
      make({ id: 'b', createdAt: 3 }),
      make({ id: 'c', createdAt: 2, recipeId: 'recipe-2' }),
      make({ id: 'd', createdAt: 4, deletedAt: 5 }),
    ];
    expect(shownMakes(makes).map((m) => m.id)).toEqual(['b', 'c', 'a']);
    expect(makesOf(makes, 'recipe-1').map((m) => m.id)).toEqual(['b', 'a']);
    expect(makeCounts(makes)).toEqual(
      new Map([
        ['recipe-1', 2],
        ['recipe-2', 1],
      ]),
    );
  });

  it('lets only the maker edit a make, unless nothing is access controlled', () => {
    const ola = { email: 'OLA@example.com', name: 'Ola' };
    const zosia = { email: 'zosia@example.com', name: 'Zosia' };
    expect(canEditMake(make(), ola, true)).toBe(true);
    expect(canEditMake(make(), zosia, true)).toBe(false);
    expect(canEditMake(make(), null, false)).toBe(true);
  });

  it('keeps hearts by lowercase email, one per person', () => {
    let m = withHeart(make(), 'Zosia@Example.com', true);
    m = withHeart(m, 'zosia@example.com', true);
    expect(heartCount(m)).toBe(1);
    expect(hasHearted(m, 'ZOSIA@example.com')).toBe(true);
    m = withHeart(m, 'zosia@example.com', false);
    expect(heartCount(m)).toBe(0);
    expect(m.hearts).toBeUndefined();
  });

  it('labels the day it was made as today, yesterday or a date', () => {
    const now = new Date(2026, 8, 30, 12).getTime();
    expect(madeOnLabel(make({ madeOn: '2026-09-30' }), 'en', words, now)).toBe('Today');
    expect(madeOnLabel(make({ madeOn: '2026-09-29' }), 'en', words, now)).toBe('Yesterday');
    expect(madeOnLabel(make({ madeOn: '2026-09-12' }), 'en', words, now)).toBe('12 Sept');
    expect(madeOnLabel(make({ madeOn: '2025-12-24' }), 'pl', words, now)).toBe('24 gru 2025');
    // Without a day, when it was added.
    const added = new Date(2026, 8, 30, 9).getTime();
    expect(madeOnLabel(make({ createdAt: added }), 'en', words, now)).toBe('Today');
  });

  it('reads only real days', () => {
    expect(isoDay(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(parseIsoDay('2026-02-30')).toBeNull();
    expect(parseIsoDay('30/09/2026')).toBeNull();
    expect(parseIsoDay('2026-09-30')?.getDate()).toBe(30);
  });

  it('reads a make from the cloud, keeping only what a make has', () => {
    const parsed = parseMake({
      ...make({ title: 'Sunday loaves', madeOn: '2026-09-30' }),
      hearts: { 'zosia@example.com': true, 'x@example.com': 'yes' },
      sourceLanguage: 'pl',
      translations: { en: { title: 'Niedzielne bochenki', sourceHash: 'abc', extra: 1 } },
      script: '<b>no</b>',
      madeOnBogus: true,
    });
    expect(parsed).toMatchObject({
      id: 'make-1',
      title: 'Sunday loaves',
      madeOn: '2026-09-30',
      hearts: { 'zosia@example.com': true },
      sourceLanguage: 'pl',
      translations: { en: { title: 'Niedzielne bochenki', sourceHash: 'abc' } },
    });
    expect(parsed).not.toHaveProperty('script');
    expect(parsed?.translations?.en).not.toHaveProperty('extra');
    // Without a recipe or a photo, it isn't a make.
    expect(parseMake({ ...make(), recipeId: undefined })).toBeNull();
    expect(parseMake({ ...make(), photo: '' })).toBeNull();
    expect(parseMake('make')).toBeNull();
  });

  it('finds makes by title, recipe or maker, ignoring case and accents', () => {
    const entries = [
      {
        make: make({ id: 'a', ownerName: 'Ola Kowalska' }),
        title: 'Sunday loaves',
        recipeName: 'Chleb',
      },
      {
        make: make({ id: 'b', ownerName: 'Raye' }),
        title: 'Chili night',
        recipeName: "Raye's Chili",
      },
      { make: make({ id: 'c' }), title: 'Pierogi party', recipeName: 'Pierogi ruskie' },
    ];
    const ids = (query: string) => searchMakes(entries, query).map((e) => e.make.id);
    expect(ids('')).toEqual(['a', 'b', 'c']);
    expect(ids('   ')).toEqual(['a', 'b', 'c']);
    expect(ids('LOAVES')).toEqual(['a']);
    expect(ids('ruskie')).toEqual(['c']);
    expect(ids('raye')).toEqual(['b']);
    // The maker by the name shown on the tile ("Ola K."), not their full Google name.
    expect(ids('ola k')).toEqual(['a']);
    expect(ids('kowalska')).toEqual([]);
    expect(ids('chlèb')).toEqual(['a']);
    expect(ids('bigos')).toEqual([]);
  });
});

describe("the Makes page's filter and sort", () => {
  const entry = (over: Partial<Make>, recipeName: string, category: MakesEntry['category']) => {
    const m = make(over);
    return { make: m, title: m.title || recipeName, recipeName, category };
  };
  const ENTRIES: MakesEntry[] = [
    entry(
      {
        id: 'a',
        recipeId: 'bread',
        ownerEmail: 'Ola@example.com',
        ownerName: 'Ola',
        createdAt: 300,
      },
      'Cheese bread',
      'breads',
    ),
    entry(
      {
        id: 'b',
        recipeId: 'zurek',
        ownerEmail: 'kasia@example.com',
        ownerName: 'Kasia',
        createdAt: 200,
        hearts: { 'ola@example.com': true, 'piotr@example.com': true },
      },
      'Żurek',
      'soups',
    ),
    entry(
      {
        id: 'c',
        recipeId: 'bread',
        ownerEmail: 'kasia@example.com',
        ownerName: 'Kasia',
        createdAt: 100,
        hearts: { 'piotr@example.com': true },
      },
      'Cheese bread',
      'breads',
    ),
    // Its recipe has gone from the box.
    entry(
      { id: 'd', recipeId: 'gone', ownerName: 'Wanda', ownerEmail: '', createdAt: 50 },
      '',
      null,
    ),
  ];
  const ids = (list: MakesEntry[]) => list.map((e) => e.make.id);
  const olaHearted = (m: Make) => hasHearted(m, 'ola@example.com');

  it('keeps a sort as text and reads it back', () => {
    expect(parseMakesSort(formatMakesSort({ by: 'hearts', reversed: true }))).toEqual({
      by: 'hearts',
      reversed: true,
    });
    expect(parseMakesSort('maker')).toEqual({ by: 'maker', reversed: false });
    expect(parseMakesSort('time')).toBeNull();
    expect(parseMakesSort('newest:sideways')).toBeNull();
    expect(isDefaultMakesSort(DEFAULT_MAKES_SORT)).toBe(true);
    expect(isDefaultMakesSort({ by: 'newest', reversed: true })).toBe(false);
  });

  it('filters by maker, category, recipe and hearts, together', () => {
    const f = (over: Partial<typeof NO_MAKES_FILTER>) =>
      ids(filterMakes(ENTRIES, { ...NO_MAKES_FILTER, ...over }, olaHearted));
    expect(f({})).toEqual(['a', 'b', 'c', 'd']);
    expect(isMakesFiltered(NO_MAKES_FILTER)).toBe(false);
    // Makers go by email, however it was capitalised.
    expect(f({ maker: 'ola@example.com' })).toEqual(['a']);
    expect(f({ maker: 'kasia@example.com' })).toEqual(['b', 'c']);
    // Without an email, by name.
    expect(f({ maker: 'wanda' })).toEqual(['d']);
    expect(f({ category: 'breads' })).toEqual(['a', 'c']);
    expect(f({ recipeId: 'bread', maker: 'kasia@example.com' })).toEqual(['c']);
    expect(f({ hearted: true })).toEqual(['b']);
    expect(f({ hearted: true, category: 'breads' })).toEqual([]);
  });

  it('counts what each choice would show, with the rest of the filter', () => {
    const counts = makesFilterCounts(
      ENTRIES,
      { ...NO_MAKES_FILTER, category: 'breads' },
      olaHearted,
      'en',
    );
    expect(counts.categories.all).toBe(4);
    expect(counts.categories.breads).toBe(2);
    expect(counts.categories.soups).toBe(1);
    expect(counts.makers).toEqual([
      { key: 'kasia@example.com', name: 'Kasia', count: 1 },
      { key: 'ola@example.com', name: 'Ola', count: 1 },
      { key: 'wanda', name: 'Wanda', count: 0 },
    ]);
    expect(counts.allMakers).toBe(2);
    // Only recipes still in the box, once each.
    expect(counts.recipes).toEqual([
      { id: 'bread', name: 'Cheese bread', count: 2 },
      { id: 'zurek', name: 'Żurek', count: 0 },
    ]);
    expect(counts.hearted).toBe(0);
    expect(makesFilterCounts(ENTRIES, NO_MAKES_FILTER, olaHearted, 'en').hearted).toBe(1);
  });

  it('sorts by each key, either way round, ties going the newest first', () => {
    const s = (by: MakesSort['by'], reversed = false) =>
      ids(sortMakes(ENTRIES, { by, reversed }, 'en'));
    expect(s('newest')).toEqual(['a', 'b', 'c', 'd']);
    expect(s('newest', true)).toEqual(['d', 'c', 'b', 'a']);
    expect(s('hearts')).toEqual(['b', 'c', 'a', 'd']);
    expect(s('hearts', true)).toEqual(['a', 'd', 'c', 'b']);
    // A gone recipe comes last either way.
    expect(s('recipe')).toEqual(['a', 'c', 'b', 'd']);
    expect(s('recipe', true)).toEqual(['b', 'a', 'c', 'd']);
    expect(s('maker')).toEqual(['b', 'c', 'a', 'd']);
    expect(s('maker', true)).toEqual(['d', 'a', 'b', 'c']);
  });
});
