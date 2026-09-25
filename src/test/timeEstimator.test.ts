import { describe, it, expect } from 'vitest';
import {
  extractTimeFromText,
  estimateActionDuration,
  calculateRecipeTime,
  capitalizeFirstLetter,
} from '../utils/timeEstimator';
import { DEFAULT_RECIPE } from '../data/defaultRecipe';

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

describe('calculateRecipeTime', () => {
  it('computes and formats total recipe time for Wanda Cheese Bread', () => {
    const time = calculateRecipeTime(DEFAULT_RECIPE);
    expect(time).toMatch(/~\d+\s*(?:hrs?|mins?)/);
  });

  it('returns default estimate when recipe has no steps', () => {
    expect(calculateRecipeTime(null)).toBe('~30 mins');
    expect(calculateRecipeTime({ steps: [] })).toBe('~25 mins');
  });
});

describe('capitalizeFirstLetter', () => {
  it('capitalizes sentences properly', () => {
    expect(capitalizeFirstLetter('will not work in an air fryer.')).toBe(
      'Will not work in an air fryer.'
    );
    expect(
      capitalizeFirstLetter('mix well. then add water and mix again.')
    ).toBe('Mix well. Then add water and mix again.');
  });
});
