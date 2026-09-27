import { describe, it, expect } from 'vitest';
import {
  extractTimeFromText,
  estimateActionDuration,
  estimateRecipeMinutes,
  capitalizeFirstLetter,
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
