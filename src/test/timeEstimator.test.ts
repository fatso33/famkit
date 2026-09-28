import { describe, it, expect } from 'vitest';
import {
  extractTimeFromText,
  estimateActionDuration,
  estimateRecipeMinutes,
  capitalizeFirstLetter,
  manualMinutesOf,
  recipeTime,
} from '../utils/timeEstimator';
import { localizeRecipe } from '../utils/recipeTranslation';
import { formFromRecipe, methodToSteps } from '../utils/recipeForm';
import { UI_TEXT } from '../i18n/translations';
import { Language } from '../types/recipe';
import { WANDAS_CHEESE_BREAD } from './fixtures/wandasCheeseBread';

describe('extractTimeFromText', () => {
  it('identifies explicit minute durations', () => {
    expect(extractTimeFromText('Bake for 25 minutes covered.')).toBe(25);
    expect(extractTimeFromText('Let rise for at least an hour.')).toBe(60);
    expect(extractTimeFromText('Preheat Dutch oven for 30 minutes.')).toBe(30);
  });

  it('handles ranges by taking the average', () => {
    expect(extractTimeFromText('Bake 20 to 30 minutes')).toBe(25);
    expect(extractTimeFromText('Rise for 1-2 hours')).toBe(90);
  });

  it('handles colloquial duration phrases', () => {
    expect(extractTimeFromText('Rest in the fridge overnight')).toBe(480);
    expect(extractTimeFromText('Let rest for half an hour')).toBe(30);
    expect(extractTimeFromText('Let rise for an hour and a half')).toBe(90);
  });

  it('reads Polish units in every count and case', () => {
    expect(extractTimeFromText('Piecz przez 25 minut.')).toBe(25);
    expect(extractTimeFromText('Gotuj 1 minutę, potem 2 minuty.')).toBe(3);
    expect(extractTimeFromText('Sprawdź po 30 minutach.')).toBe(30);
    expect(extractTimeFromText('Odstaw na 2 godziny.')).toBe(120);
    expect(extractTimeFromText('Duś 1,5 godziny.')).toBe(90);
    expect(extractTimeFromText('Piecz 10 min.')).toBe(10);
    expect(extractTimeFromText('Studź 2 godz.')).toBe(120);
  });

  it('reads Polish ranges', () => {
    expect(extractTimeFromText('Piecz 25-30 minut.')).toBe(27.5);
    expect(extractTimeFromText('Piecz od 20 do 30 minut.')).toBe(25);
    expect(extractTimeFromText('Odstaw na 1–2 godziny.')).toBe(90);
    expect(extractTimeFromText('Piecz do 30 minut.')).toBe(30);
  });

  it('reads Polish durations said in words', () => {
    expect(extractTimeFromText('Wstaw do lodówki na noc.')).toBe(480);
    expect(extractTimeFromText('Odstaw przez całą noc.')).toBe(480);
    expect(extractTimeFromText('Odstaw na pół godziny.')).toBe(30);
    expect(extractTimeFromText('Odstaw na półtorej godziny.')).toBe(90);
    expect(extractTimeFromText('Odstaw na co najmniej godzinę.')).toBe(60);
    expect(extractTimeFromText('Po godzinie wyjmij ciasto.')).toBe(60);
    expect(extractTimeFromText('Odstaw na 1 godzinę.')).toBe(60);
    expect(extractTimeFromText('Marynuj kilka godzin.')).toBe(120);
  });

  it('ignores numbers followed by a word that only starts like a unit', () => {
    expect(extractTimeFromText('Add 2 mint leaves.')).toBe(0);
    expect(extractTimeFromText('Dodaj 375ml wody.')).toBe(0);
    expect(extractTimeFromText('Dodaj 2 miętowe liście.')).toBe(0);
  });
});

describe('estimateActionDuration', () => {
  it('estimates duration based on culinary action keywords', () => {
    expect(estimateActionDuration('Knead the dough vigorously')).toBe(8);
    expect(estimateActionDuration('Preheat the oven')).toBe(15);
    expect(estimateActionDuration('Chop the jalapenos')).toBe(3);
    expect(estimateActionDuration('Roll into a square')).toBe(1.5);
  });

  it('knows the same actions in Polish', () => {
    expect(estimateActionDuration('Zagnieć ciasto')).toBe(8);
    expect(estimateActionDuration('Wyrabiaj ciasto')).toBe(8);
    expect(estimateActionDuration('Posiekaj papryczki')).toBe(3);
    expect(estimateActionDuration('Pokrój cebulę w kostkę')).toBe(3);
    expect(estimateActionDuration('Zetrzyj ser')).toBe(3);
    expect(estimateActionDuration('Dokładnie wymieszaj')).toBe(2);
    expect(estimateActionDuration('Ubij białka')).toBe(2);
    expect(estimateActionDuration('Rozwałkuj ciasto')).toBe(1.5);
    expect(estimateActionDuration('Zwiń ciasto w rulon')).toBe(1.5);
    expect(estimateActionDuration('Wyłóż ciasto na blat')).toBe(1);
    expect(estimateActionDuration('Przykryj miskę')).toBe(1);
    expect(estimateActionDuration('Ostudź na kratce')).toBe(10);
    expect(estimateActionDuration('Rozgrzej piekarnik')).toBe(15);
  });
});

