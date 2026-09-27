import { describe, it, expect } from 'vitest';
import { Recipe } from '../types/recipe';
import {
  addedByName,
  authorModeOf,
  canEditRecipe,
  isHeirloom,
  resolveAuthor,
} from '../utils/ownership';
import {
  awaitsAdoption,
  hasLegacyRecipes,
  isLegacyOwner,
  planAdoption,
} from '../utils/legacyAdoption';
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

  it('counts recipes passed down from someone else as heirlooms', () => {
    expect(isHeirloom(WANDAS_CHEESE_BREAD)).toBe(true);
    expect(isHeirloom(recipe)).toBe(false);
  });
});

describe('legacy adoption', () => {
  const unownedWanda = { ...WANDAS_CHEESE_BREAD, ownerEmail: undefined, ownerName: undefined };

  it("runs only on Peter's account", () => {
    expect(isLegacyOwner(peter)).toBe(true);
    expect(isLegacyOwner({ ...peter, email: 'P.Gzowski33@gmail.com' })).toBe(true);
    expect(isLegacyOwner(ola)).toBe(false);
    expect(isLegacyOwner(null)).toBe(false);
  });

  it('is needed while Wanda is unowned or missing, or any recipe has no owner', () => {
    expect(hasLegacyRecipes([WANDAS_CHEESE_BREAD, recipe])).toBe(false);
    expect(hasLegacyRecipes([unownedWanda, recipe])).toBe(true);
    expect(hasLegacyRecipes([recipe])).toBe(true);
    expect(hasLegacyRecipes([WANDAS_CHEESE_BREAD, { ...recipe, ownerEmail: undefined }])).toBe(
      true,
    );
  });

  it("keeps machine translation away from Wanda's Polish until she's adopted", () => {
    expect(awaitsAdoption(unownedWanda)).toBe(true);
    expect(awaitsAdoption(WANDAS_CHEESE_BREAD)).toBe(false);
    expect(awaitsAdoption({ ...recipe, ownerEmail: undefined })).toBe(false);
  });

  it("gives an unowned recipe to Peter, crediting someone else's name as theirs", () => {
    const plan = planAdoption(
      [WANDAS_CHEESE_BREAD, { ...recipe, ownerEmail: undefined, author: 'Babcia Zosia' }],
      peter,
      5000,
    );
    expect(plan.wanda).toBeNull();
    expect(plan.claims).toEqual([
      {
        id: 'pierogi',
        owner: { ownerEmail: peter.email, ownerName: peter.name, authorMode: 'custom' },
      },
    ]);
  });

  it("dates Wanda's recipe just before the earliest one", () => {
    const plan = planAdoption([recipe], peter, 5000);
    expect(plan.wanda?.createdAt).toBeLessThan(recipe.createdAt!);
  });
});

describe('fitWithin', () => {
  it('scales the longer side down to the limit, keeping the shape', () => {
    expect(fitWithin(4000, 3000, 1000)).toEqual({ width: 1000, height: 750 });
    expect(fitWithin(3000, 4000, 1000)).toEqual({ width: 750, height: 1000 });
    expect(fitWithin(800, 600, 1000)).toEqual({ width: 800, height: 600 });
  });
});
