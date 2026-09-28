import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRecipes } from '../hooks/useRecipes';
import { Recipe } from '../types/recipe';

// Configured, but Firebase failed to start (firebase.ts leaves db null): this device's copy is
// the only one, so it must keep every photo.
vi.mock('../services/firebase', () => ({ isFirebaseConfigured: true, db: null }));
vi.mock('../services/gemini', () => ({
  isTranslationAvailable: false,
  translatePieces: vi.fn(() => new Promise(() => {})),
}));

const owner = { email: 'raye@example.com', name: 'Raye' };
// About 3.3M characters of photos: over the quick-start copy's budget, within the browser's room.
const vault: Recipe[] = Array.from({ length: 25 }, (_, i) => ({
  id: `r${i}`,
  name: `Recipe ${i}`,
  author: 'Raye',
  ownerEmail: owner.email,
  category: 'mains',
  heroImage: `data:image/jpeg;base64,${String(i % 10).repeat(130_000)}`,
  yieldHeader: 'Serves 4:',
  ingredients: [{ text: 'Flour - 2 cups' }],
  steps: [{ num: 1, text: 'Mix.' }],
  createdAt: 1000 + i,
  updatedAt: 1000 + i,
}));

describe('when the cloud is configured but unavailable', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('wandas_recipes', JSON.stringify(vault));
  });

  it("never leaves photos out of this device's copy, the only one", () => {
    const { result } = renderHook(() => useRecipes(owner));
    act(() => {
      result.current.addRecipe({
        ...vault[0],
        name: 'New pie',
        heroImage: 'data:image/jpeg;base64,PIE',
      });
    });

    const stored = JSON.parse(localStorage.getItem('wandas_recipes')!) as Recipe[];
    expect(stored).toHaveLength(26);
    expect(stored.filter((r) => r.photosOmitted)).toEqual([]);
  });
});
