import { describe, it, expect } from 'vitest';
import { Recipe } from '../types/recipe';
import { Make } from '../types/make';
import {
  hasLeftOutPhotos,
  keepLoadedPhotos,
  leavePhotosOut,
  makePhotoEntry,
  PhotoEntry,
  photoChanges,
  photoPending,
  recipePhotoEntry,
  recipePhotoSet,
  withMakePhoto,
  withRecipePhotos,
} from '../utils/deviceCopy';
import { leaveMakePhotoOut } from '../utils/makes';

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

describe('photos kept apart from the words', () => {
  const full = recipe('babka', 5, {
    version: 3,
    steps: [
      { num: 1, text: 'Knead.', hasImage: true, imageSrc: photo('knead'), imageCaption: 'Dough' },
      { num: 2, text: 'Rest.' },
      {
        num: 3,
        text: 'Bake.',
        fork: {
          paths: [
            { label: 'Oven', text: 'Bake.' },
            { label: 'Pan', text: 'Fry.', hasImage: true, imageSrc: photo('pan') },
          ],
        },
      },
    ],
  });
  const slim = leavePhotosOut(full);
  const entry = recipePhotoEntry(full)!;

  it('puts every photo back where it was, unmarked', () => {
    const filled = withRecipePhotos(slim, entry);
    expect(filled).toEqual(full);
    expect(hasLeftOutPhotos(filled)).toBe(false);
  });

  it("doesn't fill a different saved state, which keeps waiting for the cloud", () => {
    const newer = leavePhotosOut({ ...full, updatedAt: 9 });
    expect(withRecipePhotos(newer, entry)).toBe(newer);
    const nextVersion = leavePhotosOut({ ...full, version: 4 });
    expect(withRecipePhotos(nextVersion, entry)).toBe(nextVersion);
    expect(withRecipePhotos(slim, undefined)).toBe(slim);
  });

  it('fills nothing unless every photo has its place, so a recipe is never half filled', () => {
    const stray = { ...entry, photos: { ...entry.photos, s7: photo('stray') } };
    expect(withRecipePhotos(slim, stray)).toBe(slim);
    const noHero = { ...entry, photos: { s0: photo('knead') } };
    expect(withRecipePhotos(slim, noHero)).toBe(slim);
  });

  it('leaves full recipes alone, and keeps nothing for a copy or a recipe without photos', () => {
    expect(withRecipePhotos(full, entry)).toBe(full);
    expect(recipePhotoEntry(slim)).toBeNull();
    expect(recipePhotoEntry(recipe('toast', 1, { heroImage: '' }))).toBeNull();
  });

  it("does the same for a make's photo", () => {
    const made: Make = {
      id: 'm1',
      recipeId: 'babka',
      photo: photo('made'),
      createdAt: 1,
      updatedAt: 2,
    };
    const madeEntry = makePhotoEntry(made)!;
    const waiting = leaveMakePhotoOut(made);
    expect(withMakePhoto(waiting, madeEntry)).toEqual(made);
    expect(withMakePhoto(waiting, madeEntry).photoOmitted).toBeUndefined();
    const edited = { ...waiting, updatedAt: 3 };
    expect(withMakePhoto(edited, madeEntry)).toBe(edited);
    expect(makePhotoEntry(waiting)).toBeNull();
  });
});

describe('deciding which photos this device writes', () => {
  const a = recipe('a', 1);
  const b = recipe('b', 2);
  const known = (...entries: PhotoEntry[]) => new Map(entries.map((e) => [e.key, e]));

  it('writes new and changed photos, and leaves unchanged ones alone', () => {
    const changedB = { ...b, heroImage: photo('B') };
    const { put, remove } = photoChanges(
      known(recipePhotoEntry(a)!, recipePhotoEntry(b)!),
      recipePhotoSet([a, changedB, recipe('c', 3)]),
    );
    expect(put.map((e) => e.key)).toEqual(['recipe:b', 'recipe:c']);
    expect(remove).toEqual([]);
  });

  it("removes those of recipes gone or without photos, never a waiting copy's or a make's", () => {
    const madeEntry = makePhotoEntry({
      id: 'm1',
      recipeId: 'a',
      photo: photo('m'),
      createdAt: 1,
      updatedAt: 1,
    })!;
    const { put, remove } = photoChanges(
      known(
        recipePhotoEntry(a)!,
        recipePhotoEntry(b)!,
        recipePhotoEntry(recipe('gone', 3))!,
        madeEntry,
      ),
      recipePhotoSet([leavePhotosOut(a), { ...b, heroImage: '' }]),
    );
    expect(put).toEqual([]);
    expect(remove.sort()).toEqual(['recipe:b', 'recipe:gone']);
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
