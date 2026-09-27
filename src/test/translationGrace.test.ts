import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRecipes } from '../hooks/useRecipes';
import { translateRecipe } from '../services/gemini';
import { Recipe } from '../types/recipe';
import { sourceHash } from '../utils/recipeTranslation';
import { WANDAS_CHEESE_BREAD } from './fixtures/wandasCheeseBread';

// Only I/O is mocked: the translation call, and Firestore so a "remote" edit can be pushed in.
vi.mock('../services/firebase', () => ({ isFirebaseConfigured: true }));
vi.mock('../services/gemini', () => ({
  isTranslationAvailable: true,
  translateRecipe: vi.fn(() => new Promise(() => {})),
}));

const firestore = vi.hoisted(() => ({ push: (_recipes: Recipe[]) => {} }));
vi.mock('../services/firestore', () => ({
  subscribeToRecipes: (onUpdate: (recipes: Recipe[]) => void) => {
    firestore.push = onUpdate;
    return () => {};
  },
  saveRecipeToCloud: vi.fn(() => Promise.resolve()),
  saveTranslationToCloud: vi.fn(() => Promise.resolve()),
  deleteRecipeFromCloud: vi.fn(() => Promise.resolve()),
}));

const base: Recipe = {
  id: 'custom-1',
  name: 'Aunt Ola Pierogi',
  author: 'Ola',
  ownerEmail: 'ola@example.com',
  category: 'family',
  heroImage: '',
  yieldHeader: 'For 1 batch:',
  ingredients: [{ text: 'Flour - 2 cups' }],
  steps: [{ num: 1, text: 'Mix.' }],
  createdAt: 1,
  updatedAt: 1,
};
const translated: Recipe = {
  ...base,
  translations: { pl: { name: 'Pierogi cioci Oli', sourceHash: sourceHash(base) } },
};

describe('translation grace period across phones', () => {
  beforeEach(() => {
    vi.mocked(translateRecipe).mockClear();
    localStorage.clear();
    localStorage.setItem('wandas_recipes', JSON.stringify([translated]));
  });

  it("doesn't treat another phone's later edit as saved here after an author-only edit", async () => {
    const { result } = renderHook(() => useRecipes(null));

    // This phone changes only the author: nothing needs translating.
    act(() => {
      result.current.updateRecipe({ ...translated, author: 'Ciocia Ola' });
    });
    expect(translateRecipe).not.toHaveBeenCalled();

    // Moments later, another phone edits the text and it syncs in.
    await act(async () => {
      firestore.push([{ ...translated, name: "Aunt Ola's Pierogi", updatedAt: Date.now() }]);
    });

    // Leave it to the phone that made the edit.
    expect(translateRecipe).not.toHaveBeenCalled();
  });

  it('translates its own text edit straight away', async () => {
    const { result } = renderHook(() => useRecipes(null));

    await act(async () => {
      result.current.updateRecipe({ ...translated, name: "Aunt Ola's Pierogi" });
    });

    expect(translateRecipe).toHaveBeenCalledTimes(1);
  });

  it("doesn't translate a copy cached from before recipes had owners", async () => {
    // This phone last synced before Peter adopted Wanda's Cheese Bread: its copy has no owner,
    // and its hand-written Polish isn't stamped yet, so it looks untranslated.
    const { ownerEmail: _o, ownerName: _n, translations, ...cached } = WANDAS_CHEESE_BREAD;
    const { sourceHash: _h, ...unstamped } = translations!.pl!;
    localStorage.setItem(
      'wandas_recipes',
      JSON.stringify([{ ...cached, translations: { pl: unstamped } }]),
    );
    renderHook(() => useRecipes(null));
    await act(async () => {});
    expect(translateRecipe).not.toHaveBeenCalled();

    // The adopted recipe arrives from the cloud, with its Polish current: still nothing to do.
    await act(async () => {
      firestore.push([WANDAS_CHEESE_BREAD]);
    });
    expect(translateRecipe).not.toHaveBeenCalled();
  });
});
