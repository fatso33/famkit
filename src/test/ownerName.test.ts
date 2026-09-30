import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRecipes } from '../hooks/useRecipes';
import { Recipe } from '../types/recipe';
import { creditName } from '../utils/ownership';

vi.mock('../services/firebase', () => ({ isFirebaseConfigured: false, db: null }));
vi.mock('../services/gemini', () => ({
  isTranslationAvailable: false,
  translateDocuments: vi.fn(() => new Promise(() => {})),
}));

const google = { email: 'zosia@example.com', name: 'Zofia Nowak' };
const listed = { ...google, name: 'Ciocia Zosia', nameAsTyped: true };

const content: Omit<Recipe, 'id' | 'createdAt'> = {
  name: 'Babka',
  author: 'Zofia Nowak',
  authorMode: 'auto',
  category: 'cakes',
  heroImage: '',
  yieldHeader: 'For 1 cake:',
  ingredients: [{ text: 'Flour - 2 cups' }],
  steps: [{ num: 1, text: 'Bake.' }],
};

describe("the owner's name on a saved recipe", () => {
  beforeEach(() => localStorage.clear());

  it('remembers a family list name, to show it as written', () => {
    const { result } = renderHook(() => useRecipes(listed));
    let added: Recipe | undefined;
    act(() => {
      added = result.current.addRecipe({ ...content, author: 'Ciocia Zosia' });
    });
    expect(added).toMatchObject({ ownerName: 'Ciocia Zosia', ownerNameAsTyped: true });
    expect(creditName(added!)).toBe('Ciocia Zosia');
  });

  it('takes the name the owner goes by now when they save an edit', () => {
    const { result, rerender } = renderHook(({ user }) => useRecipes(user), {
      initialProps: { user: google as typeof listed | typeof google },
    });
    let added: Recipe | undefined;
    act(() => {
      added = result.current.addRecipe(content);
    });
    expect(creditName(added!)).toBe('Zofia N.');

    // The family list names her afterwards.
    rerender({ user: listed });
    let saved: Recipe | null = null;
    act(() => {
      saved = result.current.updateRecipe({ ...added!, author: 'Ciocia Zosia', name: 'Babka!' });
    });
    expect(saved).toMatchObject({ ownerName: 'Ciocia Zosia', ownerNameAsTyped: true });
    expect(creditName(saved!)).toBe('Ciocia Zosia');
  });
});
