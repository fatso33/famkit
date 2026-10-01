import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRecipes } from '../hooks/useRecipes';
import { saveRecipeToCloud } from '../services/firestore';
import { Recipe } from '../types/recipe';
import { leavePhotosOut, PhotoEntry, recipePhotoEntry } from '../utils/deviceCopy';

// Only I/O is mocked: Firestore, so the full recipe can arrive after the app has started, and
// the photo store (IndexedDB), so its photos can be read after the first render.
vi.mock('../services/firebase', () => ({ isFirebaseConfigured: true }));
vi.mock('../services/gemini', () => ({
  isTranslationAvailable: false,
  translateDocuments: vi.fn(() => new Promise(() => {})),
}));

const firestore = vi.hoisted(() => ({ push: (_recipes: Recipe[]) => {} }));
vi.mock('../services/firestore', () => ({
  hasCloud: true,
  subscribeToRecipes: (onUpdate: (recipes: Recipe[]) => void) => {
    firestore.push = onUpdate;
    return () => {};
  },
  saveRecipeToCloud: vi.fn(() => Promise.resolve()),
  saveTranslationToCloud: vi.fn(() => Promise.resolve()),
  fetchRecipeVersion: vi.fn(() => Promise.reject(new Error('offline'))),
}));

const photoStore = vi.hoisted(() => ({
  kept: new Map<string, PhotoEntry>(),
  loaded: () => {},
}));
vi.mock('../services/photoStore', () => ({
  loadDevicePhotos: () => Promise.resolve(),
  whenDevicePhotosLoad: (listener: () => void) => {
    photoStore.loaded = listener;
    return () => {};
  },
  devicePhotos: (key: string) => photoStore.kept.get(key),
  keepDevicePhotos: () => {},
}));

const owner = { email: 'raye@example.com', name: 'Raye' };
const full: Recipe = {
  id: 'pie',
  name: 'Apple Pie',
  author: 'Raye',
  ownerEmail: owner.email,
  category: 'cakes',
  heroImage: 'data:image/jpeg;base64,PIE',
  yieldHeader: 'Serves 8:',
  ingredients: [{ text: 'Apples - 6' }],
  steps: [{ num: 1, text: 'Bake.', hasImage: true, imageSrc: 'data:image/jpeg;base64,STEP' }],
  version: 1,
  createdAt: 1000,
  updatedAt: 1000,
};
const slim = leavePhotosOut(full);

describe("this device's quick-start copy, without its photos", () => {
  beforeEach(() => {
    vi.mocked(saveRecipeToCloud).mockClear();
    localStorage.clear();
    photoStore.kept.clear();
    // What the phone saved last time: the words, its photos kept apart.
    localStorage.setItem('wandas_recipes', JSON.stringify([slim]));
  });

  it('is never saved over the recipe, so an edit before the cloud arrives loses no photos', () => {
    const { result } = renderHook(() => useRecipes(owner));
    expect(result.current.recipes[0].photosOmitted).toEqual({ hero: true });

    let saved: Recipe | null = null;
    let deleted = true;
    act(() => {
      saved = result.current.updateRecipe({ ...slim, name: 'Apple Pie!' });
      deleted = result.current.deleteRecipe('pie');
    });

    expect(saved).toBeNull();
    expect(deleted).toBe(false);
    expect(saveRecipeToCloud).not.toHaveBeenCalled();
    expect(result.current.allRecipes).toEqual([slim]);
  });

  it('is replaced by the full recipe, which can then be edited', () => {
    const { result } = renderHook(() => useRecipes(owner));
    act(() => firestore.push([full]));
    expect(result.current.recipes[0]).toEqual(full);

    act(() => {
      result.current.updateRecipe({ ...full, name: 'Apple Pie!' });
    });
    const [written, versions] = vi.mocked(saveRecipeToCloud).mock.calls[0] as unknown as [
      Recipe,
      { recipe: Recipe }[],
    ];
    expect(written).toMatchObject({ name: 'Apple Pie!', heroImage: full.heroImage });
    expect(versions[0].recipe.heroImage).toBe(full.heroImage);
  });

  it("doesn't take loaded photos away when the cloud fails and the app falls back to it", () => {
    const { result } = renderHook(() => useRecipes(owner));
    act(() => firestore.push([full]));
    // subscribeToRecipes' error path: this device's copy again.
    act(() => firestore.push([slim]));

    expect(result.current.recipes[0]).toEqual(full);
  });

  it('is made whole by the photos kept on this phone once they are read, and can then be edited', () => {
    const { result } = renderHook(() => useRecipes(owner));
    expect(result.current.recipes[0].photosOmitted).toBeDefined();

    photoStore.kept.set('recipe:pie', recipePhotoEntry(full)!);
    act(() => photoStore.loaded());
    expect(result.current.recipes[0]).toEqual(full);

    act(() => {
      result.current.updateRecipe({ ...result.current.recipes[0], name: 'Apple Pie!' });
    });
    expect(vi.mocked(saveRecipeToCloud).mock.calls[0][0]).toMatchObject({
      name: 'Apple Pie!',
      heroImage: full.heroImage,
    });
  });
});
