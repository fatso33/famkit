import { describe, it, expect } from 'vitest';
import { Recipe } from '../types/recipe';
import { TRANSLATION_GRACE_MS, sourceHash } from '../utils/recipeTranslation';
import {
  EDIT_SETTLE_MS,
  MAX_BATCH_PIECES,
  QueueItem,
  mayRideAlong,
  nextDailyReset,
  pickBatch,
  translationDueAt,
} from '../utils/translationQueue';

const SAVED = 1_000_000;
const recipe: Recipe = {
  id: 'r1',
  name: 'Apple Pie',
  author: 'Ola',
  category: 'cakes',
  heroImage: '',
  yieldHeader: '',
  ingredients: [],
  steps: [{ num: 1, text: 'Bake.' }],
  createdAt: SAVED,
  updatedAt: SAVED,
};
const translatedEarlier: Recipe = {
  ...recipe,
  translations: { pl: { name: 'Szarlotka', sourceHash: sourceHash(recipe), translatedAt: 500 } },
};
const edited: Recipe = { ...translatedEarlier, name: 'Apple Pie!!' };
const partly: Recipe = {
  ...translatedEarlier,
  translations: {
    pl: { ...translatedEarlier.translations!.pl, pieceSources: {}, translatedAt: SAVED + 5 },
  },
};

const here = (savedHere: boolean, translatedHere = false) => ({ savedHere, translatedHere });

describe('translationDueAt', () => {
  it('translates a new recipe at once on its phone, and after a head start elsewhere', () => {
    expect(translationDueAt(recipe, here(true))).toBe(SAVED);
    expect(translationDueAt(recipe, here(false))).toBe(SAVED + TRANSLATION_GRACE_MS);
  });

  it('waits for an edit to settle for half an hour, everywhere', () => {
    expect(translationDueAt(edited, here(true))).toBe(SAVED + EDIT_SETTLE_MS);
    expect(translationDueAt(edited, here(false))).toBe(
      SAVED + EDIT_SETTLE_MS + TRANSLATION_GRACE_MS,
    );
  });

  it('finishes a translation missing pieces at once where it was made, and soon elsewhere', () => {
    // The Simple Turkey Chili: its follow-up waited behind the head start meant for other phones.
    expect(translationDueAt(partly, here(false, true))).toBe(0);
    expect(translationDueAt(partly, here(false))).toBe(SAVED + 5 + TRANSLATION_GRACE_MS);
  });
});

describe('mayRideAlong', () => {
  it('takes waiting edits early, but not another phone’s new recipe', () => {
    expect(mayRideAlong(edited, here(false))).toBe(true);
    expect(mayRideAlong(partly, here(false))).toBe(true);
    expect(mayRideAlong(recipe, here(true))).toBe(true);
    expect(mayRideAlong(recipe, here(false))).toBe(false);
  });
});

describe('pickBatch', () => {
  const item = (name: string, dueAt: number, rideAlong = true, pieces = 10) => ({
    item: name,
    dueAt,
    rideAlong,
    pieces,
    chars: pieces * 50,
  });

  it('asks for nothing until something is due', () => {
    expect(pickBatch([item('edit', 100)], 50)).toEqual([]);
  });

  it('takes everything due, then whatever may ride along, in one request', () => {
    // A new recipe, with an edit still settling and another phone's new recipe.
    const queue: QueueItem<string>[] = [
      item('waiting edit', 5_000),
      item('new recipe', 0),
      item('their new recipe', 60, false),
    ];
    expect(pickBatch(queue, 10)).toEqual(['new recipe', 'waiting edit']);
  });

  it('leaves what doesn’t fit for the next request, but always sends one large recipe', () => {
    const queue = [
      item('big', 0, true, MAX_BATCH_PIECES + 20),
      item('small', 0, true, 5),
      item('later', 100, true, 5),
    ];
    expect(pickBatch(queue, 10)).toEqual(['big']);
    expect(pickBatch(queue.slice(1), 10)).toEqual(['small', 'later']);
  });
});

describe('nextDailyReset', () => {
  it.each([
    // Summer time: midnight Pacific is 07:00 UTC.
    ['2026-09-30T18:29:47Z', '2026-10-01T07:01:00.000Z'],
    ['2026-10-01T06:59:00Z', '2026-10-01T07:01:00.000Z'],
    ['2026-10-01T07:00:30Z', '2026-10-02T07:01:00.000Z'],
    // Winter time: 08:00 UTC.
    ['2026-12-10T12:00:00Z', '2026-12-11T08:01:00.000Z'],
    // Across the clock changes (1 November and 8 March).
    // (11 p.m. on 31 October there: midnight still comes in summer time.)
    ['2026-11-01T06:00:00Z', '2026-11-01T07:01:00.000Z'],
    ['2026-11-01T10:00:00Z', '2026-11-02T08:01:00.000Z'],
    ['2027-03-14T05:00:00Z', '2027-03-14T08:01:00.000Z'],
    ['2027-03-14T09:00:00Z', '2027-03-15T07:01:00.000Z'],
  ])('from %s', (now, reset) => {
    expect(new Date(nextDailyReset(new Date(now).getTime())).toISOString()).toBe(reset);
  });
});
