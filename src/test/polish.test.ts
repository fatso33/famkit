import { describe, it, expect } from 'vitest';
import { plPlural, polishUnit } from '../utils/polish';

describe('plPlural', () => {
  const form = (n: number) => plPlural(n, 'składnik', 'składniki', 'składników');

  it('uses the singular for one, the "few" form for 2–4 and the genitive otherwise', () => {
    expect(form(1)).toBe('składnik');
    expect([2, 3, 4, 22, 23, 24, 32, 102].map(form)).toEqual(Array(8).fill('składniki'));
    expect([0, 5, 11, 12, 13, 14, 21, 25, 111, 112].map(form)).toEqual(
      Array(10).fill('składników'),
    );
  });
});

describe('polishUnit', () => {
  it('declines a known kitchen unit from any of its forms', () => {
    for (const unit of ['łyżeczka', 'łyżeczki', 'łyżeczek']) {
      expect(polishUnit(1, unit)).toBe('łyżeczka');
      expect(polishUnit(3, unit)).toBe('łyżeczki');
      expect(polishUnit(12, unit)).toBe('łyżeczek');
      expect(polishUnit(1.5, unit)).toBe('łyżeczki');
    }
  });

  it('uses the genitive singular for fractions, where it differs from the plural', () => {
    expect(polishUnit(0.5, 'ząbki')).toBe('ząbka');
    expect(polishUnit(2, 'ząbki')).toBe('ząbki');
    expect(polishUnit(1.5, 'litry')).toBe('litra');
    expect(polishUnit(5, 'szczypty')).toBe('szczypt');
  });

  it('matches a known unit whatever its case or surrounding spaces', () => {
    expect(polishUnit(1, ' Łyżki ')).toBe('łyżka');
  });

  it('falls back to the stored forms for an unknown unit', () => {
    const stored = { renderUnit: 'doniczki', renderUnitPlural: 'doniczek' };
    expect(polishUnit(2, 'doniczki', stored)).toBe('doniczki');
    expect(polishUnit(0.5, 'doniczki', stored)).toBe('doniczki');
    expect(polishUnit(7, 'doniczki', stored)).toBe('doniczek');
    expect(polishUnit(7, 'doniczki')).toBe('doniczki');
  });

  it('finds a known unit through its stored forms when the unit itself is unknown', () => {
    expect(polishUnit(1, 'tsp', { renderUnit: 'łyżeczki', renderUnitPlural: 'łyżeczek' })).toBe(
      'łyżeczka',
    );
  });
});
