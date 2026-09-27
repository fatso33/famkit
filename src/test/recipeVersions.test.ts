import { describe, it, expect } from 'vitest';
import { Recipe, RecipeVersion } from '../types/recipe';
import {
  diffRecipes,
  formatVersionDate,
  parseRecipeVersion,
  prepareEdit,
  recipeAtVersion,
  versionSummaries,
} from '../utils/recipeVersions';

const PHOTO = 'data:image/jpeg;base64,HERO';
const STEP_PHOTO = 'data:image/jpeg;base64,STEP';

const v1: Recipe = {
  id: 'babka',
  name: 'Babka',
  author: 'Babcia Zosia',
  authorMode: 'custom',
  ownerEmail: 'ola@example.com',
  ownerName: 'Ola Nowak',
  category: 'family',
  heroImage: PHOTO,
  yieldHeader: 'For 1 loaf:',
  ingredients: [{ text: 'Flour - 500g' }, { text: 'Sugar - 100g' }],
  steps: [
    { num: 1, text: 'Mix.', hasImage: true, imageSrc: STEP_PHOTO },
    { num: 2, text: 'Bake.' },
  ],
  tips: 'Use warm milk.',
  version: 1,
  createdAt: 1000,
  updatedAt: 1000,
};

describe('prepareEdit', () => {
  it('backs up the replaced version whole, photos included, and bumps the version', () => {
    const { recipe, newVersions } = prepareEdit(v1, { ...v1, name: 'Babka Wielkanocna' }, '', 2000);

    expect(recipe).toMatchObject({ name: 'Babka Wielkanocna', version: 2, updatedAt: 2000 });
    expect(newVersions).toHaveLength(1);
    expect(newVersions[0]).toMatchObject({
      id: 'v1-1000',
      version: 1,
      savedAt: 1000,
      hasPhotos: true,
    });
    expect(newVersions[0].recipe).toMatchObject({ name: 'Babka', heroImage: PHOTO });
    expect(newVersions[0].recipe.steps[0].imageSrc).toBe(STEP_PHOTO);
    expect(recipe.versionIndex).toEqual([
      { id: 'v1-1000', version: 1, savedAt: 1000, note: undefined },
    ]);
  });

  it("keeps each version's note with that version", () => {
    const first = prepareEdit(v1, { ...v1, tips: 'Use cold milk.' }, '  Mum’s tweak ', 2000);
    expect(first.recipe.changeNote).toBe('Mum’s tweak');

    const second = prepareEdit(first.recipe, { ...first.recipe, tips: 'Any milk.' }, '', 3000);
    expect(second.recipe.changeNote).toBeUndefined();
    expect(second.newVersions[0]).toMatchObject({ version: 2, note: 'Mum’s tweak' });
    expect(second.recipe.versionIndex?.map((v) => v.version)).toEqual([2, 1]);
  });

  it('moves the old inline history out of the recipe, marked as saved without photos', () => {
    const legacy: Recipe = {
      ...v1,
      version: 2,
      updatedAt: 1500,
      history: [{ version: 1, savedAt: 1000, recipe: { ...v1, heroImage: '' } }],
    };
    const { recipe, newVersions } = prepareEdit(legacy, legacy, '', 2000);

    expect(recipe).not.toHaveProperty('history');
    expect(newVersions.map((v) => [v.id, v.hasPhotos])).toEqual([
      ['v2-1500', true],
      ['v1-1000', false],
    ]);
    expect(recipe.versionIndex?.map((v) => v.id)).toEqual(['v2-1500', 'v1-1000']);
  });
});

describe('versionSummaries', () => {
  it('lists saved and not-yet-moved legacy versions, newest first', () => {
    const recipe: Recipe = {
      ...v1,
      version: 4,
      versionIndex: [{ id: 'v3-3000', version: 3, savedAt: 3000 }],
      history: [{ version: 2, savedAt: 2000, recipe: v1, changeNote: 'Less sugar' }],
    };
    expect(versionSummaries(recipe)).toEqual([
      { id: 'v3-3000', version: 3, savedAt: 3000 },
      { id: 'v2-2000', version: 2, savedAt: 2000, note: 'Less sugar' },
    ]);
    expect(versionSummaries(v1)).toEqual([]);
  });
});

