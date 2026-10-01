import { describe, it, expect } from 'vitest';
import { Make } from '../types/make';
import {
  canEditMake,
  hasHearted,
  heartCount,
  isoDay,
  madeOnLabel,
  makeCounts,
  makesOf,
  parseIsoDay,
  parseMake,
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
});
