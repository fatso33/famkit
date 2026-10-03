import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRecipes } from '../hooks/useRecipes';
import { Recipe } from '../types/recipe';

vi.mock('../services/firebase', () => ({ isFirebaseConfigured: false, db: null }));
vi.mock('../services/gemini', () => ({
  isTranslationAvailable: false,
  translateDocuments: vi.fn(() => new Promise(() => {})),
}));
// The cloud refuses every save (as it does a recipe over its size limit).
vi.mock('../services/firestore', () => ({
  hasCloud: false,
  subscribeToRecipes: vi.fn(() => () => {}),
  saveRecipeToCloud: vi.fn(() => Promise.reject(new Error('invalid-argument'))),
  saveTranslationToCloud: vi.fn(() => Promise.resolve()),
  fetchRecipeVersion: vi.fn(),
}));

const owner = { email: 'ola@example.com', name: 'Ola' };
const content: Omit<Recipe, 'id' | 'createdAt'> = {
  name: 'Sernik',
  author: 'Ola',
  authorMode: 'auto',
  category: 'cakes',
  heroImage: '',
  yieldHeader: '',
  ingredients: [{ text: 'Twaróg - 1 kg' }],
  steps: [{ num: 1, text: 'Bake.' }],
};

describe('a save the cloud refuses', () => {
  beforeEach(() => localStorage.clear());

  it('is told to whoever saved it, not only to the console (regression)', async () => {
    const failed = vi.fn();
    const { result } = renderHook(() => useRecipes(owner, undefined, failed));
    let added: Recipe | null = null;
    act(() => {
      added = result.current.addRecipe(content);
    });
    await waitFor(() => expect(failed).toHaveBeenCalledWith(added));

    act(() => {
      result.current.updateRecipe({ ...added!, name: 'Sernik babci' });
    });
    await waitFor(() => expect(failed).toHaveBeenCalledTimes(2));
    expect(failed.mock.lastCall![0]).toMatchObject({ name: 'Sernik babci' });
  });
});