describe('estimateRecipeMinutes', () => {
  it('computes total recipe time for Wanda Cheese Bread, rounded to 5 minutes', () => {
    const minutes = estimateRecipeMinutes(WANDAS_CHEESE_BREAD);
    expect(minutes).toBeGreaterThan(60);
    expect(minutes % 5).toBe(0);
  });

  it('estimates Wanda Cheese Bread the same in English and Polish', () => {
    const estimate = (lang: Language) =>
      estimateRecipeMinutes(localizeRecipe(WANDAS_CHEESE_BREAD, lang));
    expect(estimate('pl')).toBe(estimate('en'));
  });

  it('estimates Wanda Cheese Bread the same in the English and Polish editor, on either baking path', () => {
    // The editor estimates from its own steps, in the language it shows, with the old baking
    // options made a fork (see recipeForm).
    const editorSteps = (lang: Language) => {
      const t = UI_TEXT[lang];
      const form = formFromRecipe(localizeRecipe(WANDAS_CHEESE_BREAD, lang), {
        bakingSection: t.bakingOptions,
        bakingPaths: t.legacyBakingPaths,
      });
      return methodToSteps(form.sections, form.numberFrom);
    };
    const en = editorSteps('en');
    const pl = editorSteps('pl');
    const fork = en.findIndex((step) => step.fork);
    expect(fork).toBeGreaterThan(0);
    expect(estimateRecipeMinutes({ steps: pl })).toBeGreaterThan(4 * 60);
    expect(estimateRecipeMinutes({ steps: pl })).toBe(estimateRecipeMinutes({ steps: en }));
    expect(estimateRecipeMinutes({ steps: pl }, { [fork]: 1 })).toBe(
      estimateRecipeMinutes({ steps: en }, { [fork]: 1 }),
    );
  });

  it('returns default estimate when recipe has no steps', () => {
    expect(estimateRecipeMinutes(null)).toBe(30);
    expect(estimateRecipeMinutes({ steps: [] })).toBe(25);
  });
});

describe('capitalizeFirstLetter', () => {
  it('capitalizes sentences properly', () => {
    expect(capitalizeFirstLetter('will not work in an air fryer.')).toBe(
      'Will not work in an air fryer.',
    );
    expect(capitalizeFirstLetter('mix well. then add water and mix again.')).toBe(
      'Mix well. Then add water and mix again.',
    );
  });
});

describe('recipe time with sections, forks and a time set by hand', () => {
  const forked = {
    steps: [
      { num: 1, text: 'Mix.' },
      {
        num: 2,
        text: 'Chill overnight.',
        fork: {
          paths: [
            { label: 'Fridge', text: 'Chill overnight.' },
            { label: 'Now', text: 'Bake for 40 minutes.', steps: ['Cool for 10 minutes.'] },
          ],
        },
      },
    ],
  };

  it('counts only the path the cook is on', () => {
    // Mix (2) + overnight (480).
    expect(estimateRecipeMinutes(forked)).toBe(480);
    // Mix (2) + bake (40) + cool (10).
    expect(estimateRecipeMinutes(forked, { 1: 1 })).toBe(50);
  });

  it('adds a repeat of earlier steps from unnumbered text, and nothing for other text', () => {
    const steps = [
      { num: 1, text: 'Knead for 10 minutes.' },
      { num: 2, text: 'Rest for 20 minutes.' },
    ];
    expect(estimateRecipeMinutes({ steps })).toBe(30);
    expect(
      estimateRecipeMinutes({
        steps: [...steps, { num: 0, plain: true, text: 'Repeat steps 1 to 2 two more times.' }],
      }),
    ).toBe(90);
    expect(
      estimateRecipeMinutes({ steps: [...steps, { num: 0, plain: true, text: 'Enjoy!' }] }),
    ).toBe(30);
  });

  it('adds a repeat of earlier steps said in Polish', () => {
    const steps = [
      { num: 1, text: 'Wyrabiaj przez 10 minut.' },
      { num: 2, text: 'Odstaw na 20 minut.' },
    ];
    const withRepeat = (text: string) =>
      estimateRecipeMinutes({ steps: [...steps, { num: 0, plain: true, text }] });
    expect(withRepeat('Powtórz kroki od 1 do 2 jeszcze dwa razy.')).toBe(90);
    expect(withRepeat('Powtórz kroki 1–2 jeszcze raz.')).toBe(60);
    expect(withRepeat('Powtórz punkty 1-2 trzykrotnie.')).toBe(120);
  });

  it("uses the author's own time over the estimate, when it's a real number of minutes", () => {
    expect(recipeTime({ ...forked, manualMinutes: 95 })).toEqual({ minutes: 95, manual: true });
    expect(recipeTime(forked, { 1: 1 })).toEqual({ minutes: 50, manual: false });
    expect(manualMinutesOf({ manualMinutes: 0 })).toBeNull();
    expect(manualMinutesOf({ manualMinutes: Number.NaN })).toBeNull();
    expect(manualMinutesOf({ manualMinutes: '90' as unknown as number })).toBeNull();
  });
});
