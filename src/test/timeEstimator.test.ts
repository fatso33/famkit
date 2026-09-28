import { describe, it, expect } from 'vitest';
import {
  extractTimeFromText,
  estimateActionDuration,
  estimateRecipeMinutes,
  capitalizeFirstLetter,
  manualMinutesOf,
  recipeTime,
} from '../utils/timeEstimator';
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
  });
});

describe('estimateActionDuration', () => {
  it('estimates duration based on culinary action keywords', () => {
    expect(estimateActionDuration('Knead the dough vigorously')).toBe(8);
    expect(estimateActionDuration('Preheat the oven')).toBe(15);
    expect(estimateActionDuration('Chop the jalapenos')).toBe(3);
    expect(estimateActionDuration('Roll into a square')).toBe(1.5);
  });
});

describe('estimateRecipeMinutes', () => {
  it('computes total recipe time for Wanda Cheese Bread, rounded to 5 minutes', () => {
    const minutes = estimateRecipeMinutes(WANDAS_CHEESE_BREAD);
    expect(minutes).toBeGreaterThan(60);
    expect(minutes % 5).toBe(0);
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

  it("uses the author's own time over the estimate, when it's a real number of minutes", () => {
    expect(recipeTime({ ...forked, manualMinutes: 95 })).toEqual({ minutes: 95, manual: true });
    expect(recipeTime(forked, { 1: 1 })).toEqual({ minutes: 50, manual: false });
    expect(manualMinutesOf({ manualMinutes: 0 })).toBeNull();
    expect(manualMinutesOf({ manualMinutes: Number.NaN })).toBeNull();
    expect(manualMinutesOf({ manualMinutes: '90' as unknown as number })).toBeNull();
  });
});
