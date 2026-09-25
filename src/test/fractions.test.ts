import { describe, it, expect } from 'vitest';
import { formatFraction, parseIngredientRow } from '../utils/fractions';
import { Ingredient } from '../types/recipe';

describe('formatFraction', () => {
  it('handles null, undefined, and NaN gracefully', () => {
    expect(formatFraction(null)).toBe('');
    expect(formatFraction(undefined)).toBe('');
    expect(formatFraction(NaN)).toBe('');
  });

  it('formats whole integers correctly', () => {
    expect(formatFraction(1)).toBe('1');
    expect(formatFraction(4)).toBe('4');
    expect(formatFraction(450)).toBe('450');
  });

  it('formats pure fractions accurately', () => {
    expect(formatFraction(0.5)).toBe('½');
    expect(formatFraction(0.25)).toBe('¼');
    expect(formatFraction(0.75)).toBe('¾');
    expect(formatFraction(0.333)).toBe('⅓');
    expect(formatFraction(0.667)).toBe('⅔');
    expect(formatFraction(0.125)).toBe('⅛');
  });

  it('formats mixed numbers (integers + fractions)', () => {
    expect(formatFraction(1.5)).toBe('1 ½');
    expect(formatFraction(2.25)).toBe('2 ¼');
    expect(formatFraction(3.75)).toBe('3 ¾');
  });
});

describe('parseIngredientRow', () => {
  it('correctly parses structured ingredients with quantities, units, and notes', () => {
    const ing: Ingredient = {
      text: 'All-Purpose Flour - 450g (weigh it)',
      qty: 450,
      unit: 'g',
      prefix: 'All-Purpose Flour - ',
      suffix: ' (weigh it)',
    };

    const parsed = parseIngredientRow(ing, 1, 'en');
    expect(parsed.name).toBe('All-Purpose Flour');
    expect(parsed.amount).toBe('450g');
    expect(parsed.notes).toContain('weigh it');
  });

  it('scales quantities dynamically and formats alternative units', () => {
    const ing: Ingredient = {
      text: 'Water (very warm but not hot) - 1.5 cups or 375ml',
      qty: 1.5,
      unit: 'cups',
      altQty: 375,
      altUnit: 'ml',
      prefix: 'Water (very warm but not hot) - ',
      suffix: '',
    };

    // At 2x scale:
    const parsed2x = parseIngredientRow(ing, 2, 'en');
    expect(parsed2x.name).toBe('Water');
    expect(parsed2x.amount).toBe('3 cups or 750ml');
    expect(parsed2x.notes).toContain('very warm but not hot');

    // At 0.5x scale (0.75 cups -> ¾ cup):
    const parsedHalf = parseIngredientRow(ing, 0.5, 'en');
    expect(parsedHalf.amount).toBe('¾ cup or 188ml');
  });

  it('handles Polish unit pluralization properly', () => {
    const ing: Ingredient = {
      text: 'Drożdże - 2 łyżeczki',
      qty: 2,
      unit: 'łyżeczki',
      prefix: 'Drożdże - ',
      renderUnit: 'łyżeczki',
      renderUnitPlural: 'łyżeczek',
    };

    // 1x scale: 2 łyżeczek
    const parsed1x = parseIngredientRow(ing, 1, 'pl');
    expect(parsed1x.name).toBe('Drożdże');
    expect(parsed1x.amount).toBe('2 łyżeczek');

    // 0.5x scale: 1 łyżeczki
    const parsedHalf = parseIngredientRow(ing, 0.5, 'pl');
    expect(parsedHalf.amount).toBe('1 łyżeczki');
  });

  it('falls back to string parsing for raw user input', () => {
    const rawIng: Ingredient = {
      text: 'Sugar - 2 tbsp',
    };

    const parsed = parseIngredientRow(rawIng, 1, 'en');
    expect(parsed.name).toBe('Sugar');
    expect(parsed.amount).toBe('2 tbsp');
  });

  it('correctly extracts name from text when qty is present but prefix is missing (AI translation fix)', () => {
    const translatedIng: Ingredient = {
      text: 'Jabłka - 6 sztuk',
      qty: 6,
      unit: 'sztuk',
    };

    const parsed = parseIngredientRow(translatedIng, 1, 'pl');
    expect(parsed.name).toBe('Jabłka');
    expect(parsed.amount).toBe('6 sztuk');
    expect(parsed.name).not.toBe('Ingredient');
    expect(parsed.name).not.toBe('Składnik');
  });

  it('correctly uses explicit name property when provided by AI translation', () => {
    const translatedIng: Ingredient = {
      name: 'Mąka pszenna',
      text: 'Mąka pszenna - 450g',
      qty: 450,
      unit: 'g',
    };

    const parsed = parseIngredientRow(translatedIng, 1, 'pl');
    expect(parsed.name).toBe('Mąka pszenna');
    expect(parsed.amount).toBe('450g');
  });
});