describe('recipeAtVersion', () => {
  const current: Recipe = {
    ...v1,
    name: 'Babka Wielkanocna',
    heroImage: 'data:image/jpeg;base64,NEW',
    version: 3,
    changeNote: 'Renamed',
    versionIndex: [{ id: 'v2-2000', version: 2, savedAt: 2000 }],
  };
  const old: RecipeVersion = {
    id: 'v1-1000',
    version: 1,
    savedAt: 1000,
    hasPhotos: true,
    recipe: { ...v1, ownerEmail: 'someone@else.com' },
  };

  it("puts the old content on the current record, keeping today's identity and bookkeeping", () => {
    const merged = recipeAtVersion(current, old);
    expect(merged).toMatchObject({
      name: 'Babka',
      heroImage: PHOTO,
      ownerEmail: 'ola@example.com',
      version: 3,
      changeNote: 'Renamed',
      versionIndex: current.versionIndex,
    });
  });

  it("keeps today's photos when the old version was saved without them", () => {
    const merged = recipeAtVersion(current, {
      ...old,
      hasPhotos: false,
      recipe: { ...v1, heroImage: '', steps: v1.steps.map((st) => ({ ...st, imageSrc: '' })) },
    });
    expect(merged.name).toBe('Babka');
    expect(merged.heroImage).toBe('data:image/jpeg;base64,NEW');
    expect(merged.steps[0].imageSrc).toBe(STEP_PHOTO);
  });
});

describe('diffRecipes', () => {
  it('finds changed fields, ingredient rows and steps', () => {
    const current: Recipe = {
      ...v1,
      name: 'Babka Wielkanocna',
      ingredients: [{ text: 'Flour - 500g' }, { text: 'Sugar - 150g' }],
      steps: [{ ...v1.steps[0], text: 'Mix well.' }, v1.steps[1]],
    };
    const changes = diffRecipes(current, v1, true);
    expect([...changes.fields]).toEqual(['name']);
    expect([...changes.ingredients]).toEqual([1]);
    expect([...changes.steps]).toEqual([0]);
    expect(changes.count).toBe(3);
  });

  it("doesn't highlight what was only added later, but does highlight what comes back", () => {
    const later: Recipe = {
      ...v1,
      cardDescription: 'Added later',
      tips: undefined,
      steps: [...v1.steps, { num: 3, text: 'Glaze.' }],
    };
    const changes = diffRecipes(later, v1, true);
    // v1 has no description and only 2 steps: nothing to highlight for those.
    expect(changes.fields.has('cardDescription')).toBe(false);
    expect(changes.steps.size).toBe(0);
    // v1 had a tip that was removed since: restoring brings it back.
    expect(changes.fields.has('tips')).toBe(true);
  });

  it('notices a change of author, including "Me" versus someone else', () => {
    const mine: Recipe = { ...v1, author: 'Ola Nowak', authorMode: 'auto' };
    expect(diffRecipes(mine, v1, true).fields.has('author')).toBe(true);
  });

  it('ignores photos when the old version was saved without them', () => {
    const current: Recipe = {
      ...v1,
      heroImage: 'data:image/jpeg;base64,NEW',
      steps: [{ ...v1.steps[0], imageSrc: 'data:image/jpeg;base64,NEWSTEP' }, v1.steps[1]],
    };
    expect(diffRecipes(current, v1, false).count).toBe(0);
    expect(diffRecipes(current, v1, true).count).toBe(2);
  });
});

describe('parseRecipeVersion', () => {
  const stored = { id: 'v1-1000', version: 1, savedAt: 1000, hasPhotos: true, recipe: v1 };

  it('accepts a well-formed stored version', () => {
    expect(parseRecipeVersion(stored)?.recipe.name).toBe('Babka');
  });

  it('treats versions without the flag as having photos', () => {
    const { hasPhotos: _flag, ...unflagged } = stored;
    expect(parseRecipeVersion(unflagged)?.hasPhotos).toBe(true);
  });

  it('rejects missing or malformed data', () => {
    expect(parseRecipeVersion(null)).toBeNull();
    expect(parseRecipeVersion({ ...stored, version: '1' })).toBeNull();
    expect(parseRecipeVersion({ ...stored, recipe: { ...v1, steps: 'Mix.' } })).toBeNull();
    expect(
      parseRecipeVersion({ ...stored, recipe: { ...v1, ingredients: [{ text: 5 }] } }),
    ).toBeNull();
  });
});

describe('formatVersionDate', () => {
  it('writes the date in the viewer’s language', () => {
    const date = new Date(2026, 8, 12, 14, 5).getTime();
    expect(formatVersionDate(date, 'en')).toMatch(/12 Sept? 2026/);
    expect(formatVersionDate(date, 'pl')).toMatch(/12 wrz 2026/);
  });
});
