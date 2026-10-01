import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getStoredRecipes,
  saveRecipes,
  getStoredMakes,
  saveMakes,
  getStoredLanguage,
  setStoredLanguage,
  getStoredTheme,
  setStoredTheme,
  getStoredFontScale,
  setStoredFontScale,
  clearLegacyApiKey,
  getStoredVaultSort,
  setStoredVaultSort,
  getStoredVaultView,
  setStoredVaultView,
} from '../services/storage';
import { WANDAS_CHEESE_BREAD } from './fixtures/wandasCheeseBread';
import { Recipe } from '../types/recipe';
import { Make } from '../types/make';
import type { PhotoEntry, PhotoSet } from '../utils/deviceCopy';

// The photo store (IndexedDB) as a map, its writes applied at once.
const { kept } = vi.hoisted(() => ({ kept: new Map<string, PhotoEntry>() }));
vi.mock('../services/photoStore', async () => {
  const { photoChanges } = await import('../utils/deviceCopy');
  return {
    loadDevicePhotos: () => Promise.resolve(),
    devicePhotos: (key: string) => kept.get(key),
    keepDevicePhotos: (set: PhotoSet) => {
      const { put, remove } = photoChanges(kept, set);
      put.forEach((entry) => kept.set(entry.key, entry));
      remove.forEach((key) => kept.delete(key));
    },
  };
});

describe('storage service', () => {
  beforeEach(() => {
    localStorage.clear();
    kept.clear();
  });

  it('starts with an empty vault: no recipe is built into the app', () => {
    expect(getStoredRecipes()).toEqual([]);
  });

  it('keeps stored recipes exactly as saved', () => {
    const edited = { ...WANDAS_CHEESE_BREAD, tips: 'Grease the pot first.' };
    saveRecipes([edited]);
    expect(getStoredRecipes()).toEqual([edited]);
  });

  it('starts empty rather than crashing on corrupt storage', () => {
    localStorage.setItem('wandas_recipes', '{not json');
    expect(getStoredRecipes()).toEqual([]);
  });

  it('persists and retrieves custom recipes', () => {
    const customRecipe: Recipe = {
      id: 'custom-1',
      name: "Grandma's Apple Pie",
      author: 'Grandma M.',
      category: 'family',
      heroImage: '',
      yieldHeader: 'Serves 8:',
      ingredients: [{ text: 'Apples - 6 large' }],
      steps: [{ num: 1, text: 'Slice apples and bake.' }],
    };

    saveRecipes([WANDAS_CHEESE_BREAD, customRecipe]);
    const stored = getStoredRecipes();
    expect(stored.length).toBe(2);
    expect(stored[1].name).toBe("Grandma's Apple Pie");
  });

  describe('when the cloud keeps the photos', () => {
    // About 5.2M characters of photos: more than a browser lets a site keep (about 5M).
    const bigVault = (): Recipe[] =>
      Array.from({ length: 40 }, (_, i) => ({
        id: `r${i}`,
        name: `Recipe ${String(i).padStart(2, '0')}`,
        author: 'Raye',
        category: 'mains',
        heroImage: `data:image/jpeg;base64,${String(i % 10).repeat(130_000)}`,
        yieldHeader: 'Serves 4:',
        ingredients: [{ text: 'Flour - 2 cups' }],
        steps: [{ num: 1, text: 'Mix.' }],
        createdAt: 1000 + i,
        updatedAt: 1000 + i,
      }));

    it('keeps only the words in storage, and every photo in the photo store', () => {
      const vault = bigVault();
      saveRecipes(vault, { photosInCloud: true });

      const words = localStorage.getItem('wandas_recipes')!;
      expect(words).not.toContain('data:image');
      expect(words.length).toBeLessThan(20_000);
      expect([...kept.keys()]).toHaveLength(40);
    });

    it('starts with every recipe whole when the photo store has them', () => {
      const vault = bigVault();
      saveRecipes(vault, { photosInCloud: true });
      expect(getStoredRecipes()).toEqual(vault);
    });

    it("leaves a recipe waiting for the cloud when its photos aren't kept here", () => {
      saveRecipes(bigVault(), { photosInCloud: true });
      kept.delete('recipe:r3');

      const stored = getStoredRecipes();
      expect(stored).toHaveLength(40);
      expect(stored.find((r) => r.id === 'r3')).toMatchObject({
        heroImage: '',
        photosOmitted: { hero: true },
      });
      expect(stored.filter((r) => r.photosOmitted)).toHaveLength(1);
    });

    it('keeps nothing out of date when even the words no longer fit', () => {
      saveRecipes(bigVault().slice(0, 2), { photosInCloud: true });
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Storage full', 'QuotaExceededError');
      });
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        saveRecipes(bigVault(), { photosInCloud: true });
        expect(localStorage.getItem('wandas_recipes')).toBeNull();
      } finally {
        spy.mockRestore();
        vi.mocked(console.warn).mockRestore();
      }
    });

    it("keeps makes' words in storage and their photos in the photo store", () => {
      const makes: Make[] = [
        { id: 'm1', recipeId: 'r1', photo: bigVault()[0].heroImage, createdAt: 1, updatedAt: 1 },
      ];
      saveMakes(makes, { photosInCloud: true });
      expect(localStorage.getItem('family_kitchen_makes')).not.toContain('data:image');
      expect(getStoredMakes()).toEqual(makes);
    });

    it('never leaves photos out when this device is the only copy', () => {
      const small = bigVault().slice(0, 2);
      saveRecipes(small);
      saveRecipes(bigVault());
      expect(getStoredRecipes()).toEqual(small);
    });
  });

  it('correctly persists language preferences', () => {
    expect(getStoredLanguage()).toBe('en');
    setStoredLanguage('pl');
    expect(getStoredLanguage()).toBe('pl');
  });

  it('correctly persists theme preferences', () => {
    setStoredTheme('dark');
    expect(getStoredTheme()).toBe('dark');
    setStoredTheme('light');
    expect(getStoredTheme()).toBe('light');
  });

  it('clamps and persists font scaling', () => {
    setStoredFontScale(1.25);
    expect(getStoredFontScale()).toBe(1.25);

    setStoredFontScale(3.0); // Above max 1.4
    expect(getStoredFontScale()).toBe(1.4);

    setStoredFontScale(0.2); // Below min 0.85
    expect(getStoredFontScale()).toBe(0.85);
  });

  it("keeps the vault's sort and layout, falling back to by category as a list", () => {
    expect(getStoredVaultSort()).toEqual({ by: 'category', reversed: false });
    expect(getStoredVaultView()).toBe('list');

    setStoredVaultSort({ by: 'cook', reversed: true });
    setStoredVaultView('cards');
    expect(getStoredVaultSort()).toEqual({ by: 'cook', reversed: true });
    expect(getStoredVaultView()).toBe('cards');

    localStorage.setItem('family_kitchen_vault_sort', 'by-colour');
    expect(getStoredVaultSort()).toEqual({ by: 'category', reversed: false });
  });

  it('clears a Gemini API key left over from the old Settings field', () => {
    localStorage.setItem('wandas_gemini_api_key', 'AIzaSyTestKey123');
    clearLegacyApiKey();
    expect(localStorage.getItem('wandas_gemini_api_key')).toBeNull();
  });
});
