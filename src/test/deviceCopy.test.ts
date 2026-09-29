import { describe, it, expect } from 'vitest';
import { Recipe } from '../types/recipe';
import {
  deviceCopyJson,
  hasLeftOutPhotos,
  keepLoadedPhotos,
  leavePhotosOut,
  photoPending,
} from '../utils/deviceCopy';

const photo = (seed: string, size = 1000) => `data:image/jpeg;base64,${seed.repeat(size)}`;

const recipe = (id: string, createdAt: number, extra: Partial<Recipe> = {}): Recipe => ({
  id,
  name: id,
  author: 'Raye',
  category: 'mains',
  heroImage: photo(id),
  yieldHeader: 'Serves 4:',
  ingredients: [{ text: 'Flour - 2 cups' }],
  steps: [{ num: 1, text: 'Mix.' }],
  createdAt,
  updatedAt: createdAt,
  ...extra,
});

const parse = (json: string) => JSON.parse(json) as Recipe[];

describe('leaving photos out of the quick-start copy', () => {
  it("drops a fork path's own photo too", () => {
    const forked = recipe('pierogi', 1, {
      heroImage: '',
      steps: [
        {
          num: 1,
          text: 'Boil.',
          fork: {
            paths: [
              { label: 'Boil', text: 'Boil.' },
              { label: 'Fry', text: 'Fry.', hasImage: true, imageSrc: photo('fry') },
            ],
          },
        },
      ],
    });
    const slim = leavePhotosOut(forked);
    expect(slim.steps[0].fork!.paths[1].imageSrc).toBeUndefined();
    expect(slim.steps[0].fork!.paths[1].text).toBe('Fry.');
    expect(slim.photosOmitted).toEqual({ hero: false });
  });

  it('drops the hero and step photos, and marks the copy', () => {
    const withSteps = recipe('babka', 1, {
      steps: [
        { num: 1, text: 'Knead.', hasImage: true, imageSrc: photo('step'), imageCaption: 'Dough' },
        { num: 2, text: 'Bake.' },
      ],
    });
    const slim = leavePhotosOut(withSteps);

    expect(slim.heroImage).toBe('');
    expect(slim.steps[0].imageSrc).toBeUndefined();
    // The caption is text, and stays.
    expect(slim.steps[0].imageCaption).toBe('Dough');
    expect(slim.photosOmitted).toEqual({ hero: true });
    expect(hasLeftOutPhotos(slim)).toBe(true);
    expect(photoPending(slim)).toBe(true);
    // Everything else is untouched.
    expect({ ...slim, heroImage: '', steps: [], photosOmitted: undefined }).toEqual({
      ...withSteps,
      heroImage: '',
      steps: [],
      photosOmitted: undefined,
    });
  });

  it('says a step photo was left out even when there was no hero photo', () => {
    const slim = leavePhotosOut(
      recipe('soup', 1, {
        heroImage: '',
        steps: [{ num: 1, text: 'Stir.', imageSrc: photo('s') }],
      }),
    );
    expect(slim.photosOmitted).toEqual({ hero: false });
    expect(hasLeftOutPhotos(slim)).toBe(true);
    // Its card shows its category tile, as it always has.
    expect(photoPending(slim)).toBe(false);
  });

  it('leaves a recipe without photos as it is, unmarked', () => {
    const plain = recipe('toast', 1, { heroImage: '' });
    expect(leavePhotosOut(plain)).toBe(plain);
    expect(hasLeftOutPhotos(plain)).toBe(false);
  });
});

describe('fitting the quick-start copy into its budget', () => {
  const vault = [recipe('a', 3), recipe('b', 2), recipe('c', 1)];
  const oneRecipe = JSON.stringify(vault[0]).length;

  it('keeps every photo when the whole vault fits', () => {
    expect(parse(deviceCopyJson(vault, ['a', 'b', 'c'], 10 * oneRecipe))).toEqual(vault);
  });

  it('keeps photos for the recipes shown first, and every recipe, when it does not', () => {
    const copy = parse(deviceCopyJson(vault, ['c', 'a', 'b'], 2.5 * oneRecipe));

    expect(copy.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(copy[2]).toEqual(vault[2]);
    expect(copy[0]).toEqual(vault[0]);
    expect(copy[1]).toEqual(leavePhotosOut(vault[1]));
  });

  it('leaves out the photos of recipes the vault does not show (deleted ones) first', () => {
    const copy = parse(deviceCopyJson(vault, ['b', 'c'], 2.5 * oneRecipe));
    expect(copy.map(hasLeftOutPhotos)).toEqual([true, false, false]);
  });

  it('stays within the budget', () => {
    const budget = 1.5 * oneRecipe;
    const json = deviceCopyJson(vault, ['a', 'b', 'c'], budget);
    expect(json.length).toBeLessThanOrEqual(budget);
    expect(parse(json).map(hasLeftOutPhotos)).toEqual([false, true, true]);
  });
});

describe('keeping photos already loaded', () => {
  const full = recipe('babka', 5);
  const slim = leavePhotosOut(full);

  it("doesn't swap a loaded recipe for the same version without its photos", () => {
    const next = keepLoadedPhotos([full], [slim]);
    expect(next[0]).toBe(full);
  });

  it('takes a newer version, and anything not loaded yet', () => {
    const newer = leavePhotosOut({ ...full, name: 'Babka 2', updatedAt: 9 });
    const other = leavePhotosOut(recipe('other', 1));
    expect(keepLoadedPhotos([full], [newer, other])).toEqual([newer, other]);
  });

  it('takes full recipes as they come', () => {
    const edited = { ...full, heroImage: '' };
    expect(keepLoadedPhotos([full], [edited])[0]).toBe(edited);
  });
});
