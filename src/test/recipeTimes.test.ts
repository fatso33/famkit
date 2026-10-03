import { describe, it, expect } from 'vitest';
import { Recipe } from '../types/recipe';
import {
  localizeRecipe,
  overlayTranslation,
  sourceHash,
  translatableContent,
} from '../utils/recipeTranslation';
import { buildTranslation, recipePieces } from '../utils/translationPieces';
import { recipeTime } from '../utils/timeEstimator';
import { hasTypedTimes, recipeTimeLabel, timesFromText } from '../utils/timeText';
import { diffRecipes } from '../utils/recipeVersions';
import { UI_TEXT } from '../i18n/translations';

const babka: Recipe = {
  id: 'babka',
  name: 'Babka drożdżowa',
  author: 'Ola',
  category: 'cakes',
  heroImage: '',
  yieldHeader: '',
  ingredients: [{ text: 'Mąka - 500 g', name: 'Mąka', qty: 500, unit: 'g' }],
  steps: [{ num: 1, text: 'Piecz 50 minut.' }],
  sourceLanguage: 'pl',
  times: timesFromText({ prep: '30 min', cook: '50 min', rest: 'przez noc' }),
};

describe('typed times in translation', () => {
  it("adds nothing to an older recipe's fingerprint", () => {
    const { times: _t, ...older } = babka;
    expect('times' in translatableContent(older)).toBe(false);
    expect(sourceHash({ ...older, times: undefined })).toBe(sourceHash(older));
  });

  it('sends only the times shown in their own words, each as a short piece', () => {
    const ranged = {
      ...babka,
      times: timesFromText({ prep: '20 do 30 min', cook: '50 min', rest: 'przez noc' }),
    };
    const pieces = recipePieces(translatableContent(ranged)).filter((p) => p.kind === 'time');
    // "50 min" is shown as "50m" in either language: nothing to translate.
    expect(pieces).toEqual([
      { key: 'times:prep', kind: 'time', text: '20 do 30 min' },
      { key: 'times:rest', kind: 'time', text: 'przez noc' },
    ]);
  });

  it('keeps an edit that only changes a number of minutes off the translation budget', () => {
    const { content, pieceSources } = buildTranslation(translatableContent(babka), () => 'x');
    expect(content.times?.cook).toBe('50 min');
    expect(pieceSources['times:cook']).toBeUndefined();
  });

  it("shows the translation's words, but always the original's minutes", () => {
    const { content } = buildTranslation(translatableContent(babka), (p) =>
      p.kind === 'time' && p.key === 'times:rest' ? 'overnight' : undefined,
    );
    expect(content.times).toEqual({ prep: '30 min', cook: '50 min', rest: 'overnight' });
    // A reply that changed a number can't change the minutes.
    const shown = overlayTranslation(babka, {
      ...content,
      times: { ...content.times, cook: '5 min' },
    });
    expect(shown.times).toEqual({
      prep: { text: '30 min', minutes: 30 },
      cook: { text: '5 min', minutes: 50 },
      rest: { text: 'overnight', minutes: 480 },
    });
  });

  it('keeps the times of a recipe whose translation has none yet', () => {
    expect(overlayTranslation(babka, { name: 'Yeast babka' }).times).toEqual(babka.times);
    expect(localizeRecipe(babka, 'en').times).toEqual(babka.times);
  });
});

describe('the recipe time', () => {
  const en = UI_TEXT.en;

  it('counts typed times before a set or estimated one', () => {
    expect(recipeTime({ ...babka, manualMinutes: 15 })).toEqual({ minutes: 560, manual: true });
    expect(recipeTimeLabel({ ...babka, manualMinutes: 15 }, en)).toBe('1h 20m + przez noc');
  });

  it('falls back to the set time, then the estimate, when no typed time has a number', () => {
    const vague = { ...babka, times: timesFromText({ prep: 'a while', cook: '', rest: '' }) };
    expect(recipeTime({ ...vague, manualMinutes: 15 })).toEqual({ minutes: 15, manual: true });
    expect(recipeTimeLabel({ ...vague, manualMinutes: 15 }, en)).toBe('15m');
    expect(recipeTimeLabel(vague, en)).toBe('~50m');
    expect(recipeTimeLabel({ ...vague, steps: [] }, en)).toBe('');
  });

  it('tells whether any time was typed, without tripping on a malformed record', () => {
    expect(hasTypedTimes(babka.times)).toBe(true);
    expect(hasTypedTimes({ rest: { text: '  ', minutes: null } })).toBe(false);
    expect(hasTypedTimes(undefined)).toBe(false);
    expect(hasTypedTimes({ prep: { text: 12, minutes: 12 } })).toBe(false);
    expect(hasTypedTimes('soon')).toBe(false);
    const odd = { ...babka, times: { prep: { text: 12 as unknown as string, minutes: 12 } } };
    expect(() => diffRecipes(babka, odd, false)).not.toThrow();
  });

  it("ignores times that aren't numbers, as an untrusted record might hold", () => {
    const odd = {
      ...babka,
      times: { cook: { text: '50 min', minutes: 'lots' as unknown as number } },
    };
    expect(recipeTime(odd)).toEqual({ minutes: 50, manual: false });
  });
});
