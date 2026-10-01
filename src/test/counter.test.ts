import { describe, it, expect } from 'vitest';
import {
  daysBetween,
  familyNames,
  heartNews,
  latestMakes,
  latestRecipes,
  recipeChange,
  timeAgo,
} from '../utils/counter';
import { UI_TEXT } from '../i18n/translations';
import { counterPhotoKeys } from '../services/storage';
import { Recipe } from '../types/recipe';
import { Make } from '../types/make';

const recipe = (id: string, extra: Partial<Recipe> = {}): Recipe => ({
  id,
  name: id,
  author: 'Wanda',
  category: 'breads',
  heroImage: '',
  yieldHeader: '',
  ingredients: [],
  steps: [],
  ...extra,
});

const make = (id: string, extra: Partial<Make> = {}): Make => ({
  id,
  recipeId: 'r',
  photo: 'data:image/jpeg;base64,X',
  createdAt: 1,
  updatedAt: 1,
  ...extra,
});

describe('counter', () => {
  it('shows the recipes added or edited last, the latest first', () => {
    const recipes = [
      recipe('old', { createdAt: 1 }),
      recipe('edited', { createdAt: 2, updatedAt: 50 }),
      recipe('gone', { createdAt: 99, deletedAt: 100 }),
      recipe('added', { createdAt: 40 }),
      recipe('older', { createdAt: 3 }),
    ];
    expect(latestRecipes(recipes).map((r) => r.id)).toEqual(['edited', 'added', 'older']);
    expect(recipeChange(recipe('a'))).toBe('new');
    expect(recipeChange(recipe('a', { version: 3 }))).toBe('updated');
  });

  it('shows the latest makes, leaving deleted ones out', () => {
    const makes = [
      make('a', { createdAt: 1 }),
      make('b', { createdAt: 5, deletedAt: 6 }),
      make('c', { createdAt: 3 }),
    ];
    expect(latestMakes(makes).map((m) => m.id)).toEqual(['c', 'a']);
  });

  it("tells you about new hearts on your makes, once, by name where it's known", () => {
    const mine = make('szarlotka', {
      ownerEmail: 'Peter@x.com',
      hearts: { 'raye@x.com': true, 'wanda@x.com': true, 'peter@x.com': true },
    });
    const theirs = make('bigos', { ownerEmail: 'raye@x.com', hearts: { 'peter@x.com': true } });
    const names = familyNames(
      [recipe('r', { ownerEmail: 'wanda@x.com', ownerName: 'Wanda Kowalska' })],
      [make('m', { ownerEmail: 'raye@x.com', ownerName: 'Raye', ownerNameAsTyped: true })],
    );
    const news = heartNews([mine, theirs], 'peter@x.com', {}, names);
    expect(news?.make.id).toBe('szarlotka');
    expect(news?.names).toEqual(['Raye', 'Wanda K.']);
    expect(news?.count).toBe(2);

    // Once shown, those hearts aren't news any more; a new one is.
    expect(heartNews([mine], 'peter@x.com', { szarlotka: news!.hearts }, names)).toBeNull();
    const more = { ...mine, hearts: { ...mine.hearts, 'ola@x.com': true as const } };
    const next = heartNews([more], 'peter@x.com', { szarlotka: news!.hearts }, names);
    expect(next).toMatchObject({ names: [], count: 1 });
  });

  it('words the hearts news in both languages', () => {
    expect(UI_TEXT.en.heartNews(['Raye', 'Wanda'], 2, 'Szarlotka')).toBe(
      'Raye and Wanda loved your Szarlotka',
    );
    expect(UI_TEXT.en.heartNews(['Raye'], 3, 'Bigos')).toBe('Raye and 2 more loved your Bigos');
    expect(UI_TEXT.en.heartNews([], 1, 'Bigos')).toBe('Someone in the family loved your Bigos');
    expect(UI_TEXT.pl.heartNews(['Raye', 'Wanda'], 2, 'Szarlotka')).toBe(
      'Nowe serduszka dla „Szarlotka”: Raye i Wanda',
    );
    expect(UI_TEXT.pl.heartNews(['Raye'], 6, 'Bigos')).toBe(
      'Nowe serduszka dla „Bigos”: Raye i jeszcze 5 osób',
    );
    expect(UI_TEXT.pl.heartNews([], 5, 'Bigos')).toBe('5 nowych serduszek dla „Bigos”');
  });

  it('says how long ago, in each language', () => {
    const now = new Date(2026, 9, 1, 18, 0).getTime();
    const hoursAgo = (h: number) => now - h * 3_600_000;
    expect(timeAgo(now - 5_000, now, 'en')).toBe('now');
    expect(timeAgo(now - 5 * 60_000, now, 'en')).toBe('5 minutes ago');
    expect(timeAgo(hoursAgo(2), now, 'en')).toBe('2 hours ago');
    expect(timeAgo(hoursAgo(2), now, 'pl')).toBe('2 godziny temu');
    expect(timeAgo(hoursAgo(20), now, 'en')).toBe('yesterday');
    expect(timeAgo(hoursAgo(20), now, 'pl')).toBe('wczoraj');
    expect(timeAgo(hoursAgo(24 * 3), now, 'pl')).toBe('3 dni temu');
    expect(timeAgo(new Date(2026, 8, 1).getTime(), now, 'en')).toBe('Sep 1');
    expect(daysBetween(hoursAgo(20), now)).toBe(1);
  });

  it("reads only the counter's photos ahead of the rest at launch", () => {
    const recipes = ['a', 'b', 'c', 'd'].map((id, i) => recipe(id, { createdAt: i }));
    const makes = [make('m1', { createdAt: 1 }), make('m2', { createdAt: 2, deletedAt: 3 })];
    expect(counterPhotoKeys(JSON.stringify(recipes), JSON.stringify(makes))).toEqual([
      'recipe:d',
      'recipe:c',
      'recipe:b',
      'make:m1',
    ]);
    expect(counterPhotoKeys('not json', '')).toEqual([]);
  });
});
