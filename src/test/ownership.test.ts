import { describe, it, expect } from 'vitest';
import { Recipe } from '../types/recipe';
import {
  addedByName,
  authorModeOf,
  canEditRecipe,
  familyMemberName,
  memberDisplayName,
  resolveAuthor,
  shortName,
} from '../utils/ownership';
import { fitWithin } from '../utils/imageCompression';
import { WANDAS_CHEESE_BREAD } from './fixtures/wandasCheeseBread';

const ola = { email: 'ola@example.com', name: 'Ola Nowak' };
const peter = { email: 'p.gzowski33@gmail.com', name: 'Peter Gzowski' };

const recipe: Recipe = {
  id: 'pierogi',
  name: 'Pierogi',
  author: 'Ola Nowak',
  authorMode: 'auto',
  ownerEmail: ola.email,
  ownerName: ola.name,
  category: 'family',
  heroImage: '',
  yieldHeader: 'For 1 batch:',
  ingredients: [{ text: 'Flour - 2 cups' }],
  steps: [{ num: 1, text: 'Mix.' }],
  createdAt: 1000,
};

describe('canEditRecipe', () => {
  it('lets only the family member who added the recipe edit it', () => {
    expect(canEditRecipe(recipe, ola, true)).toBe(true);
    expect(canEditRecipe(recipe, peter, true)).toBe(false);
    expect(canEditRecipe(recipe, null, true)).toBe(false);
  });

  it('ignores email letter case', () => {
    expect(canEditRecipe(recipe, { ...ola, email: 'Ola@Example.com' }, true)).toBe(true);
  });

  it('lets nobody edit a recipe without an owner', () => {
    expect(canEditRecipe({ ...recipe, ownerEmail: undefined }, ola, true)).toBe(false);
  });

  it('allows everything on a device without cloud access control (local dev)', () => {
    expect(canEditRecipe(recipe, peter, false)).toBe(true);
  });
});

describe('authors', () => {
  it("credits the signed-in member in 'Me' mode and the typed name otherwise", () => {
    expect(resolveAuthor('auto', 'ignored', ola)).toBe('Ola Nowak');
    expect(resolveAuthor('custom', '  Babcia Zosia ', ola)).toBe('Babcia Zosia');
    expect(resolveAuthor('auto', 'Babcia Zosia', null)).toBe('Babcia Zosia');
  });

  it('treats older recipes with only a typed author as someone else’s', () => {
    expect(authorModeOf({ ...recipe, authorMode: undefined })).toBe('custom');
    expect(authorModeOf(recipe)).toBe('auto');
  });

  it("shows who added a recipe only when it's credited to someone else", () => {
    expect(addedByName(recipe)).toBeNull();
    expect(addedByName(WANDAS_CHEESE_BREAD)).toBe('Peter Gzowski');
    expect(addedByName({ ...recipe, authorMode: 'custom', author: 'Ola Nowak' })).toBeNull();
  });
});

describe('names from the family list', () => {
  it('tidies the name a family_members entry gives someone', () => {
    expect(familyMemberName('  Babcia  ')).toBe('Babcia');
    expect(familyMemberName('Ciocia\n  Ola')).toBe('Ciocia Ola');
    expect(familyMemberName('x'.repeat(200))).toHaveLength(60);
  });

  it('ignores an entry name that is missing, blank or not text', () => {
    expect(familyMemberName(undefined)).toBeNull();
    expect(familyMemberName('   ')).toBeNull();
    expect(familyMemberName(42)).toBeNull();
    expect(familyMemberName({ first: 'Babcia' })).toBeNull();
  });

  it("credits the family list's name first, then Google's, then the email", () => {
    expect(memberDisplayName('Babcia', 'Krystyna Nowak', 'k@example.com')).toBe('Babcia');
    expect(memberDisplayName(null, 'Krystyna Nowak', 'k@example.com')).toBe('Krystyna Nowak');
    expect(memberDisplayName(null, '  ', 'k@example.com')).toBe('k@example.com');
    expect(memberDisplayName(null, null, 'k@example.com')).toBe('k@example.com');
  });
});

describe('fitWithin', () => {
  it('scales the longer side down to the limit, keeping the shape', () => {
    expect(fitWithin(4000, 3000, 1000)).toEqual({ width: 1000, height: 750 });
    expect(fitWithin(3000, 4000, 1000)).toEqual({ width: 750, height: 1000 });
    expect(fitWithin(800, 600, 1000)).toEqual({ width: 800, height: 600 });
  });
});

describe('shortName', () => {
  it('shows a first name and last initial on the author switch', () => {
    expect(shortName('Peter Gzowski')).toBe('Peter G.');
    expect(shortName('  Ola Maria nowak ')).toBe('Ola N.');
    expect(shortName('Wanda')).toBe('Wanda');
    expect(shortName('ola@example.com')).toBe('ola@example.com');
  });
});
